import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from '../providers/embedding.provider';
import { LlmProvider } from '../providers/llm.provider';
import { VectorRepository, SimilarChunk } from './vector.repository';
import { RedisService } from 'src/redis/redis.service';
import { createHash } from 'crypto';

export interface RagAnswer {
  answer: string;
  sources: SimilarChunk[];
}

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions using only the provided context.
If the answer cannot be found in the context, say you don't know rather than making something up.
Always be concise and cite which parts of the context you used when relevant.`;

@Injectable()
export class RagService {
  private readonly topK: number;
  private readonly cacheTtl: number;


  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly llmProvider: LlmProvider,
    private readonly redisService: RedisService,
    private readonly vectorRepository: VectorRepository,
    private readonly configService: ConfigService,
  ) {
    this.topK = Number(this.configService.get<string>('RAG_TOP_K', '5'));
    this.cacheTtl = Number(
      this.configService.get<string>('RAG_CACHE_TTL', '300'),
    );
  }

  async answerQuestion(
    question: string,
    documentId?: string,
  ): Promise<RagAnswer> {
    const cacheKey = this.buildCacheKey(
      question,
      documentId,
    );

    const cachedAnswer =
      await this.redisService.get<RagAnswer>(cacheKey);

    if (cachedAnswer) {
      return cachedAnswer;
    }

    const queryEmbedding = await this.embeddingProvider.embed(question);

    const sources = await this.vectorRepository.findSimilarChunks(
      queryEmbedding,
      this.topK,
      documentId,
    );

    const context = this.buildContext(sources);

    // Calling AI Model is commented out for now, as we are not using the LLM in this version of the code.

    const answer = await this.llmProvider.complete(SYSTEM_PROMPT, [
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ]);
    // const answer = `Based on the context, full-time employees are entitled to 20 days of paid vacation per calendar year, accrued monthly at a rate of 1.67 days per month. Additionally, up to 5 unused days can be carried over to the next year.`

    const result: RagAnswer = {
      answer,
      sources,
    };

    await this.redisService.set(
      cacheKey,
      result,
      this.cacheTtl,
    );

    return result;
  }

  private buildContext(chunks: SimilarChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context was found.';
    }

    return chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join('\n\n');
  }

  private buildCacheKey(
  question: string,
  documentId?: string,
): string {
  const normalizedQuestion = question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  const rawKey = `${documentId ?? 'all'}:${normalizedQuestion}`;

  const hash = createHash('sha256')
    .update(rawKey)
    .digest('hex');

  return `rag:v1:${hash}`;
}
}

