# RAG Query

Multi-query retrieval + RRF fusion + streamed, grounded, cited answer.

## Route

`POST /notebooks/:notebookId/query` — [apps/server/src/routes/query.ts](../apps/server/src/routes/query.ts) — SSE stream (`SSE_EVENTS`: `token`, `citations`, `done`, `error`).

## Retrieval

[apps/server/src/lib/retriever.ts](../apps/server/src/lib/retriever.ts) `retrieveChunks(collection, query)`:

1. **Query expansion** (parallel):
   - `queryRewriting(query)` — one structured-JSON completion producing `{ stepBack, rewritten, subQueries[3] }`.
   - `hydeDocument(query)` — one plain completion writing a hypothetical answer passage (HyDE), embedded instead of the bare question.
2. **Cross-lingual expansion**: loads the notebook's sources' `metadata.language` (set at ingestion, see [source-ingestion.md](source-ingestion.md)); if any source language differs from the detected query language, translates every variant into that language too (`translateQueries`) and adds them to the variant list. Wrapped in try/catch — falls back to English-only on failure.
3. **Embed every variant**, search the notebook's Qdrant collection per variant (`topK` each, env `RETRIEVAL_TOP_K`).
4. **Reciprocal Rank Fusion**: `score = Σ 1/(k + rank)` across every ranked list a chunk appears in (env `RRF_K`), keep top `finalK` (env `RETRIEVAL_FINAL_K`).

```ts
const [{ stepBack, rewritten, subQueries }, hyde] = await Promise.all([queryRewriting(query), hydeDocument(query)]);
// ... + translated variants if cross-lingual ...
const vectors = await embedTexts(labelled.map((q) => q.text));
const resultsPerQuery = await Promise.all(vectors.map((v) => searchByVector(collection, v)));
const fused = reciprocalRankFusion(rankedLists).slice(0, config.retrieval.finalK);
```

## Answer generation

[apps/server/src/routes/query.ts](../apps/server/src/routes/query.ts):

1. Fused chunk ids → `prisma.chunk.findMany` (with `source`) for citation metadata, ordered by fusion rank (not DB order).
2. Context built as `[n] (source: title)\ntext` blocks.
3. Streamed chat completion, forced grounding:

```ts
content:
	"You are a helpful research assistant. Answer the user's question using ONLY the provided context. " +
	"Cite sources inline using [n] markers matching the numbered context. " +
	"If the answer isn't in the context, say you don't know. Be concise. " +
	"CRITICAL: Answer in the same language as the user's question ...",
```

4. Tokens streamed via SSE as they arrive; `citations` event fires once after the stream ends (each citation carries `locator` for [source-viewer.md](source-viewer.md) to open it).

## No relevant chunks

If `retrieveChunks` returns `[]`, skips the LLM entirely and streams a canned "couldn't find anything relevant" message ([query.ts:38](../apps/server/src/routes/query.ts)).

## Frontend

[apps/web/src/lib/queryStream.ts](../apps/web/src/lib/queryStream.ts) — manually parses the `event: \ndata: \n\n` SSE frames (plain `EventSource` can't POST). [apps/web/src/pages/NotebookDetailPage.tsx](../apps/web/src/pages/NotebookDetailPage.tsx) — chat UI, renders `[n]` markers as clickable citation chips.
