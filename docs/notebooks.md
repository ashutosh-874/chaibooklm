# Notebooks

A notebook is an isolated knowledge base: its own Qdrant collection, its own sources, its own generated artifacts (roadmaps/podcasts/flashcards).

## Routes

[apps/server/src/routes/notebooks.ts](../apps/server/src/routes/notebooks.ts) — mounted at `/notebooks`:

| Method | Path | Does |
|---|---|---|
| GET | `/` | list, scoped to `req.userId` |
| GET | `/:id` | single, via `getOwnedNotebook` |
| POST | `/` | create |
| PATCH | `/:id` | rename |
| DELETE | `/:id` | delete + cascade cleanup |

## Isolation

Each notebook gets its own Qdrant collection, not a shared collection filtered by `notebookId`:

```ts
// apps/server/src/routes/notebooks.ts — POST /
const id = crypto.randomUUID();
const qdrantCollection = `nb_${id}`;
await ensureCollection(qdrantCollection);
const notebook = await prisma.notebook.create({
	data: { id, name: parsed.data.name, userId: req.userId, qdrantCollection },
});
```

Every downstream feature (ingestion, chat retrieval, roadmap/podcast/flashcard generation) reads `notebook.qdrantCollection` to know which collection to search — never a global one.

## Ownership check

Reused across every notebook-scoped router (sources, query, roadmap, podcast, flashcards):

```ts
// apps/server/src/lib/ownership.ts
export async function getOwnedNotebook(notebookId: string, userId?: string) {
	return prisma.notebook.findFirst({ where: { id: notebookId, userId } });
}
```

Returns `null` (→ 404) if the notebook doesn't exist *or* belongs to another user — never leaks existence to non-owners.

## Delete cascade

`DELETE /:id`:
1. Best-effort unlink on-disk PDF/VTT files (Postgres cascade handles `Source`/`Chunk` rows, not disk files).
2. `deleteCollection(notebook.qdrantCollection)` — drops the Qdrant collection.
3. `prisma.notebook.delete` — cascades to `Source`, `Chunk`, `Roadmap`, `Podcast`, `FlashcardSet` rows (all have `onDelete: Cascade` in [prisma/schema.prisma](../prisma/schema.prisma)).

## Frontend

[apps/web/src/pages/NotebooksPage.tsx](../apps/web/src/pages/NotebooksPage.tsx) — list/create/rename/delete UI.
