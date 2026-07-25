import type { ExtractedPage } from "./types.ts";

// TEXT sources are just the raw string submitted at upload time — no
// extraction needed, only wrapped as a single page (num: null, no page concept).
export function extractText(raw: string): ExtractedPage[] {
	return [{ num: null, text: raw }];
}
