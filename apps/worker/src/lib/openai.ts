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
