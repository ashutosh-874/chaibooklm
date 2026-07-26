import OpenAI from "openai";
import { config } from "../config.ts";

export const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Embeds many chunks in one call each, batched to stay within OpenAI's per-request item limit.
export async function embedTexts(texts: string[], batchSize = 100): Promise<number[][]> {
	const vectors: number[][] = [];
	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);
		const res = await openai.embeddings.create({
			model: config.openai.embeddingModel,
			input: batch,
		});
		for (const item of res.data) vectors.push(item.embedding);
	}
	return vectors;
}

// Detect the ISO 639-1 language code of a given text snippet using OpenAI chat completions.
export async function detectLanguage(text: string): Promise<string> {
	if (!text.trim()) return "en";
	try {
		const response = await openai.chat.completions.create({
			model: config.openai.chatModel,
			temperature: 0.0,
			messages: [
				{
					role: "system",
					content:
						"You are a language detection utility. Respond ONLY with the ISO 639-1 two-letter language code " +
						"(e.g., 'en', 'hi', 'es', 'fr') of the input text.",
				},
				{ role: "user", content: text.substring(0, 1000) },
			],
		});
		const code = response.choices[0]?.message?.content?.trim().toLowerCase() || "en";
		return code.split("-")[0].substring(0, 2);
	} catch (error) {
		console.error("Language detection failed, defaulting to 'en':", error);
		return "en";
	}
}

export interface RoadmapConceptCitation {
	sourceId: string;
	chunkId: string;
	timestampSec: number | null;
}

export interface RoadmapConcept {
	title: string;
	summary: string;
	orderRank: number;
	citations: RoadmapConceptCitation[];
}

interface RoadmapChunkInput {
	sourceId: string;
	sourceTitle: string;
	chunkId: string;
	timestampSec: number | null;
	text: string;
}

// Structured chat completion that turns a flattened list of chunks (grouped by
// source) into an ordered learning roadmap — same response_format/json_schema
// pattern as queryRewriting in apps/server/src/lib/retriever.ts.
export async function generateRoadmapConcepts(chunks: RoadmapChunkInput[], topic: string): Promise<RoadmapConcept[]> {
	const bySource = new Map<string, RoadmapChunkInput[]>();
	for (const chunk of chunks) {
		const list = bySource.get(chunk.sourceId) ?? [];
		list.push(chunk);
		bySource.set(chunk.sourceId, list);
	}

	const context = [...bySource.entries()]
		.map(([sourceId, items]) => {
			const title = items[0]?.sourceTitle ?? sourceId;
			const body = items.map((c) => `  [chunkId=${c.chunkId} timestampSec=${c.timestampSec ?? "null"}] ${c.text}`).join("\n");
			return `Source ${sourceId} ("${title}"):\n${body}`;
		})
		.join("\n\n");

	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.2,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "learning_roadmap",
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						concepts: {
							type: "array",
							description: "An ordered list of concepts a learner should progress through, from foundational to advanced.",
							items: {
								type: "object",
								additionalProperties: false,
								properties: {
									title: { type: "string", description: "Short concept name." },
									summary: { type: "string", description: "1-2 sentence explanation of the concept." },
									orderRank: { type: "integer", description: "Position in the learning progression, starting at 1." },
									citations: {
										type: "array",
										description: "Chunks where this concept is first substantively covered. MUST reuse chunkId/sourceId values exactly as given in the context — never invent one.",
										items: {
											type: "object",
											additionalProperties: false,
											properties: {
												sourceId: { type: "string" },
												chunkId: { type: "string" },
												timestampSec: { type: ["number", "null"] },
											},
											required: ["sourceId", "chunkId", "timestampSec"],
										},
									},
								},
								required: ["title", "summary", "orderRank", "citations"],
							},
						},
					},
					required: ["concepts"],
				},
			},
		},
		messages: [
			{
				role: "system",
				content:
					`You are a curriculum designer. The learner wants a roadmap for the topic: "${topic}". Given excerpts ` +
					"from a set of video/document sources (already filtered for relevance to this topic), identify the distinct " +
					"concepts a learner needs to progress through to understand it, in a sensible learning order (foundational " +
					"concepts first). For each concept, cite the chunk(s) where it's first substantively covered, reusing the exact " +
					"sourceId/chunkId/timestampSec values given in the context. Respond ONLY with the structured JSON.",
			},
			{ role: "user", content: context },
		],
	});

	const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
	return Array.isArray(parsed.concepts) ? parsed.concepts : [];
}

