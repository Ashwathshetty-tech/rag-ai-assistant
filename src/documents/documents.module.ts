import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ChunkingService } from './chunking.service';

@Module({
  imports: [AiModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ChunkingService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
