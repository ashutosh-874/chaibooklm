import crypto from "node:crypto";
import path from "node:path";
import { deleteObject, downloadObject, prisma, SourceStatus, SourceType, uploadObject } from "@chaibooklm/shared";
import AdmZip from "adm-zip";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { enqueueIngestJob } from "../lib/queue.ts";
import { deleteSourcePoints } from "../lib/qdrant.ts";
import { resolvePlaylistVideoIds } from "../lib/youtubePlaylist.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: this router is mounted at /notebooks/:notebookId/sources and
// needs req.params.notebookId from the parent route.
export const sourcesRouter = Router({ mergeParams: true });
sourcesRouter.use(requireAuth);

// Buffered in memory, then uploaded to S3 — server and worker run as separate
// containers/filesystems in production, so local disk can't be shared between
// them (see packages/shared/src/storage.ts). Reindex re-downloads the same S3
// object rather than requiring a fresh upload.
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
	fileFilter: (_req, file, cb) => {
		// PDF is checked by mimetype (reliable for PDFs); VTT/SRT mimetypes are
		// inconsistent across browsers/OSes (often application/octet-stream), so
		// those are checked by extension instead.
		const ext = path.extname(file.originalname).toLowerCase();
		if (file.mimetype === "application/pdf" || ext === ".vtt" || ext === ".srt") return cb(null, true);
		cb(new Error("Only PDF, VTT, or SRT files are allowed"));
	},
});

const MAX_ZIP_LECTURES = 300;

// Zip is buffered in memory because it's unpacked and filtered in-process via
// adm-zip before anything is written — only the kept .vtt/.srt entries get
// uploaded to S3, same as any other source file.
const uploadZip = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — transcripts are plain text, generous
	fileFilter: (_req, file, cb) => {
		if (path.extname(file.originalname).toLowerCase() === ".zip") return cb(null, true);
		cb(new Error("Only .zip files are allowed"));
	},
});

const textSourceSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	text: z.string().trim().min(1),
});

// Only a format/protocol check for fast feedback — the real SSRF-safety boundary
// (DNS resolution, private-IP rejection, redirect re-validation) lives in the
// worker's safeFetch, right before the actual network request happens.
const urlSourceSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	url: z.url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), "URL must be http(s)"),
});

const youtubeSourceSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	video: z.string().trim().min(1),
});

const youtubePlaylistSchema = z.object({
	playlistUrl: z.string().trim().min(1),
});

// Pulls the 11-char video ID out of common YouTube URL forms, or accepts a bare ID.
function extractYoutubeId(input: string): string | null {
	const trimmed = input.trim();
	if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
	const patterns = [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /youtube\.com\/shorts\/([\w-]{11})/, /youtube\.com\/embed\/([\w-]{11})/];
	for (const pattern of patterns) {
		const match = trimmed.match(pattern);
		if (match) return match[1];
	}
	return null;
}

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

	// Multipart request with a PDF/VTT/SRT file -> type=PDF or VTT (by extension).
	// A JSON body with `url` -> type=URL. A JSON body with `video` -> type=YOUTUBE.
	// Otherwise (JSON body with `text`) -> type=TEXT.
	let type: typeof SourceType.PDF | typeof SourceType.TEXT | typeof SourceType.URL | typeof SourceType.YOUTUBE | typeof SourceType.VTT;
	let title: string;
	let originIdentifier: string;

	if (req.file) {
		const ext = path.extname(req.file.originalname).toLowerCase();
		const isTranscript = ext === ".vtt" || ext === ".srt";
		type = isTranscript ? SourceType.VTT : SourceType.PDF;
		const defaultTitle = isTranscript ? path.basename(req.file.originalname, ext) : req.file.originalname;
		title = (req.body?.title as string | undefined)?.trim() || defaultTitle;
		originIdentifier = `sources/${crypto.randomUUID()}${ext}`;
		await uploadObject(originIdentifier, req.file.buffer, req.file.mimetype);
	} else if (typeof req.body?.url === "string") {
		const parsed = urlSourceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" });
		}
		type = SourceType.URL;
		// Placeholder until ingestion runs — the worker overwrites this with the
		// page's real title if the user didn't provide one (see ingestSource.ts).
		title = parsed.data.title || parsed.data.url;
		originIdentifier = parsed.data.url;
	} else if (typeof req.body?.video === "string") {
		const parsed = youtubeSourceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid video" });
		}
		const videoId = extractYoutubeId(parsed.data.video);
		if (!videoId) {
			return res.status(400).json({ error: "Couldn't find a valid YouTube video ID in that URL" });
		}
		type = SourceType.YOUTUBE;
		// Placeholder until ingestion runs — the worker overwrites this with the
		// video's real title if the user didn't provide one (see ingestSource.ts).
		title = parsed.data.title || videoId;
		originIdentifier = videoId;
	} else {
		const parsed = textSourceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: "Body must include a non-empty 'text' or 'url' (or upload a PDF file)" });
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

