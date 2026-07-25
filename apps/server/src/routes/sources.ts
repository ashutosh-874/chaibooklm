import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma, SourceStatus, SourceType } from "@chaibooklm/shared";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { enqueueIngestJob } from "../lib/queue.ts";
import { deleteSourcePoints } from "../lib/qdrant.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: this router is mounted at /notebooks/:notebookId/sources and
// needs req.params.notebookId from the parent route.
export const sourcesRouter = Router({ mergeParams: true });
sourcesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// PDFs are kept on disk (not just at upload time) because reindex re-reads
// the same file rather than requiring a fresh upload.
const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, uploadDir),
		filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`),
	}),
	limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
	fileFilter: (_req, file, cb) => {
		if (file.mimetype === "application/pdf") return cb(null, true);
		cb(new Error("Only PDF files are allowed"));
	},
});

const textSourceSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	text: z.string().trim().min(1),
});

sourcesRouter.get("/", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const sources = await prisma.source.findMany({
		where: { notebookId: notebook.id },
		orderBy: { createdAt: "desc" },
	});
	res.json(sources);
});

sourcesRouter.post("/", upload.single("file"), async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	// Multipart request with a PDF file -> type=PDF. Otherwise expect a JSON body -> type=TEXT.
	let type: typeof SourceType.PDF | typeof SourceType.TEXT;
	let title: string;
	let originIdentifier: string;

	if (req.file) {
		type = SourceType.PDF;
		title = (req.body?.title as string | undefined)?.trim() || req.file.originalname;
		originIdentifier = req.file.path;
	} else {
		const parsed = textSourceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: "Body must include a non-empty 'text' (or upload a PDF file)" });
		}
		type = SourceType.TEXT;
		title = parsed.data.title || `${parsed.data.text.slice(0, 50)}${parsed.data.text.length > 50 ? "…" : ""}`;
		originIdentifier = parsed.data.text;
	}

	const source = await prisma.source.create({
		data: { notebookId: notebook.id, type, title, originIdentifier, status: SourceStatus.UPLOADING },
	});

	await enqueueIngestJob(source.id);
	res.status(202).json(source);
});

sourcesRouter.delete("/:sourceId", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const source = await prisma.source.findFirst({
		where: { id: req.params.sourceId, notebookId: notebook.id },
	});
	if (!source) return res.status(404).json({ error: "Source not found" });

	await deleteSourcePoints(notebook.qdrantCollection, source.id);
	await prisma.source.delete({ where: { id: source.id } }); // cascades to Chunk rows
	if (source.type === SourceType.PDF) {
		await fs.promises.unlink(source.originIdentifier).catch(() => {}); // best-effort; file may already be gone
	}
	res.status(204).send();
});

sourcesRouter.post("/:sourceId/reindex", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const source = await prisma.source.findFirst({
		where: { id: req.params.sourceId, notebookId: notebook.id },
	});
	if (!source) return res.status(404).json({ error: "Source not found" });

	await prisma.source.update({
		where: { id: source.id },
		data: { status: SourceStatus.UPLOADING, errorMessage: null },
	});
	await enqueueIngestJob(source.id);
	res.status(202).json({ message: "Reindex queued" });
});

// Multer errors (bad file type, too large) land here instead of the generic
// app-level error handler, so they come back as 400s with a readable message.
sourcesRouter.use((err: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
	if (err instanceof multer.MulterError || err instanceof Error) {
		return res.status(400).json({ error: err.message });
	}
	next(err);
});
