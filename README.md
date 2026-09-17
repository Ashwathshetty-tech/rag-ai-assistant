# RAG AI Assistant

A NestJS boilerplate for a Retrieval-Augmented Generation (RAG) assistant, using:

- **PostgreSQL + [pgvector](https://github.com/pgvector/pgvector)** for vector storage
- **Local embeddings** via [`@xenova/transformers`](https://github.com/xenova/transformers.js) (`Xenova/all-MiniLM-L6-v2`, 384-dim) — runs in-process, no external embedding API or key required
- **[Claude API](https://docs.claude.com/en/api/overview)** (`@anthropic-ai/sdk`, model `claude-sonnet-4-6` by default) for answer generation

## Architecture

```
src/
├── ai/                  # Query-time RAG: controller, service, providers, retrieval
│   ├── providers/        # EmbeddingProvider (local transformers.js), LlmProvider (Claude API)
│   └── rag/               # RagService (orchestration), VectorRepository (pgvector queries)
├── documents/            # Ingestion: upload → chunk → embed → store
│   ├── chunking.service.ts
│   └── dto/
└── database/              # Postgres pool + schema bootstrap (documents, document_chunks)
```

## Prerequisites

- Node.js 20+
- Docker (for Postgres + pgvector), or a Postgres instance with the `vector` extension
- An Anthropic API key for the Claude API (get one at https://console.anthropic.com)
- No embedding API key needed — embeddings run locally; the model (~90MB) downloads
  and is cached on disk the first time the app starts

## Getting started

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in `ANTHROPIC_API_KEY` and adjust `DATABASE_URL` if needed.

2. Start Postgres (with pgvector) and the app via Docker:

   ```bash
   docker compose up --build
   ```

   Or, for local development against Docker's Postgres only:

   ```bash
   docker compose up -d postgres
   npm install
   npm run start:dev
   ```

   The database schema (extension + tables) is created automatically on boot
   (`DatabaseService.onModuleInit`). For production, replace this with a real
   migration tool such as `node-pg-migrate`.

## API

### Ingest a document

```
POST /documents/ingest
Content-Type: application/json

{
  "title": "Company Handbook",
  "content": "Full text of the document...",
  "source": "handbook.pdf",
  "metadata": { "department": "HR" }
}
```

The document is chunked (`CHUNK_SIZE` / `CHUNK_OVERLAP`), each chunk is embedded,
and stored in `document_chunks` alongside its vector embedding.

### List / fetch / delete documents

```
GET    /documents
GET    /documents/:id
DELETE /documents/:id
```

### Ask a question (RAG query)

```
POST /ai/query
Content-Type: application/json

{
  "question": "What is the vacation policy?",
  "documentId": "optional-uuid-to-scope-the-search"
}
```

Returns the generated `answer` plus the `sources` (chunks) used to produce it.

## Environment variables

See `.env.example` for the full list: app port, database URL, vector dimensions,
local embedding model name, Claude model/max tokens, chunking size/overlap, and RAG top-K.

Note: `VECTOR_DIMENSIONS` must match the embedding model's output size (384 for
`Xenova/all-MiniLM-L6-v2`). If you swap in a different local model, update both.

## Testing

```bash
npm run test       # unit tests
npm run test:e2e   # e2e tests
```

## Notes / next steps

- `EmbeddingProvider` and `LlmProvider` are isolated behind small interfaces, so
  you can swap the local model for a hosted embeddings API, or point `LlmProvider`
  at a different model/vendor, without touching `RagService`.
- First embedding call downloads the model weights; consider pre-warming this in
  your deploy pipeline (or baking the cached model into the Docker image) to avoid
  a cold-start delay on the first request.
- Add auth/rate limiting before exposing these endpoints publicly.
- Consider a real migration tool instead of the boot-time `ensureSchema()` call.
- Add streaming responses for `/ai/query` (the Claude API supports `messages.stream`)
  if you want token-by-token output.
