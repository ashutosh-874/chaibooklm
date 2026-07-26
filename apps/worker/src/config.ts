import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// apps/worker runs with cwd=apps/worker, but the shared .env lives at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
	redis: {
		host: process.env.REDIS_HOST || "127.0.0.1",
		port: Number(process.env.REDIS_PORT) || 6379,
	},
	qdrant: {
		url: process.env.QDRANT_URL || "http://127.0.0.1:6333",
	},
	openai: {
		apiKey: process.env.OPENAI_API_KEY,
		embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
		embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 1536,
		chatModel: process.env.CHAT_MODEL || "gpt-4o-mini",
	},
	chunking: {
		chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
		chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
	},
};
