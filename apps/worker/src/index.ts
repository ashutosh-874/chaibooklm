import {
	FLASHCARD_QUEUE_NAME,
	INGEST_QUEUE_NAME,
	PODCAST_QUEUE_NAME,
	ROADMAP_QUEUE_NAME,
	type FlashcardJobData,
	type IngestJobData,
	type PodcastJobData,
	type RoadmapJobData,
} from "@chaibooklm/shared";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.ts";
import { generateFlashcards } from "./jobs/generateFlashcards.ts";
import { generatePodcast } from "./jobs/generatePodcast.ts";
import { generateRoadmap } from "./jobs/generateRoadmap.ts";
import { ingestSource } from "./jobs/ingestSource.ts";

// A single ioredis instance shared across every Worker below — BullMQ duplicates
// it internally for blocking commands, so one connection is fine here (same
// pattern as apps/server/src/lib/queue.ts). Parses `rediss://` URLs (e.g.
// Upstash) as TLS automatically, same as plain `redis://` for local dev.
const connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null });

// BullMQ's `err` is a plain Error, but errors thrown by the AWS SDK/Qdrant
// client/etc. often carry extra structured detail on non-standard properties
// (err.response, err.$metadata, ...) that err.message alone doesn't surface —
// print the stack plus any such properties so a bare "Bad Request" can
// actually be diagnosed from the logs instead of guessing.
function logJobFailure(jobId: string | undefined, err: Error) {
	const extra = { ...err } as Record<string, unknown>;
	console.error(`❌ job ${jobId} failed:`, err.stack ?? err.message, Object.keys(extra).length ? JSON.stringify(extra) : "");
}

const ingestWorker = new Worker<IngestJobData>(
	INGEST_QUEUE_NAME,
	async (job) => {
		console.log(`📥 Ingest job ${job.id}: source ${job.data.sourceId}`);
		await ingestSource(job.data.sourceId);
	},
	{ connection, concurrency: 2 },
);

ingestWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
ingestWorker.on("failed", (job, err) => logJobFailure(job?.id, err));

const roadmapWorker = new Worker<RoadmapJobData>(
	ROADMAP_QUEUE_NAME,
	async (job) => {
		console.log(`🗺️  Roadmap job ${job.id}: roadmap ${job.data.roadmapId}`);
		await generateRoadmap(job.data.roadmapId);
	},
	{ connection, concurrency: 2 },
);

roadmapWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
roadmapWorker.on("failed", (job, err) => logJobFailure(job?.id, err));

const podcastWorker = new Worker<PodcastJobData>(
	PODCAST_QUEUE_NAME,
	async (job) => {
		console.log(`🎙️  Podcast job ${job.id}: podcast ${job.data.podcastId}`);
		await generatePodcast(job.data.podcastId);
	},
	{ connection, concurrency: 2 },
);

podcastWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
podcastWorker.on("failed", (job, err) => logJobFailure(job?.id, err));

const flashcardWorker = new Worker<FlashcardJobData>(
	FLASHCARD_QUEUE_NAME,
	async (job) => {
		console.log(`🗂️  Flashcard job ${job.id}: set ${job.data.flashcardSetId}`);
		await generateFlashcards(job.data.flashcardSetId);
	},
	{ connection, concurrency: 2 },
);

flashcardWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
flashcardWorker.on("failed", (job, err) => logJobFailure(job?.id, err));

console.log("👷 Worker started (ingest-source, generate-roadmap, generate-podcast, generate-flashcards). Waiting for jobs...");
