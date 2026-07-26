import crypto from "node:crypto";
import { prisma, SourceStatus, SourceType } from "@chaibooklm/shared";
import { extractPdf } from "../extractors/pdf.ts";
import { extractText } from "../extractors/text.ts";
import { extractUrl } from "../extractors/url.ts";
import { extractVtt } from "../extractors/vtt.ts";
import { extractYoutube } from "../extractors/youtube.ts";
import { buildChunks, chunkTimedSegments } from "../lib/chunk.ts";
import { embedTexts, detectLanguage } from "../lib/openai.ts";
import { deleteSourcePoints, ensureCollection, upsertPoints } from "../lib/qdrant.ts";

// The full per-source pipeline: extract -> chunk -> embed -> upsert to Qdrant
// -> write Chunk rows to Postgres -> mark READY. Any failure marks the source
// FAILED with a readable message and rethrows so BullMQ can retry the job.
export async function ingestSource(sourceId: string) {
	const source = await prisma.source.findUniqueOrThrow({
		where: { id: sourceId },
		include: { notebook: true },
	});

	await prisma.source.update({
		where: { id: sourceId },
		data: { status: SourceStatus.INDEXING, errorMessage: null },
	});

	try {
		// originIdentifier holds a disk path for PDFs and VTT/SRT files, the raw
		// text itself for TEXT, the URL itself for URL sources, and the video ID
		// for YouTube sources.
		let title = source.title;
		let sourceUrl = source.originIdentifier; // overwritten below with the post-redirect URL, for URL sources
		let chunks: Array<{ text: string; locator: Record<string, string | number | null> }>;

		if (source.type === SourceType.YOUTUBE) {
			const result = await extractYoutube(source.originIdentifier);
			// Server set title=videoId as a placeholder when the user didn't provide
			// one — only overwrite it in that case, never a user-chosen title.
			if (result.title && title === source.originIdentifier) title = result.title;
			chunks = chunkTimedSegments(result.segments).map((c) => ({
				text: c.text,
				locator: { ...c.locator, videoId: source.originIdentifier },
			}));
		} else if (source.type === SourceType.VTT) {
			const segments = extractVtt(source.originIdentifier);
			chunks = chunkTimedSegments(segments).map((c) => ({ text: c.text, locator: c.locator }));
		} else {
			let pages: Awaited<ReturnType<typeof extractPdf>>;
			if (source.type === SourceType.PDF) {
				pages = await extractPdf(source.originIdentifier);
			} else if (source.type === SourceType.URL) {
				const result = await extractUrl(source.originIdentifier);
				pages = result.pages;
				sourceUrl = result.finalUrl;
				// Server set title=url as a placeholder when the user didn't provide one —
				// only overwrite it with the page's real title in that case, never a
				// title the user explicitly chose.
				if (result.title && title === source.originIdentifier) title = result.title;
			} else {
				pages = extractText(source.originIdentifier);
			}
			chunks = buildChunks(pages);
		}

		if (chunks.length === 0) {
			throw new Error("No extractable text found in this source");
		}

		const vectors = await embedTexts(chunks.map((c) => c.text));

		// Clear any points/rows from a previous run so reindex replaces rather than duplicates.
		await deleteSourcePoints(source.notebook.qdrantCollection, source.id);
		await prisma.chunk.deleteMany({ where: { sourceId: source.id } });
		await ensureCollection(source.notebook.qdrantCollection);

		// Two ids per chunk: `id` is the Postgres Chunk row, `qdrantPointId` is the
		// Qdrant point — the point's payload carries `id` back as `chunkId` for O(1) lookup.
		// URL chunks get `sourceUrl` folded into the locator so a citation is
		// self-contained for the viewer's "open original" link, no extra join needed.
		const rows = chunks.map((chunk, i) => ({
			id: crypto.randomUUID(),
			qdrantPointId: crypto.randomUUID(),
			chunkIndex: i,
			text: chunk.text,
			locator: source.type === SourceType.URL ? { ...chunk.locator, sourceUrl } : chunk.locator,
		}));

		await upsertPoints(
			source.notebook.qdrantCollection,
			rows.map((row, i) => ({
				id: row.qdrantPointId,
				vector: vectors[i],
				payload: {
					sourceId: source.id,
					notebookId: source.notebookId,
					chunkId: row.id,
					text: row.text,
					sourceTitle: title,
					sourceType: source.type,
				},
			})),
		);

		await prisma.chunk.createMany({
			data: rows.map((row) => ({ ...row, sourceId: source.id })),
		});

		// Detect the language of the source text using the first few chunks
		const textSample = chunks.slice(0, 5).map((c) => c.text).join(" ");
		const language = await detectLanguage(textSample);
		const currentMetadata = (source.metadata as Record<string, any>) || {};
		const updatedMetadata = { ...currentMetadata, language };

		await prisma.source.update({
			where: { id: sourceId },
			data: { status: SourceStatus.READY, title, metadata: updatedMetadata },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Ingestion failed";
		await prisma.source.update({
			where: { id: sourceId },
			data: { status: SourceStatus.FAILED, errorMessage: message },
		});
		throw err; // rethrow so BullMQ counts this attempt as failed and retries
	}
}
