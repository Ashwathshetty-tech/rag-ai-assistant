import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from '../providers/embedding.provider';
import { LlmProvider } from '../providers/llm.provider';
import { VectorRepository, SimilarChunk } from './vector.repository';

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

  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly llmProvider: LlmProvider,
    private readonly vectorRepository: VectorRepository,
    private readonly configService: ConfigService,
  ) {
    this.topK = this.configService.get<number>('RAG_TOP_K', 5);
  }

  async answerQuestion(
    question: string,
    documentId?: string,
  ): Promise<RagAnswer> {
    const queryEmbedding = await this.embeddingProvider.embed(question);

    const sources = await this.vectorRepository.findSimilarChunks(
      queryEmbedding,
      this.topK,
      documentId,
    );

    const context = this.buildContext(sources);

    const answer = await this.llmProvider.complete(SYSTEM_PROMPT, [
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ]);

    return { answer, sources };
  }

  private buildContext(chunks: SimilarChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context was found.';
    }

    return chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join('\n\n');
  }
}
