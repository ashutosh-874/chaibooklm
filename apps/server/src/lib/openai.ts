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
