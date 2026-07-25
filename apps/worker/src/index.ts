import { INGEST_QUEUE_NAME, type IngestJobData } from "@chaibooklm/shared";
import { Worker } from "bullmq";
import { config } from "./config.ts";
import { ingestSource } from "./jobs/ingestSource.ts";

const connection = {
	host: config.redis.host,
	port: config.redis.port,
	maxRetriesPerRequest: null,
};

const worker = new Worker<IngestJobData>(
	INGEST_QUEUE_NAME,
	async (job) => {
		console.log(`📥 Ingest job ${job.id}: source ${job.data.sourceId}`);
		await ingestSource(job.data.sourceId);
	},
	{ connection, concurrency: 2 },
);

worker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`❌ job ${job?.id} failed:`, err.message));

console.log("👷 Worker started (ingest-source). Waiting for jobs...");
