import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { safeFetchHtml } from "../lib/safeFetch.ts";
import type { ExtractedPage } from "./types.ts";

export interface UrlExtractResult {
	pages: ExtractedPage[];
	title: string | null;
	// The URL actually fetched after following redirects — e.g. a source
	// submitted as a redirector (like Wikipedia's Special:Random) should link
	// back to the real article it resolved to, not the redirector itself.
	finalUrl: string;
}

// Fetches a page and pulls out just the article/body text (strips nav, ads,
// sidebars, etc.) via Readability — the same approach used to clean HTML for
// RAG elsewhere. Wrapped as a single page (num: null), same shape TEXT
// produces, so buildChunks needs no changes to handle URL sources.
export async function extractUrl(url: string): Promise<UrlExtractResult> {
	const { html, finalUrl } = await safeFetchHtml(url);

	// Passing the URL matters: it's what lets Readability resolve relative
	// links/images to absolute ones.
	const dom = new JSDOM(html, { url: finalUrl });
	const article = new Readability(dom.window.document).parse();

	if (!article || !article.textContent?.trim()) {
		throw new Error("Could not extract readable article content from this page");
	}

	return {
		pages: [{ num: null, text: article.textContent }],
		title: article.title?.trim() || null,
		finalUrl,
	};
}
