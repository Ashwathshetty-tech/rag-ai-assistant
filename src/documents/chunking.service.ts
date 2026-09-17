import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(private readonly configService: ConfigService) {
    this.chunkSize = this.configService.get<number>('CHUNK_SIZE', 1000);
    this.chunkOverlap = this.configService.get<number>('CHUNK_OVERLAP', 150);
  }

  /**
   * Splits text into overlapping chunks by character count, breaking on
   * sentence/paragraph boundaries where possible to keep chunks coherent.
   */
  split(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length === 0) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
      let end = Math.min(start + this.chunkSize, normalized.length);

      if (end < normalized.length) {
        const boundary = this.findBoundary(normalized, start, end);
        if (boundary > start) {
          end = boundary;
        }
      }

      const chunk = normalized.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      if (end >= normalized.length) break;

      start = Math.max(end - this.chunkOverlap, start + 1);
    }

    return chunks;
  }

  private findBoundary(text: string, start: number, end: number): number {
    const window = text.slice(start, end);
    const lastParagraph = window.lastIndexOf('\n\n');
    const lastSentence = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('.\n'),
    );

    const relativeBoundary = lastParagraph > -1 ? lastParagraph + 2 : lastSentence + 1;

    return relativeBoundary > 0 ? start + relativeBoundary : end;
  }
}
