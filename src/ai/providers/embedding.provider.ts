import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Runs embeddings locally using @xenova/transformers (transformers.js), so no
 * external embedding API or network call is required at query/ingest time.
 * Model weights are downloaded once and cached on disk on first run.
 */
@Injectable()
export class EmbeddingProvider implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingProvider.name);
  private readonly modelName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractor: any;
  private ready: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    this.modelName = this.configService.get<string>(
      'EMBEDDING_MODEL',
      'Xenova/all-MiniLM-L6-v2',
    );
  }

  async onModuleInit() {
    this.ready = this.initialize();
    await this.ready;
  }

  private async initialize() {
    try {
      // Dynamic import: @xenova/transformers ships as an ESM-only package.
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = await pipeline('feature-extraction', this.modelName);
      this.logger.log(`Loaded local embedding model "${this.modelName}"`);
    } catch (err) {
      this.logger.error('Failed to load local embedding model', err as Error);
      throw err;
    }
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (this.ready) await this.ready;

    const vectors: number[][] = [];

    for (const text of texts) {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      vectors.push(Array.from(output.data as Float32Array));
    }

    return vectors;
  }

  /**
   * Formats a JS number array as a pgvector-compatible literal, e.g. '[0.1,0.2,...]'.
   */
  toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
