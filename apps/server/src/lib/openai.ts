import OpenAI from "openai";
import { config } from "../config.ts";

// Separate from apps/worker's client: query-time embedding + chat completion
// run synchronously inside the request handler (SSE), not through the queue.
export const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function embedText(text: string): Promise<number[]> {
	const res = await openai.embeddings.create({ model: config.openai.embeddingModel, input: text });
	return res.data[0].embedding;
}

// Embeds many texts in one call each, batched to stay within OpenAI's per-request item limit.
export async function embedTexts(texts: string[], batchSize = 100): Promise<number[][]> {
	const vectors: number[][] = [];
	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);
		const res = await openai.embeddings.create({ model: config.openai.embeddingModel, input: batch });
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

// Translate a list of query strings into a target language using structured JSON output.
export async function translateQueries(queries: string[], targetLang: string): Promise<string[]> {
	if (queries.length === 0) return [];
	try {
		const completion = await openai.chat.completions.create({
			model: config.openai.chatModel,
			temperature: 0.1,
			response_format: {
				type: "json_schema",
				json_schema: {
					name: "query_translation",
					strict: true,
					schema: {
						type: "object",
						additionalProperties: false,
						properties: {
							translations: {
								type: "array",
								description: "The translated queries in the exact same order.",
								items: { type: "string" },
							},
						},
						required: ["translations"],
					},
				},
			},
			messages: [
				{
					role: "system",
					content:
						`You are a translation assistant. Translate the following queries into the language specified ` +
						`by the ISO 639-1 code: '${targetLang}'. Respond ONLY with the JSON object matching the schema.`,
				},
				{ role: "user", content: JSON.stringify({ queries }) },
			],
		});
		const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
		return Array.isArray(parsed.translations) ? parsed.translations : queries;
	} catch (error) {
		console.error(`Failed to translate queries to ${targetLang}:`, error);
		return queries; // Fallback to original queries if translation fails
	}
}
