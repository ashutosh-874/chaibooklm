// Common shape both extractors produce, so the chunker doesn't need to know
// which source type it's chunking. `num` is a real page number for PDFs,
// `null` for sources with no page concept (TEXT) — that's what tells the
// chunker whether to include `page` in each chunk's locator.
export interface ExtractedPage {
	num: number | null;
	text: string;
}
