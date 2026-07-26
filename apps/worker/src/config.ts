import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// apps/worker runs with cwd=apps/worker, but the shared .env lives at the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
	// A full connection URL (redis://, or rediss:// for TLS — e.g. Upstash) covers
	// both local dev and managed Redis without separate host/port/password/tls fields.
	redis: {
		url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
	},
	qdrant: {
		url: process.env.QDRANT_URL || "http://127.0.0.1:6333",
		// Required by managed Qdrant (e.g. Qdrant Cloud); local dev instances ignore it.
		apiKey: process.env.QDRANT_API_KEY,
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
	googleTts: {
		// API-key auth (not a service account) — Google Cloud Text-to-Speech's REST
		// API accepts a plain `key=` query param, same lightweight pattern as the
		// YouTube Data API key already used for playlist import.
		apiKey: process.env.GOOGLE_TTS_API_KEY,
		voiceNameMale: process.env.GOOGLE_TTS_VOICE_MALE || "en-US-Standard-D",
		voiceNameFemale: process.env.GOOGLE_TTS_VOICE_FEMALE || "en-US-Standard-F",
	},
};
