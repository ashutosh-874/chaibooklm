import fs from "node:fs/promises";
import path from "node:path";
import { prisma, PodcastStatus } from "@chaibooklm/shared";
import { synthesizeSpeech } from "../lib/googleTts.ts";
import { embedTexts, generatePodcastScript } from "../lib/openai.ts";
import { searchByVector } from "../lib/qdrant.ts";
import { uploadDir } from "../lib/uploads.ts";

// Caps how many chunks feed the script prompt — bounded regardless of
// notebook size because these are the topic's top retrieval hits, same
// reasoning as RETRIEVAL_TOP_K in generateRoadmap.ts.
const RETRIEVAL_TOP_K = 30;

// Builds one podcast row's script + audio, scoped to the topic it was created
// with: embeds the topic, retrieves its most relevant chunks from Qdrant (same
// mechanism as chat queries and roadmap generation), writes a spoken-style
// narration script from them, synthesizes it via ElevenLabs, and stores the
// mp3 on disk. Mirrors ingestSource/generateRoadmap's status lifecycle
// (PENDING -> GENERATING -> READY/FAILED).
export async function generatePodcast(podcastId: string) {
	const existing = await prisma.podcast.update({
		where: { id: podcastId },
		data: { status: PodcastStatus.GENERATING, errorMessage: null },
	});
	const topic = existing.topic ?? "";

	try {
		const notebook = await prisma.notebook.findUniqueOrThrow({ where: { id: existing.notebookId } });

		const [vector] = await embedTexts([topic]);
		const hits = await searchByVector(notebook.qdrantCollection, vector, RETRIEVAL_TOP_K);
		const chunkIds = hits.map((h) => h.payload?.chunkId).filter((id): id is string => typeof id === "string");

		if (chunkIds.length === 0) {
			throw new Error(`Couldn't find anything relevant to "${topic}" in this notebook's sources`);
		}

		const chunks = await prisma.chunk.findMany({
			where: { id: { in: chunkIds } },
			include: { source: true },
		});

		// Group retrieved chunks by source so the script prompt reads as
		// "excerpts from source X" rather than a flat, unattributed blob.
		const bySource = new Map<string, { title: string; text: string }>();
		for (const chunk of chunks) {
			const existingEntry = bySource.get(chunk.source.id);
			const text = existingEntry ? `${existingEntry.text} ${chunk.text}` : chunk.text;
			bySource.set(chunk.source.id, { title: chunk.source.title, text });
		}
		const sourceInputs = [...bySource.values()].map((s) => ({ title: s.title, excerpt: s.text }));

		const script = await generatePodcastScript(sourceInputs, topic);
		if (!script) {
			throw new Error("Couldn't generate a narration script from these sources");
		}

		const voice = existing.voice === "female" ? "female" : "male";
		const audioBuffer = await synthesizeSpeech(script, voice);

		const audioPath = path.join(uploadDir, `podcast-${podcastId}.mp3`);
		await fs.writeFile(audioPath, audioBuffer);

		await prisma.podcast.update({
			where: { id: podcastId },
			data: { status: PodcastStatus.READY, script, audioPath, errorMessage: null },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Podcast generation failed";
		await prisma.podcast.update({
			where: { id: podcastId },
			data: { status: PodcastStatus.FAILED, errorMessage: message },
		});
		throw err;
	}
}
