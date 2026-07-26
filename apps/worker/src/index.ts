import {
	INGEST_QUEUE_NAME,
	PODCAST_QUEUE_NAME,
	ROADMAP_QUEUE_NAME,
	type IngestJobData,
	type PodcastJobData,
	type RoadmapJobData,
} from "@chaibooklm/shared";
import { Worker } from "bullmq";
import { config } from "./config.ts";
import { generatePodcast } from "./jobs/generatePodcast.ts";
import { generateRoadmap } from "./jobs/generateRoadmap.ts";
import { ingestSource } from "./jobs/ingestSource.ts";

const connection = {
	host: config.redis.host,
	port: config.redis.port,
	maxRetriesPerRequest: null,
};

const ingestWorker = new Worker<IngestJobData>(
	INGEST_QUEUE_NAME,
	async (job) => {
		console.log(`📥 Ingest job ${job.id}: source ${job.data.sourceId}`);
		await ingestSource(job.data.sourceId);
	},
	{ connection, concurrency: 2 },
);

ingestWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
ingestWorker.on("failed", (job, err) => console.error(`❌ job ${job?.id} failed:`, err.message));

const roadmapWorker = new Worker<RoadmapJobData>(
	ROADMAP_QUEUE_NAME,
	async (job) => {
		console.log(`🗺️  Roadmap job ${job.id}: roadmap ${job.data.roadmapId}`);
		await generateRoadmap(job.data.roadmapId);
	},
	{ connection, concurrency: 2 },
);

roadmapWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
roadmapWorker.on("failed", (job, err) => console.error(`❌ job ${job?.id} failed:`, err.message));

const podcastWorker = new Worker<PodcastJobData>(
	PODCAST_QUEUE_NAME,
	async (job) => {
		console.log(`🎙️  Podcast job ${job.id}: podcast ${job.data.podcastId}`);
		await generatePodcast(job.data.podcastId);
	},
	{ connection, concurrency: 2 },
);

podcastWorker.on("completed", (job) => console.log(`✅ job ${job.id} completed`));
podcastWorker.on("failed", (job, err) => console.error(`❌ job ${job?.id} failed:`, err.message));

console.log("👷 Worker started (ingest-source, generate-roadmap, generate-podcast). Waiting for jobs...");
