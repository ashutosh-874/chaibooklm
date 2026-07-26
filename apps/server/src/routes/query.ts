import { prisma, SSE_EVENTS } from "@chaibooklm/shared";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.ts";
import { getOwnedNotebook } from "../lib/ownership.ts";
import { openai } from "../lib/openai.ts";
import { retrieveChunks } from "../lib/retriever.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

// mergeParams: mounted at /notebooks/:notebookId/query, needs req.params.notebookId.
export const queryRouter = Router({ mergeParams: true });
queryRouter.use(requireAuth);

const querySchema = z.object({ query: z.string().trim().min(1) });

function sseWrite(res: import("express").Response, event: string, data: unknown) {
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

queryRouter.post("/", async (req, res) => {
	// Validate + check ownership BEFORE switching to SSE, so bad requests still get a normal JSON error.
	const notebook = await getOwnedNotebook(req.params.notebookId as string, req.userId);
	if (!notebook) return res.status(404).json({ error: "Notebook not found" });

	const parsed = querySchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: "Body must include a non-empty 'query'" });
	const { query } = parsed.data;

	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});

	try {
		const fused = await retrieveChunks(notebook.qdrantCollection, query);

		if (fused.length === 0) {
			sseWrite(res, SSE_EVENTS.TOKEN, { text: "I couldn't find anything relevant in this notebook's sources." });
			sseWrite(res, SSE_EVENTS.CITATIONS, { citations: [] });
			sseWrite(res, SSE_EVENTS.DONE, {});
			return res.end();
		}

		// Look up each fused chunk's locator + source info in Postgres for the citation list.
		const chunkRows = await prisma.chunk.findMany({
			where: { id: { in: fused.map((f) => f.chunkId) } },
			include: { source: true },
		});
		const chunkById = new Map(chunkRows.map((c) => [c.id, c]));

		// Keep RRF's fused order, not whatever order Postgres returned rows in.
		const ordered = fused.map((f) => chunkById.get(f.chunkId)).filter((c): c is NonNullable<typeof c> => Boolean(c));

		const citations = ordered.map((chunk, i) => ({
			n: i + 1,
			chunkId: chunk.id,
			sourceId: chunk.sourceId,
			sourceTitle: chunk.source.title,
			sourceType: chunk.source.type,
			locator: chunk.locator,
			// The chunk's own text: for TEXT/PDF the viewer highlights this span
			// inside the full source instead, but URL sources have no stored full
			// document to highlight within, so their viewer shows this directly.
			text: chunk.text,
		}));

		const context = ordered.map((chunk, i) => `[${i + 1}] (source: ${chunk.source.title})\n${chunk.text}`).join("\n\n");

		const stream = await openai.chat.completions.create({
			model: config.openai.chatModel,
			temperature: 0.2,
			stream: true,
			messages: [
				{
					role: "system",
					content:
						"You are a helpful research assistant. Answer the user's question using ONLY the provided context. " +
						"Cite sources inline using [n] markers matching the numbered context. " +
						"If the answer isn't in the context, say you don't know. Be concise. " +
						"CRITICAL: Answer in the same language as the user's question (e.g., if the user asks in English, reply in English, even if the retrieved context is in Hindi or another language).",
				},
				{ role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
			],
		});

		for await (const chunk of stream) {
			const text = chunk.choices[0]?.delta?.content;
			if (text) sseWrite(res, SSE_EVENTS.TOKEN, { text });
		}

		sseWrite(res, SSE_EVENTS.CITATIONS, { citations });
		sseWrite(res, SSE_EVENTS.DONE, {});
		res.end();
	} catch (err) {
		// Headers are already sent at this point, so the error has to go over
		// the stream itself rather than as a normal HTTP error status.
		sseWrite(res, SSE_EVENTS.ERROR, { error: err instanceof Error ? err.message : "Query failed" });
		res.end();
	}
});
