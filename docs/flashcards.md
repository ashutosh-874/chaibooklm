# Flashcards + Quiz

Flow: **suggested topics → create flashcards → few flashcards → quiz flashcards.**

## Schema

`FlashcardSet` in [prisma/schema.prisma](../prisma/schema.prisma) — single linear `status`:

```
PENDING -> GENERATING -> CARDS_READY -> GENERATING_QUIZ -> QUIZ_READY  (or FAILED)
```

Fields: `topic`, `flashcards` (Json, citation-linked cards), `quiz` (Json, MCQ questions). Many rows per notebook.

## Topic suggestions

Same `suggestTopics()` as roadmap/podcast — `GET /notebooks/:notebookId/flashcards/topics`.

## Card generation (queued — needs retrieval)

`POST /notebooks/:notebookId/flashcards` `{ topic }` — [apps/server/src/routes/flashcards.ts](../apps/server/src/routes/flashcards.ts) — creates row, enqueues `FLASHCARD_QUEUE_NAME` job.

[apps/worker/src/jobs/generateFlashcards.ts](../apps/worker/src/jobs/generateFlashcards.ts):

```ts
export async function generateFlashcards(flashcardSetId: string) {
	// status = GENERATING
	const [vector] = await embedTexts([topic]);
	const hits = await searchByVector(notebook.qdrantCollection, vector, RETRIEVAL_TOP_K); // 30
	const rawCards = await generateFlashcardsLLM(chunkInputs, topic); // structured JSON

	// enrich each card's citation with real chunk/source data; drop citation
	// (not the whole card) if the model invented a chunkId
	// status = CARDS_READY
}
```

Same topic-embed → Qdrant-search pattern as [roadmap.md](roadmap.md). LLM schema (`generateFlashcards` in [apps/worker/src/lib/openai.ts](../apps/worker/src/lib/openai.ts)):

```
{ flashcards: [{ front, back, sourceId, chunkId, timestampSec }] }
```
6-10 cards, each citing the exact chunk it's drawn from.

## Quiz generation (synchronous — no queue)

`POST /notebooks/:notebookId/flashcards/:setId/quiz` — [apps/server/src/routes/flashcards.ts](../apps/server/src/routes/flashcards.ts). Unlike card generation, the quiz's only input is the small set of already-generated flashcard text already in Postgres — no retrieval needed, so it runs inline in the request handler and returns immediately (no polling):

```ts
// apps/server/src/lib/quiz.ts
export async function generateQuiz(flashcards: FlashcardInput[]): Promise<QuizQuestion[]> {
	// one structured-JSON completion: { quiz: [{ question, options[4], correctIndex, explanation }] }
	// defensive filter: drop any question with != 4 options or an out-of-range correctIndex
}
```

Sets `status = QUIZ_READY` and stores `quiz` on the same row.

## Frontend

[apps/web/src/components/FlashcardPanel.tsx](../apps/web/src/components/FlashcardPanel.tsx):
- List → topic picker → detail (same 3-view pattern as [roadmap.md](roadmap.md)/[podcast.md](podcast.md)).
- Cards render in a grid, click-to-flip (front/back), citation chip on the answer side opens `SourceViewer` (see [source-viewer.md](source-viewer.md)).
- "Generate quiz" button appears once `CARDS_READY`. Quiz renders as MCQ (lettered options A–D); selecting an option then "Submit" reveals correct/incorrect (green/red, using the app's `--color-success-*`/`--color-danger-*` tokens) + `explanation`, plus a running score.
