import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { EmbeddingProvider } from './providers/embedding.provider';
import { LlmProvider } from './providers/llm.provider';
import { RagService } from './rag/rag.service';
import { VectorRepository } from './rag/vector.repository';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    RagService,
    VectorRepository,
    EmbeddingProvider,
    LlmProvider,
  ],
  exports: [AiService, EmbeddingProvider, VectorRepository],
})
export class AiModule {}
