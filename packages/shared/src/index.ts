// Kinds of sources a notebook can ingest; drives extraction + locator shape per type.
export const SourceType = {
	PDF: "PDF",
	TEXT: "TEXT",
	URL: "URL",
	YOUTUBE: "YOUTUBE",
	VTT: "VTT",
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

// Lifecycle of a source through the ingestion worker.
export const SourceStatus = {
	UPLOADING: "UPLOADING",
	INDEXING: "INDEXING",
	READY: "READY",
	FAILED: "FAILED",
} as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

// Event names used on the query SSE stream (server) and EventSource listeners (web).
export const SSE_EVENTS = {
	TOKEN: "token",
	CITATIONS: "citations",
	DONE: "done",
	ERROR: "error",
	SOURCE_STATUS: "source_status",
} as const;
export type SSEEvent = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];

// BullMQ queue name shared by the server (enqueue) and worker (consume).
export const INGEST_QUEUE_NAME = "ingest-source";

// Shape of the job payload the server enqueues and the worker consumes.
export interface IngestJobData {
	sourceId: string;
}

// Single shared Prisma client instance, used by both server and worker.
export * from "./db.ts";

// Qdrant point-level helpers, used by both server and worker.
export * from "./qdrant.ts";
