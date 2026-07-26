import fs from "node:fs/promises";
import { prisma, PodcastStatus } from "@chaibooklm/shared";
import { Router } from "express";
import { z } from "zod";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { enqueuePodcastJob } from "../lib/queue.ts";
import { suggestTopics } from "../lib/sourceTopics.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: this router is mounted at /notebooks/:notebookId/podcast and
// needs req.params.notebookId from the parent route.
export const podcastRouter = Router({ mergeParams: true });
podcastRouter.use(requireAuth);

// Lists every podcast ever generated for this notebook (newest first) — each
// generation is kept, not overwritten, same history model as roadmaps.
podcastRouter.get("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const podcasts = await prisma.podcast.findMany({
		where: { notebookId: notebook.id },
		orderBy: { createdAt: "desc" },
	});
	res.json(podcasts);
});

// Cheap, synchronous topic suggestions (title + short excerpt per source only)
// so the frontend can offer a pick-a-topic step before the expensive,
// retrieval-scoped generation runs — same suggestion pool roadmaps use.
podcastRouter.get("/topics", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const topics = await suggestTopics(notebook.id);
	res.json({ topics });
});

podcastRouter.get("/:podcastId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const podcast = await prisma.podcast.findFirst({
		where: { id: req.params.podcastId, notebookId: notebook.id },
	});
	if (!podcast) return res.status(404).json({ error: "Podcast not found" });
	res.json(podcast);
});

const generatePodcastSchema = z.object({
	voice: z.enum(["male", "female"]),
	topic: z.string().trim().min(1).max(200),
});

// Creates a new podcast scoped to a topic the user picked — the worker
// retrieves only chunks relevant to that topic (same Qdrant search as chat
// queries and roadmap generation) instead of scanning every source, then
// writes a narration script and synthesizes it via ElevenLabs TTS. Each
// generation is its own row, kept in the notebook's podcast history rather
// than overwriting a prior one.
podcastRouter.post("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const parsed = generatePodcastSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A 'voice' and 'topic' are required" });
	}

	const readyCount = await prisma.source.count({ where: { notebookId: notebook.id, status: "READY" } });
	if (readyCount === 0) {
		return res.status(400).json({ error: "This notebook has no ready sources to build a podcast from" });
	}

	const podcast = await prisma.podcast.create({
		data: { notebookId: notebook.id, status: PodcastStatus.PENDING, voice: parsed.data.voice, topic: parsed.data.topic },
	});

	await enqueuePodcastJob(podcast.id);
	res.status(202).json(podcast);
});

podcastRouter.delete("/:podcastId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const podcast = await prisma.podcast.findFirst({
		where: { id: req.params.podcastId, notebookId: notebook.id },
	});
	if (!podcast) return res.status(404).json({ error: "Podcast not found" });

	await prisma.podcast.delete({ where: { id: podcast.id } });
	if (podcast.audioPath) {
		await fs.unlink(podcast.audioPath).catch(() => {}); // best-effort; file may already be gone
	}
	res.status(204).send();
});

// Serves the generated mp3 so the web player can stream it directly.
podcastRouter.get("/:podcastId/file", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const podcast = await prisma.podcast.findFirst({
		where: { id: req.params.podcastId, notebookId: notebook.id, status: PodcastStatus.READY },
	});
	if (!podcast?.audioPath) return res.status(404).json({ error: "Podcast audio not found" });

	res.type("audio/mpeg");
	res.sendFile(podcast.audioPath, (err) => {
		if (err && !res.headersSent) res.status(404).json({ error: "File no longer exists on disk" });
	});
});