// Batch endpoint for a zip of many transcripts (e.g. a course export) — kept
// separate from POST / so that endpoint's one-file-in-one-Source-out response
// shape stays uniform instead of becoming polymorphic.
sourcesRouter.post("/vtt-zip", uploadZip.single("file"), async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });
	if (!req.file) return res.status(400).json({ error: "A .zip file is required" });

	let zip: AdmZip;
	try {
		zip = new AdmZip(req.file.buffer);
	} catch {
		return res.status(400).json({ error: "Couldn't read this zip file — it may be corrupted" });
	}

	// Group candidate entries by (dir, basename-without-ext) so a lecture that
	// shipped as both .vtt and .srt only becomes one Source (prefer .vtt).
	const candidates = new Map<string, { entryName: string; ext: string; dir: string; base: string }>();
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue;
		// adm-zip normalizes entryName and rejects zip-slip paths when reading,
		// but double-check anyway — defense in depth, same spirit as safeFetch's SSRF checks.
		const normalized = path.normalize(entry.entryName);
		if (normalized.startsWith("..") || path.isAbsolute(normalized)) continue;
		if (normalized.startsWith("__MACOSX/")) continue;

		const base0 = path.basename(normalized);
		if (base0.startsWith(".")) continue; // .DS_Store and other dotfiles

		const ext = path.extname(normalized).toLowerCase();
		if (ext !== ".vtt" && ext !== ".srt") continue;

		const dir = path.dirname(normalized);
		const base = path.basename(normalized, ext);
		const key = `${dir}/${base}`;

		const existing = candidates.get(key);
		if (!existing || (existing.ext === ".srt" && ext === ".vtt")) {
			candidates.set(key, { entryName: normalized, ext, dir, base });
		}
	}

	if (candidates.size === 0) {
		return res.status(400).json({ error: "No .vtt or .srt files found in this zip archive" });
	}
	if (candidates.size > MAX_ZIP_LECTURES) {
		return res.status(400).json({ error: `This zip has ${candidates.size} transcript files — the limit is ${MAX_ZIP_LECTURES}` });
	}

	const sources = [];
	for (const { entryName, ext, dir, base } of candidates.values()) {
		const entryData = zip.readFile(entryName);
		if (!entryData) continue; // shouldn't happen, but don't let one bad entry 500 the whole batch

		const key = `sources/${crypto.randomUUID()}${ext}`;
		await uploadObject(key, entryData);

		// The sample export nests each lecture in its own same-named subfolder
		// (module/lecture/lecture.vtt) — when that's the case, the *module*
		// folder one level further up is the only extra context worth surfacing;
		// without it, 80+ lectures all look alike in the source list.
		const immediateParent = path.basename(dir);
		const moduleFolder = immediateParent === base ? path.basename(path.dirname(dir)) : immediateParent;
		const title = moduleFolder && moduleFolder !== "." ? `${moduleFolder} — ${base}` : base;

		const source = await prisma.source.create({
			data: { notebookId: notebook.id, type: SourceType.VTT, title, originIdentifier: key, status: SourceStatus.UPLOADING },
		});
		await enqueueIngestJob(source.id);
		sources.push(source);
	}

	res.status(201).json({ count: sources.length, sources });
});

// Batch endpoint for a YouTube playlist — resolves the playlist to its member
// videos via the YouTube Data API, then creates one Source per video (same
// shape as a single YOUTUBE source from POST /), each ingested independently.
sourcesRouter.post("/youtube-playlist", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const parsed = youtubePlaylistSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid playlistUrl" });
	}

	let videos: Awaited<ReturnType<typeof resolvePlaylistVideoIds>>;
	try {
		videos = await resolvePlaylistVideoIds(parsed.data.playlistUrl);
	} catch (err) {
		return res.status(400).json({ error: err instanceof Error ? err.message : "Couldn't resolve this playlist" });
	}

	const sources = [];
	for (const { videoId, title } of videos) {
		const source = await prisma.source.create({
			data: { notebookId: notebook.id, type: SourceType.YOUTUBE, title, originIdentifier: videoId, status: SourceStatus.UPLOADING },
		});
		await enqueueIngestJob(source.id);
		sources.push(source);
	}

	res.status(201).json({ count: sources.length, sources });
});

// Serves the raw PDF bytes so the web Source Viewer can render it (react-pdf
// needs the actual file, not just metadata). TEXT sources need no equivalent —
// their content is the `originIdentifier` string already returned by GET /.
sourcesRouter.get("/:sourceId/file", async (req, res) => {
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const source = await prisma.source.findFirst({
		where: { id: req.params.sourceId, notebookId: notebook.id, type: SourceType.PDF },
	});
	if (!source) return res.status(404).json({ error: "PDF source not found" });

	try {
		const buffer = await downloadObject(source.originIdentifier);
		res.type("application/pdf");
		res.send(buffer);
	} catch {
		res.status(404).json({ error: "File no longer exists in storage" });
	}
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
	if (source.type === SourceType.PDF || source.type === SourceType.VTT) {
		await deleteObject(source.originIdentifier).catch(() => {}); // best-effort; object may already be gone
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
