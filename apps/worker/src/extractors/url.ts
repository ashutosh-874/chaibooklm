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

// Below this length, Readability's article-detection heuristic is assumed to
// have thrown away content it misjudged as boilerplate (nav/card grids/lists
// rather than prose) — e.g. AWS product pages that describe a concept in a
// short intro but list the actual answer (which service to use) in a card
// grid Readability drops entirely. In that case we fall back to the full page
// text instead of trusting the trimmed article.
const MIN_ARTICLE_CHARS = 1000;

function extractFullBodyText(document: Document): string {
	for (const el of document.querySelectorAll("script, style, nav, header, footer, noscript")) {
		el.remove();
	}
	return document.body?.textContent ?? "";
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

	let text = article?.textContent?.trim() ?? "";
	
	// Check if Readability discarded a significant portion of the page content.
	// We extract the full body text (minus navigation, headers, footers, etc.)
	// and trigger the fallback if Readability text is under MIN_ARTICLE_CHARS
	// OR if it accounts for less than 50% of the total non-script text.
	const fallbackDom = new JSDOM(html, { url: finalUrl });
	const fullText = extractFullBodyText(fallbackDom.window.document)
		.replace(/\s+/g, " ")
		.trim();

	if (text.length < MIN_ARTICLE_CHARS || text.length < fullText.length * 0.5) {
		if (fullText.length > text.length) {
			text = fullText;
		}
	}

	if (!text) {
		throw new Error("Could not extract readable article content from this page");
	}

	return {
		pages: [{ num: null, text }],
		title: article?.title?.trim() || null,
		finalUrl,
	};
}
