import { PDFParse } from "pdf-parse";
import type { ExtractedPage } from "./types.ts";

// Parses a PDF buffer (already downloaded from S3 by the caller) and returns
// its text broken down per page, so each chunk built from it can carry a
// real page number for citations.
export async function extractPdf(data: Buffer): Promise<ExtractedPage[]> {
	const parser = new PDFParse({ data });
	try {
		const result = await parser.getText();
		return result.pages.map((page) => ({ num: page.num, text: page.text }));
	} finally {
		await parser.destroy();
	}
}
