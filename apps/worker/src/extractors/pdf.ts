import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import type { ExtractedPage } from "./types.ts";

// Reads a PDF from disk and returns its text broken down per page, so each
// chunk built from it can carry a real page number for citations.
export async function extractPdf(filePath: string): Promise<ExtractedPage[]> {
	const data = await fs.readFile(filePath);
	const parser = new PDFParse({ data });
	try {
		const result = await parser.getText();
		return result.pages.map((page) => ({ num: page.num, text: page.text }));
	} finally {
		await parser.destroy();
	}
}
