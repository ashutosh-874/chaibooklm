import { prisma, RoadmapStatus } from "@chaibooklm/shared";
import { Router } from "express";
import { z } from "zod";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { enqueueRoadmapJob } from "../lib/queue.ts";
import { suggestTopics } from "../lib/sourceTopics.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: this router is mounted at /notebooks/:notebookId/roadmap and
// needs req.params.notebookId from the parent route.
export const roadmapRouter = Router({ mergeParams: true });
roadmapRouter.use(requireAuth);

// Lists every roadmap ever generated for this notebook (newest first) — each
// topic the user has generated a roadmap for is kept, not overwritten.
roadmapRouter.get("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const roadmaps = await prisma.roadmap.findMany({
		where: { notebookId: notebook.id },
		orderBy: { createdAt: "desc" },
	});
	res.json(roadmaps);
});

// Cheap, synchronous topic suggestions (title + short excerpt per source only)
// so the frontend can offer a pick-a-topic step before the expensive,
// retrieval-scoped generation runs. Not persisted — recomputed each time.
roadmapRouter.get("/topics", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const topics = await suggestTopics(notebook.id);
	res.json({ topics });
});

roadmapRouter.get("/:roadmapId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const roadmap = await prisma.roadmap.findFirst({
		where: { id: req.params.roadmapId, notebookId: notebook.id },
	});
	if (!roadmap) return res.status(404).json({ error: "Roadmap not found" });
	res.json(roadmap);
});

const generateRoadmapSchema = z.object({
	topic: z.string().trim().min(1).max(200),
});

// Creates a new roadmap for a topic the user picked — the worker retrieves
// only chunks relevant to that topic (same Qdrant search as chat queries)
// instead of scanning every source, so prompt size stays bounded regardless
// of notebook size. Each generation is its own row, kept in the notebook's
// roadmap history rather than overwriting a prior one.
roadmapRouter.post("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const parsed = generateRoadmapSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A 'topic' is required" });
	}

	const readyCount = await prisma.source.count({ where: { notebookId: notebook.id, status: "READY" } });
	if (readyCount === 0) {
		return res.status(400).json({ error: "This notebook has no ready sources to build a roadmap from" });
	}

	const roadmap = await prisma.roadmap.create({
		data: { notebookId: notebook.id, status: RoadmapStatus.PENDING, topic: parsed.data.topic },
	});

	await enqueueRoadmapJob(roadmap.id);
	res.status(202).json(roadmap);
});

roadmapRouter.delete("/:roadmapId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const roadmap = await prisma.roadmap.findFirst({
		where: { id: req.params.roadmapId, notebookId: notebook.id },
	});
	if (!roadmap) return res.status(404).json({ error: "Roadmap not found" });

	await prisma.roadmap.delete({ where: { id: roadmap.id } });
	res.status(204).send();
});
