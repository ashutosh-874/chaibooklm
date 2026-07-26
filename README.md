# ChaibookLM

An AI-powered research assistant, inspired by Google NotebookLM: upload sources into isolated notebooks, ask natural-language questions grounded in them, and get streamed answers with inline citations that open the exact source location they came from.

## Features

- **Notebooks** — multiple isolated workspaces, each with its own vector collection. Create/rename/delete.
- **Sources** — PDF, plain text, website URL, YouTube video (+ full playlist import), VTT/SRT transcript (+ batch zip upload). Per-source status: `UPLOADING → INDEXING → READY | FAILED`, with delete and reindex.
- **Chat** — multi-query retrieval (query rewriting, step-back, HyDE, sub-queries), Reciprocal Rank Fusion, cross-lingual retrieval, streamed answers with `[n]` citations.
- **Source Viewer** — click a citation to open the exact spot: PDF page render, text/transcript highlight, YouTube seek-to-timestamp, URL snippet + link.
- **Bonus:**
  - **Learning Roadmap** — pick a topic, get a personalized, citation-linked, ordered concept progression built from a YouTube playlist or any notebook.
  - **Podcast** — pick a topic, get a two-host (Host A/Host B) dialogue script narrated via Google Cloud TTS, with a custom audio player and dialogue transcript.
  - **Flashcards + Quiz** — pick a topic, get a small set of citation-linked flashcards, then generate a multiple-choice quiz from them.

## Architecture

Monorepo, three apps + one shared package:

```
apps/server    Express API — auth, notebooks, sources, SSE chat query, roadmap/podcast/flashcard routes
apps/worker    BullMQ consumers — ingestion pipeline + all generation jobs
apps/web       React 19 + Vite frontend
packages/shared  Prisma client, generated types, Qdrant helpers, queue name/job-data constants
```

- **Postgres** — relational data (`User`, `Notebook`, `Source`, `Chunk`, `Roadmap`, `Podcast`, `FlashcardSet`). Each `Chunk` stores a `locator` (page/offset/timestamp, depending on source type) so citations never need to round-trip through the vector store.
- **Qdrant** — one collection per notebook (`nb_${id}`), not a shared collection filtered by notebook — real isolation, not simulated.
- **Redis** — backs BullMQ for ingestion and all AI-generation jobs, so uploads and long-running generations never block the request/response cycle.

See [docs/README.md](docs/README.md) for a per-feature breakdown with code references, and the table below for direct links.

| Doc | Covers |
|---|---|
| [docs/auth.md](docs/auth.md) | JWT signup/login |
| [docs/notebooks.md](docs/notebooks.md) | CRUD, per-notebook Qdrant isolation |
| [docs/source-ingestion.md](docs/source-ingestion.md) | Extraction, chunking, embedding pipeline for all 5 source types |
| [docs/rag-query.md](docs/rag-query.md) | Retrieval flow — query expansion, RRF fusion, cross-lingual, streamed cited answers |
| [docs/source-viewer.md](docs/source-viewer.md) | Per-type citation viewer |
| [docs/roadmap.md](docs/roadmap.md) | Bonus: learning roadmap |
| [docs/podcast.md](docs/podcast.md) | Bonus: podcast dialogue + TTS |
| [docs/flashcards.md](docs/flashcards.md) | Bonus: flashcards + quiz |

## Retrieval Flow (summary)

1. User submits a question via `POST /notebooks/:id/query` (SSE).
2. Query is expanded into variants: rewritten, step-back, HyDE hypothetical passage, 3 sub-questions — plus translated variants if the notebook's sources are in a different language than the question.
3. Every variant is embedded and searched against the notebook's Qdrant collection.
4. Results are merged with Reciprocal Rank Fusion, keeping the top-K fused chunks.
5. Chunks are assembled into a numbered context block and sent to the LLM with a grounding-only system prompt.
6. The answer streams token-by-token over SSE; citations (with full locator metadata) are sent once the stream completes.

Full detail with code: [docs/rag-query.md](docs/rag-query.md).

## Setup

Prerequisites: [Bun](https://bun.sh), Docker.

```bash
git clone <this-repo>
cd ChaibookLM

docker compose up -d              # Postgres, Qdrant, Redis, MinIO (local S3)
cp .env.example .env              # storage/DB/queue defaults already point at the services above — set OPENAI_API_KEY and JWT_SECRET at minimum
bun install
bun run prisma:migrate

bun run dev:server                # Express API      -> http://localhost:8000
bun run dev:worker                # BullMQ worker (no HTTP port)
bun run dev:web                   # Vite dev server  -> http://localhost:5173
```

Run all three (`server`, `worker`, `web`) concurrently, each in its own terminal.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `REDIS_URL` | ✅ | Redis connection for BullMQ (`redis://` local, `rediss://` TLS for managed Redis e.g. Upstash) |
| `QDRANT_URL` | ✅ | Qdrant REST endpoint |
| `QDRANT_API_KEY` | For managed Qdrant | Required by Qdrant Cloud; unused for local dev |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | ✅ | Object storage for uploaded PDF/VTT files and generated podcast mp3s — required everywhere, since `server` and `worker` don't share a filesystem in production. Defaults to the local MinIO service in `docker-compose.yml` (bucket auto-created by `minio-init`), no cloud account needed for local dev |
| `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | – | Defaults target local MinIO. For production: real AWS S3 (leave `S3_ENDPOINT` blank), or Cloudflare R2 (set `S3_ENDPOINT` to your R2 endpoint, keep `S3_FORCE_PATH_STYLE=true`) |
| `OPENAI_API_KEY` | ✅ | Embeddings + chat completions |
| `JWT_SECRET` | ✅ | Auth token signing |
| `PORT` | – | Server HTTP port (default `8000`) |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | – | Default `text-embedding-3-small` / `1536` |
| `CHAT_MODEL` | – | Default `gpt-4o-mini` |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | – | Default `1000` / `200` |
| `RETRIEVAL_TOP_K`, `RRF_K`, `RETRIEVAL_FINAL_K` | – | Retrieval tuning |
| `JWT_EXPIRES_IN` | – | Default `7d` |
| `YOUTUBE_DATA_API_KEY` | For playlist import | YouTube Data API v3 key |
| `GOOGLE_TTS_API_KEY` | For podcast generation | Google Cloud Text-to-Speech (API-key auth, not a service account) |
| `GOOGLE_TTS_VOICE_MALE`, `GOOGLE_TTS_VOICE_FEMALE` | For podcast generation | Voice names for the two podcast hosts |

Full list with defaults: [.env.example](.env.example).

## Tech Stack

Bun · TypeScript · Express · React 19 + Vite · Prisma + Postgres · Qdrant · Redis + BullMQ · OpenAI (embeddings + chat) · Google Cloud TTS · YouTube Data API v3.
