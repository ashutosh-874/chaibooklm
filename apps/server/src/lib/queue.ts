import { INGEST_QUEUE_NAME, type IngestJobData } from "@chaibooklm/shared";
import { Queue } from "bullmq";
import { config } from "../config.ts";

// BullMQ needs `maxRetriesPerRequest: null` on the connection it uses.
const connection = {
	host: config.redis.host,
	port: config.redis.port,
	maxRetriesPerRequest: null,
};

const ingestQueue = new Queue<IngestJobData>(INGEST_QUEUE_NAME, { connection });

// Enqueues the job telling the worker to extract/chunk/embed one source.
// Retries handle transient failures (OpenAI/Qdrant hiccups); the worker itself
// sets status=FAILED on the Source row once retries are exhausted.
export function enqueueIngestJob(sourceId: string) {
	return ingestQueue.add(
		"ingest",
		{ sourceId },
		{
			attempts: 3,
			backoff: { type: "exponential", delay: 2000 },
			removeOnComplete: 100,
			removeOnFail: 500,
		},
	);
}
