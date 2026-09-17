import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get<string>('DATABASE_URL'),
    });
  }

  async onModuleInit() {
    await this.ensureSchema();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(
    handler: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Creates the pgvector extension and base tables if they do not exist yet.
   * For production use, prefer a proper migration tool (e.g. node-pg-migrate).
   */
  private async ensureSchema() {
    // Defaults to 384 to match the local embedding model (Xenova/all-MiniLM-L6-v2).
    const dimensions = this.configService.get<number>(
      'VECTOR_DIMENSIONS',
      384,
    );

    try {
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          source TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY,
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          chunk_index INT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(${dimensions}),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
        ON document_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

      this.logger.log('Database schema is ready');
    } catch (err) {
      this.logger.error('Failed to initialize database schema', err as Error);
      throw err;
    }
  }
}
