# Learning Roadmap (bonus feature)

Flow: **suggest topics → pick one → retrieval-scoped generation → ordered concept list with citations.**

## Schema

`Roadmap` in [prisma/schema.prisma](../prisma/schema.prisma) — `status` (`PENDING|GENERATING|READY|FAILED`), `topic`, `concepts` (Json). Many rows per notebook — history, not overwritten.

## Topic suggestions

`GET /notebooks/:notebookId/roadmap/topics` → `suggestTopics()` — [apps/server/src/lib/sourceTopics.ts](../apps/server/src/lib/sourceTopics.ts). Cheap: only source titles + 300-char excerpt per source, one structured-JSON completion, runs synchronously (no queue). Shared with [podcast.md](podcast.md) and [flashcards.md](flashcards.md).

## Generation route

`POST /notebooks/:notebookId/roadmap` `{ topic }` — [apps/server/src/routes/roadmap.ts](../apps/server/src/routes/roadmap.ts) — creates a `Roadmap` row (`PENDING`), enqueues, returns 202. `GET /:roadmapId` for polling, `GET /` to list, `DELETE /:roadmapId`.

## Worker job

[apps/worker/src/jobs/generateRoadmap.ts](../apps/worker/src/jobs/generateRoadmap.ts):

```ts
export async function generateRoadmap(roadmapId: string) {
	// status = GENERATING
	const [vector] = await embedTexts([topic]);
	const hits = await searchByVector(notebook.qdrantCollection, vector, RETRIEVAL_TOP_K); // 40
	const chunks = await prisma.chunk.findMany({ where: { id: { in: chunkIds } }, include: { source: true } });

	const rawConcepts = await generateRoadmapConcepts(chunkInputs, topic); // structured JSON

	// drop any citation the model invented instead of reusing a real chunkId
	const concepts = rawConcepts.map(...).filter((c) => c.citations.length > 0);

	// status = READY, concepts stored
}
```

Same retrieval mechanism as chat query (`embedTexts` + `searchByVector` in [apps/worker/src/lib/openai.ts](../apps/worker/src/lib/openai.ts) / [qdrant.ts](../apps/worker/src/lib/qdrant.ts)) — bounds prompt size to `RETRIEVAL_TOP_K` chunks regardless of notebook size, instead of scanning every source.

## LLM schema

`generateRoadmapConcepts` in [apps/worker/src/lib/openai.ts](../apps/worker/src/lib/openai.ts) — `response_format: json_schema, strict: true`:

```
{ concepts: [{ title, summary, orderRank, citations: [{ sourceId, chunkId, timestampSec }] }] }
```

Prompt instructs: reuse `chunkId`/`sourceId` exactly as given, never invent one.

## Citation denormalization

After the LLM responds, each citation is enriched with the real chunk's `sourceTitle`, `sourceType`, `locator`, `text` — same shape as chat's `Citation` type — so the frontend can open `SourceViewer` with no extra fetch.

## Frontend

[apps/web/src/components/RoadmapPanel.tsx](../apps/web/src/components/RoadmapPanel.tsx) — list → topic picker (chips from `/topics` or free text) → detail (polls while generating, renders ordered concepts with clickable citation chips).
