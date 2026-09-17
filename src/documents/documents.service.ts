import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { EmbeddingProvider } from '../ai/providers/embedding.provider';
import { VectorRepository, ChunkRecord } from '../ai/rag/vector.repository';
import { ChunkingService } from './chunking.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';

export interface DocumentRecord {
  id: string;
  title: string;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorRepository: VectorRepository,
  ) {}

  async ingest(dto: IngestDocumentDto): Promise<DocumentRecord> {
    const documentId = randomUUID();

    await this.db.query(
      `INSERT INTO documents (id, title, source, metadata)
       VALUES ($1, $2, $3, $4)`,
      [documentId, dto.title, dto.source ?? null, dto.metadata ?? {}],
    );

    const textChunks = this.chunkingService.split(dto.content);
    this.logger.log(
      `Split document "${dto.title}" into ${textChunks.length} chunk(s)`,
    );

    if (textChunks.length > 0) {
      const embeddings = await this.embeddingProvider.embedBatch(textChunks);

      const chunkRecords: ChunkRecord[] = textChunks.map((content, index) => ({
        id: randomUUID(),
        documentId,
        chunkIndex: index,
        content,
        embedding: embeddings[index],
        metadata: {},
      }));

      await this.vectorRepository.insertChunks(chunkRecords);
    }

    return this.findOne(documentId);
  }

  async findOne(id: string): Promise<DocumentRecord> {
    const { rows } = await this.db.query(
      `SELECT id, title, source, metadata, created_at AS "createdAt"
       FROM documents WHERE id = $1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return rows[0] as DocumentRecord;
  }

  async findAll(): Promise<DocumentRecord[]> {
    const { rows } = await this.db.query(
      `SELECT id, title, source, metadata, created_at AS "createdAt"
       FROM documents ORDER BY created_at DESC`,
    );

    return rows as DocumentRecord[];
  }

  async remove(id: string): Promise<void> {
    await this.vectorRepository.deleteChunksForDocument(id);
    const { rowCount } = await this.db.query(
      'DELETE FROM documents WHERE id = $1',
      [id],
    );

    if (rowCount === 0) {
      throw new NotFoundException(`Document ${id} not found`);
    }
  }
}
