import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { EmbeddingProvider } from "../providers/embedding.provider";

export interface ChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SimilarChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

@Injectable()
export class VectorRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async insertChunks(chunks: ChunkRecord[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.db.withTransaction(async (client) => {
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO document_chunks
            (id, document_id, chunk_index, content, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            chunk.id,
            chunk.documentId,
            chunk.chunkIndex,
            chunk.content,
            this.embeddingProvider.toVectorLiteral(chunk.embedding),
            chunk.metadata,
          ],
        );
      }
    });
  }

  /**
   * Finds the top-K chunks most similar to the given query embedding,
   * using cosine distance (<=>) provided by pgvector.
   */
  async findSimilarChunks(
    queryEmbedding: number[],
    topK = 5,
    documentId?: string,
  ): Promise<SimilarChunk[]> {
    const vectorLiteral =
      this.embeddingProvider.toVectorLiteral(queryEmbedding);

    const params: any[] = [vectorLiteral, topK];
    let documentFilter = "";

    if (documentId) {
      params.push(documentId);
      documentFilter = "WHERE document_id = $3";
    }

    const { rows } = await this.db.query(
      `SELECT
      id,
      document_id AS "documentId",
      content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
   FROM document_chunks
   ${documentFilter}
   ORDER BY embedding <=> $1::vector
   LIMIT $2::int`,
      params,
    );

    return rows as SimilarChunk[];
  }

  async deleteChunksForDocument(documentId: string): Promise<void> {
    await this.db.query("DELETE FROM document_chunks WHERE document_id = $1", [
      documentId,
    ]);
  }
}
