import crypto from "node:crypto";
import { prisma, SourceStatus, SourceType } from "@chaibooklm/shared";
import { extractPdf } from "../extractors/pdf.ts";
import { extractText } from "../extractors/text.ts";
import { buildChunks } from "../lib/chunk.ts";
import { embedTexts } from "../lib/openai.ts";
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
		// originIdentifier holds a disk path for PDFs, the raw text itself for TEXT.
		const pages =
			source.type === SourceType.PDF ? await extractPdf(source.originIdentifier) : extractText(source.originIdentifier);

		const chunks = buildChunks(pages);
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
		const rows = chunks.map((chunk, i) => ({
			id: crypto.randomUUID(),
			qdrantPointId: crypto.randomUUID(),
			chunkIndex: i,
			text: chunk.text,
			locator: chunk.locator,
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
					sourceTitle: source.title,
					sourceType: source.type,
				},
			})),
		);

		await prisma.chunk.createMany({
			data: rows.map((row) => ({ ...row, sourceId: source.id })),
		});

		await prisma.source.update({ where: { id: sourceId }, data: { status: SourceStatus.READY } });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Ingestion failed";
		await prisma.source.update({
			where: { id: sourceId },
			data: { status: SourceStatus.FAILED, errorMessage: message },
		});
		throw err; // rethrow so BullMQ counts this attempt as failed and retries
	}
}
