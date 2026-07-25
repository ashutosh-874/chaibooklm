import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "@chaibooklm/shared";
import { z } from "zod";
import { deleteCollection, ensureCollection } from "../lib/qdrant.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

export const notebooksRouter = Router();
notebooksRouter.use(requireAuth);

const nameSchema = z.object({ name: z.string().trim().min(1).max(200) });

notebooksRouter.get("/", async (req, res) => {
	const notebooks = await prisma.notebook.findMany({
		where: { userId: req.userId },
		orderBy: { createdAt: "desc" },
	});
	res.json(notebooks);
});

notebooksRouter.post("/", async (req, res) => {
	const parsed = nameSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: "Body must include a non-empty 'name'" });
	}

	const id = crypto.randomUUID();
	const qdrantCollection = `nb_${id}`;
	await ensureCollection(qdrantCollection);

	const notebook = await prisma.notebook.create({
		data: { id, name: parsed.data.name, userId: req.userId as string, qdrantCollection },
	});
	res.status(201).json(notebook);
});

notebooksRouter.patch("/:id", async (req, res) => {
	const parsed = nameSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: "Body must include a non-empty 'name'" });
	}

	const { count } = await prisma.notebook.updateMany({
		where: { id: req.params.id, userId: req.userId },
		data: { name: parsed.data.name },
	});
	if (count === 0) return res.status(404).json({ error: "Notebook not found" });

	const notebook = await prisma.notebook.findUnique({ where: { id: req.params.id } });
	res.json(notebook);
});

notebooksRouter.delete("/:id", async (req, res) => {
	const notebook = await prisma.notebook.findFirst({
		where: { id: req.params.id, userId: req.userId },
	});
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	await deleteCollection(notebook.qdrantCollection);
	await prisma.notebook.delete({ where: { id: notebook.id } });
	res.status(204).send();
});
