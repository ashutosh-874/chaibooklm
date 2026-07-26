# ChaibookLM Docs

RAG notebook app (NotebookLM-style): notebooks → sources → chat with citations, plus roadmap/podcast/flashcard generation.

## Setup

```bash
docker compose up -d          # postgres, qdrant, redis
cp .env.example .env          # fill in OPENAI_API_KEY at minimum
bun install
bun run prisma:migrate
bun run dev:server            # apps/server — Express API
bun run dev:worker            # apps/worker — BullMQ consumer
bun run dev:web               # apps/web — React
```

## Architecture

- `apps/server` — Express API, Prisma/Postgres, Qdrant client, BullMQ producers, SSE query endpoint.
- `apps/worker` — BullMQ consumers: ingestion + all generation jobs (roadmap/podcast/flashcards).
- `apps/web` — React 19 + Vite frontend.
- `packages/shared` — Prisma client, generated types, Qdrant helpers, queue name/job-data constants — imported by both `server` and `worker`.

Postgres stores relational data (Notebook/Source/Chunk/Roadmap/Podcast/FlashcardSet) and each chunk's `locator` (for citations). Qdrant stores one collection per notebook (`nb_${id}`) for vector search. Redis backs BullMQ.

## Feature docs

| File | Covers |
|---|---|
| [auth.md](auth.md) | JWT signup/login, `requireAuth` middleware |
| [notebooks.md](notebooks.md) | CRUD, per-notebook Qdrant isolation, ownership checks |
| [source-ingestion.md](source-ingestion.md) | PDF/TEXT/URL/YouTube/VTT extraction, chunking, embedding pipeline |
| [rag-query.md](rag-query.md) | Multi-query retrieval, RRF fusion, cross-lingual expansion, streamed cited answers |
| [source-viewer.md](source-viewer.md) | Per-type citation viewer (PDF page, text highlight, YouTube timestamp, etc.) |
| [roadmap.md](roadmap.md) | Bonus: topic-scoped learning roadmap generation |
| [podcast.md](podcast.md) | Bonus: topic-scoped podcast script + Google TTS narration |
| [flashcards.md](flashcards.md) | Bonus: flashcard generation + quiz |

## Env vars

See [.env.example](../.env.example) at repo root — grouped by: Postgres/Redis/Qdrant connection, `OPENAI_API_KEY` + model config, `YOUTUBE_DATA_API_KEY` (playlist import), `GOOGLE_TTS_API_KEY` + voice names (podcast), `JWT_SECRET`, chunking/retrieval tuning.
