import { Injectable } from '@nestjs/common';
import { RagService, RagAnswer } from './rag/rag.service';

@Injectable()
export class AiService {
  constructor(private readonly ragService: RagService) {}

  async query(question: string, documentId?: string): Promise<RagAnswer> {
    return this.ragService.answerQuestion(question, documentId);
  }
}
