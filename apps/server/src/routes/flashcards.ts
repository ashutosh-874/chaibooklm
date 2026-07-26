import { FlashcardStatus, prisma } from "@chaibooklm/shared";
import { Router } from "express";
import { z } from "zod";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { enqueueFlashcardJob } from "../lib/queue.ts";
import { generateQuiz } from "../lib/quiz.ts";
import { suggestTopics } from "../lib/sourceTopics.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: this router is mounted at /notebooks/:notebookId/flashcards and
// needs req.params.notebookId from the parent route.
export const flashcardsRouter = Router({ mergeParams: true });
flashcardsRouter.use(requireAuth);

// Lists every flashcard set ever generated for this notebook (newest first) —
// each topic the user has generated a set for is kept, not overwritten.
flashcardsRouter.get("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const sets = await prisma.flashcardSet.findMany({
		where: { notebookId: notebook.id },
		orderBy: { createdAt: "desc" },
	});
	res.json(sets);
});

// Cheap, synchronous topic suggestions — same suggestion pool roadmaps and
// podcasts use, not persisted, recomputed each time.
flashcardsRouter.get("/topics", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const topics = await suggestTopics(notebook.id);
	res.json({ topics });
});

flashcardsRouter.get("/:setId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const set = await prisma.flashcardSet.findFirst({
		where: { id: req.params.setId, notebookId: notebook.id },
	});
	if (!set) return res.status(404).json({ error: "Flashcard set not found" });
	res.json(set);
});

const generateFlashcardsSchema = z.object({
	topic: z.string().trim().min(1).max(200),
});

// Creates a new flashcard set for a topic the user picked — the worker
// retrieves only chunks relevant to that topic (same Qdrant search as chat
// queries and roadmap/podcast generation) instead of scanning every source.
// Each generation is its own row, kept in the notebook's flashcard history
// rather than overwriting a prior one.
flashcardsRouter.post("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const parsed = generateFlashcardsSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A 'topic' is required" });
	}

	const readyCount = await prisma.source.count({ where: { notebookId: notebook.id, status: "READY" } });
	if (readyCount === 0) {
		return res.status(400).json({ error: "This notebook has no ready sources to build flashcards from" });
	}

	const set = await prisma.flashcardSet.create({
		data: { notebookId: notebook.id, status: FlashcardStatus.PENDING, topic: parsed.data.topic },
	});

	await enqueueFlashcardJob(set.id);
	res.status(202).json(set);
});

// Generates the quiz for an already-generated flashcard set. No queue needed —
// the input is just the set's own (small) flashcards, already in Postgres, so
// this runs synchronously and returns the updated set directly.
flashcardsRouter.post("/:setId/quiz", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const set = await prisma.flashcardSet.findFirst({
		where: { id: req.params.setId, notebookId: notebook.id },
	});
	if (!set) return res.status(404).json({ error: "Flashcard set not found" });
	if (set.status !== FlashcardStatus.CARDS_READY && set.status !== FlashcardStatus.QUIZ_READY) {
		return res.status(400).json({ error: "This flashcard set isn't ready yet" });
	}

	const flashcards = set.flashcards as unknown as Array<{ front: string; back: string }>;
	if (!Array.isArray(flashcards) || flashcards.length === 0) {
		return res.status(400).json({ error: "This flashcard set has no cards to quiz on" });
	}

	try {
		const quiz = await generateQuiz(flashcards.map((c) => ({ front: c.front, back: c.back })));
		if (quiz.length === 0) {
			return res.status(500).json({ error: "Couldn't generate a quiz from these flashcards" });
		}

		const updated = await prisma.flashcardSet.update({
			where: { id: set.id },
			data: { status: FlashcardStatus.QUIZ_READY, quiz: quiz as unknown as object, errorMessage: null },
		});
		res.json(updated);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Quiz generation failed";
		await prisma.flashcardSet.update({ where: { id: set.id }, data: { errorMessage: message } });
		res.status(500).json({ error: message });
	}
});

flashcardsRouter.delete("/:setId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const set = await prisma.flashcardSet.findFirst({
		where: { id: req.params.setId, notebookId: notebook.id },
	});
	if (!set) return res.status(404).json({ error: "Flashcard set not found" });

	await prisma.flashcardSet.delete({ where: { id: set.id } });
	res.status(204).send();
});
