import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// apps/server runs with cwd=apps/server, but the shared .env lives at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
	port: Number(process.env.PORT) || 8000,
	databaseUrl: process.env.DATABASE_URL,
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
	youtube: {
		dataApiKey: process.env.YOUTUBE_DATA_API_KEY,
	},
	chunking: {
		chunkSize: Number(process.env.CHUNK_SIZE) || 1000,
		chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 200,
	},
	retrieval: {
		topK: Number(process.env.RETRIEVAL_TOP_K) || 4, // per-query-variant candidates from Qdrant
		rrfK: Number(process.env.RRF_K) || 60, // Reciprocal Rank Fusion constant
		finalK: Number(process.env.RETRIEVAL_FINAL_K) || 5, // chunks kept after fusion
	},
	jwt: {
		secret: process.env.JWT_SECRET || "",
		expiresIn: process.env.JWT_EXPIRES_IN || "7d",
	},
};

if (!config.jwt.secret) {
	throw new Error("JWT_SECRET is not set in the environment");
}
