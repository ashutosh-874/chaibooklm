# Source Ingestion

Pipeline: **extract → chunk → embed → upsert to Qdrant → write Chunk rows → mark READY**.

## Entry points

[apps/server/src/routes/sources.ts](../apps/server/src/routes/sources.ts):

| Route | Type created |
|---|---|
| `POST /` (multipart `file`) | `PDF` or `VTT` (by extension) |
| `POST /` (`{ text }`) | `TEXT` |
| `POST /` (`{ url }`) | `URL` |
| `POST /` (`{ video }`) | `YOUTUBE` |
| `POST /youtube-playlist` (`{ playlistUrl }`) | many `YOUTUBE` rows, one per video |
| `POST /vtt-zip` (multipart `file`) | many `VTT` rows, one per transcript in the zip |
| `DELETE /:sourceId` | removes Qdrant points + Postgres cascade + disk file |
| `POST /:sourceId/reindex` | resets to `UPLOADING`, re-enqueues |

Every create path ends in `enqueueIngestJob(source.id)` — [apps/server/src/lib/queue.ts](../apps/server/src/lib/queue.ts).

## Status lifecycle

`UPLOADING → INDEXING → READY | FAILED` — enum in [prisma/schema.prisma](../prisma/schema.prisma).

## Worker job

[apps/worker/src/jobs/ingestSource.ts](../apps/worker/src/jobs/ingestSource.ts)

```ts
export async function ingestSource(sourceId: string) {
	// ... set status = INDEXING
	// 1. extract by type
	if (source.type === SourceType.YOUTUBE) {
		const result = await extractYoutube(source.originIdentifier);
		chunks = chunkTimedSegments(result.segments).map(...);
	} else if (source.type === SourceType.VTT) {
		chunks = chunkTimedSegments(extractVtt(source.originIdentifier)).map(...);
	} else {
		// PDF / URL / TEXT -> pages, then
		chunks = buildChunks(pages);
	}

	// 2. embed
	const vectors = await embedTexts(chunks.map((c) => c.text));

	// 3. upsert to Qdrant + write Chunk rows
	await upsertPoints(source.notebook.qdrantCollection, ...);
	await prisma.chunk.createMany({ data: rows });

	// 4. mark READY
	await prisma.source.update({ data: { status: SourceStatus.READY, title } });
}
```

## Extractors (one per source type)

- [apps/worker/src/extractors/pdf.ts](../apps/worker/src/extractors/pdf.ts) — `pdf-parse`, returns `{ num, text }[]` pages.
- [apps/worker/src/extractors/text.ts](../apps/worker/src/extractors/text.ts) — wraps raw string as one page.
- [apps/worker/src/extractors/url.ts](../apps/worker/src/extractors/url.ts) — `safeFetchHtml` (SSRF-guarded, see below) + Mozilla Readability; falls back to full-body text if Readability keeps <50% of the page (misjudges card/grid content as boilerplate).
- [apps/worker/src/extractors/youtube.ts](../apps/worker/src/extractors/youtube.ts) — `youtube-caption-extractor`, falls back to any available caption track (not just English).
- [apps/worker/src/extractors/vtt.ts](../apps/worker/src/extractors/vtt.ts) — parses `.vtt`/`.srt` into timed segments.

### SSRF guard

[apps/worker/src/lib/safeFetch.ts](../apps/worker/src/lib/safeFetch.ts) — rejects private/reserved IPs, re-validates on every redirect hop, caps timeout (10s) and response size (5MB). Used by `extractUrl` before any URL source is fetched.

### YouTube playlist import

[apps/server/src/lib/youtubePlaylist.ts](../apps/server/src/lib/youtubePlaylist.ts) — `resolvePlaylistVideoIds()` calls the YouTube Data API v3 (`playlistItems.list`, paginated, capped at 50 videos), then `POST /sources/youtube-playlist` creates one `Source` per video, each ingested independently through the same pipeline above.

## Chunking

[apps/worker/src/lib/chunk.ts](../apps/worker/src/lib/chunk.ts):
- `chunkTextWithOffsets` — char-based, `CHUNK_SIZE`/`CHUNK_OVERLAP` env vars (default 1000/200), breaks on whitespace, tracks `charStart`/`charEnd`.
- `chunkTimedSegments` — groups transcript segments up to `maxChars`, tracks `startSec`/`endSec` instead of char offsets.
- `buildChunks` — runs `chunkTextWithOffsets` per page for PDF/URL/TEXT, attaches `page` to the locator for PDFs.

## Locator shapes (per source type)

Stored on `Chunk.locator` (Json) and denormalized into the Qdrant payload:
- PDF: `{ page, charStart, charEnd }`
- TEXT: `{ charStart, charEnd }`
- URL: `{ charStart, charEnd, sourceUrl }`
- YOUTUBE / VTT: `{ startSec, endSec, videoId? }`

## Cross-lingual note

`detectLanguage()` runs after ingestion, stores the detected language on `Source.metadata.language` — used later by the query pipeline for cross-lingual retrieval (see [rag-query.md](rag-query.md)).
