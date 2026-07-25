import { config } from "../config.ts";
import type { ExtractedPage } from "../extractors/types.ts";

export interface TextChunk {
	text: string;
	charStart: number;
	charEnd: number;
}

// Ported from advance-rag-pipeline's chunkText, extended to also return each
// chunk's offset (needed for the locator) instead of just the chunk string.
// Offsets are into the whitespace-normalized text below, not the raw input.
function chunkTextWithOffsets(
	text: string,
	chunkSize = config.chunking.chunkSize,
	overlap = config.chunking.chunkOverlap,
): TextChunk[] {
	const clean = text.replace(/\s+/g, " ").trim();
	if (!clean) return [];

	const chunks: TextChunk[] = [];
	let start = 0;

	while (start < clean.length) {
		let end = Math.min(start + chunkSize, clean.length);

		// Try to end on a space so we don't cut words in half.
		if (end < clean.length) {
			const lastSpace = clean.lastIndexOf(" ", end);
			if (lastSpace > start) end = lastSpace;
		}

		const chunkText = clean.slice(start, end).trim();
		if (chunkText) chunks.push({ text: chunkText, charStart: start, charEnd: end });

		if (end >= clean.length) break;
		start = end - overlap; // step forward with overlap
		if (start < 0) start = 0;
	}

	return chunks;
}

export interface LocatedChunk {
	text: string;
	locator: { page: number; charStart: number; charEnd: number } | { charStart: number; charEnd: number };
}

// Chunks every page independently (so offsets stay page-relative) and attaches
// each source type's locator shape: PDF chunks get `page`, TEXT chunks don't.
export function buildChunks(pages: ExtractedPage[]): LocatedChunk[] {
	const chunks: LocatedChunk[] = [];
	for (const page of pages) {
		for (const c of chunkTextWithOffsets(page.text)) {
			chunks.push({
				text: c.text,
				locator:
					page.num === null
						? { charStart: c.charStart, charEnd: c.charEnd }
						: { page: page.num, charStart: c.charStart, charEnd: c.charEnd },
			});
		}
	}
	return chunks;
}
