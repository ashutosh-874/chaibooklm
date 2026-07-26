# Source Viewer

Opens the original source at the exact cited location. Dispatches on `citation.sourceType`.

## Entry point

[apps/web/src/components/SourceViewer.tsx](../apps/web/src/components/SourceViewer.tsx) — modal, takes a `Citation` (see [rag-query.md](rag-query.md)) and the matching `Source`.

```tsx
citation.sourceType === "PDF" ? (
	<PdfViewer token={token} notebookId={notebookId} sourceId={source.id} page={citation.locator.page ?? 1} />
) : citation.sourceType === "TEXT" ? (
	<TextViewer text={source.originIdentifier} charStart={citation.locator.charStart} charEnd={citation.locator.charEnd} />
) : citation.sourceType === "URL" ? (
	<mark>{citation.text}</mark> // + "open original page" link
) : citation.sourceType === "YOUTUBE" ? (
	<iframe src={`https://www.youtube.com/embed/${videoId}?start=${startSec}`} />
) : citation.sourceType === "VTT" ? (
	<mark>{citation.text}</mark>
) : null
```

## Per-type behavior

| Type | Behavior | Component |
|---|---|---|
| PDF | Renders the actual page via `react-pdf`, seeks to `locator.page` | [PdfViewer.tsx](../apps/web/src/components/PdfViewer.tsx) |
| TEXT | Highlights `charStart`–`charEnd` span within the full stored text | [TextViewer.tsx](../apps/web/src/components/TextViewer.tsx) |
| URL | Shows the cited chunk text (no full document stored) + link to the live page | inline in `SourceViewer.tsx` |
| YOUTUBE | Embeds the video, seeks to `locator.startSec` | inline `<iframe>` |
| VTT | Highlights the cited transcript chunk text | inline in `SourceViewer.tsx` |

## PDF byte serving

`PdfViewer` needs the actual file, not metadata — fetched via `GET /notebooks/:notebookId/sources/:sourceId/file` ([sources.ts](../apps/server/src/routes/sources.ts)), which streams the on-disk PDF (`res.sendFile`). `TEXT` sources need no equivalent — their content is the `originIdentifier` string already returned by `GET /sources`.

## Reused outside chat

Roadmap and Flashcard citations are denormalized at generation time into the same `Citation`-compatible shape (`chunkId, sourceId, sourceTitle, sourceType, locator, text`), so `SourceViewer` opens them with zero extra fetches — see [roadmap.md](roadmap.md) and [flashcards.md](flashcards.md).
