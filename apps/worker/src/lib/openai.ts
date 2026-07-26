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