export interface FlashcardCitation {
	sourceId: string;
	chunkId: string;
	timestampSec: number | null;
}

export interface Flashcard {
	front: string;
	back: string;
	citation: FlashcardCitation;
}

// Structured chat completion producing a small set of Q&A-style flashcards for
// a topic — same response_format/json_schema pattern and RoadmapChunkInput
// shape as generateRoadmapConcepts, just a flatter output (one citation per
// card instead of a citations array) since each card tests one fact.
export async function generateFlashcards(chunks: RoadmapChunkInput[], topic: string): Promise<Flashcard[]> {
	const bySource = new Map<string, RoadmapChunkInput[]>();
	for (const chunk of chunks) {
		const list = bySource.get(chunk.sourceId) ?? [];
		list.push(chunk);
		bySource.set(chunk.sourceId, list);
	}

	const context = [...bySource.entries()]
		.map(([sourceId, items]) => {
			const title = items[0]?.sourceTitle ?? sourceId;
			const body = items.map((c) => `  [chunkId=${c.chunkId} timestampSec=${c.timestampSec ?? "null"}] ${c.text}`).join("\n");
			return `Source ${sourceId} ("${title}"):\n${body}`;
		})
		.join("\n\n");

	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.3,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "flashcards",
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						flashcards: {
							type: "array",
							description: "6-10 concise question/answer flashcards a learner could use to study this topic.",
							items: {
								type: "object",
								additionalProperties: false,
								properties: {
									front: { type: "string", description: "A short question or prompt." },
									back: { type: "string", description: "The concise answer, 1-2 sentences." },
									sourceId: { type: "string" },
									chunkId: { type: "string", description: "MUST reuse a chunkId exactly as given in the context — never invent one." },
									timestampSec: { type: ["number", "null"] },
								},
								required: ["front", "back", "sourceId", "chunkId", "timestampSec"],
							},
						},
					},
					required: ["flashcards"],
				},
			},
		},
		messages: [
			{
				role: "system",
				content:
					`You are a study-flashcard writer. The learner wants flashcards for the topic: "${topic}". Given excerpts ` +
					"from a set of sources (already filtered for relevance to this topic), write 6-10 flashcards, each testing one " +
					"specific fact or concept from the excerpts. Keep the front short (a question or prompt) and the back concise " +
					"(1-2 sentences). For each card, cite the chunk it's drawn from, reusing the exact sourceId/chunkId/timestampSec " +
					"values given in the context. Respond ONLY with the structured JSON.",
			},
			{ role: "user", content: context },
		],
	});

	const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
	if (!Array.isArray(parsed.flashcards)) return [];

	return parsed.flashcards.map((c: { front: string; back: string; sourceId: string; chunkId: string; timestampSec: number | null }) => ({
		front: c.front,
		back: c.back,
		citation: { sourceId: c.sourceId, chunkId: c.chunkId, timestampSec: c.timestampSec },
	}));
}

interface PodcastSourceInput {
	title: string;
	excerpt: string;
}

// Plain-text generation (no structured JSON) — same style as hydeDocument in
// apps/server/src/lib/retriever.ts, just producing a full spoken-style script
// instead of a short hypothetical passage.
export async function generatePodcastScript(sources: PodcastSourceInput[], topic: string): Promise<string> {
	const context = sources.map((s) => `Source: "${s.title}"\n${s.excerpt}`).join("\n\n");

	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.4,
		messages: [
			{
				role: "system",
				content:
					`You are a podcast host writing a solo narration script about the topic: "${topic}". Given excerpts from a ` +
					"set of sources (already filtered for relevance to this topic), write a natural, spoken-style script (not " +
					"bullet points, not markdown) that explains this topic by summarizing and connecting the key ideas across " +
					"the excerpts, in a conversational tone suitable for text-to-speech narration. Aim for roughly 700-1000 words " +
					"(a few minutes of spoken audio). Do not include stage directions, sound effect cues, or headings — just the " +
					"words to be spoken aloud.",
			},
			{ role: "user", content: context },
		],
	});

	return completion.choices[0]?.message?.content?.trim() ?? "";
}
