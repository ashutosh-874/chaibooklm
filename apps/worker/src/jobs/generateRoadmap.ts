import { prisma, RoadmapStatus } from "@chaibooklm/shared";
import { embedTexts, generateRoadmapConcepts } from "../lib/openai.ts";
import { searchByVector } from "../lib/qdrant.ts";

// Stored shape: citations are enriched with everything the frontend's
// SourceViewer needs to open the cited chunk directly, unlike the LLM's raw
// output (which only reuses sourceId/chunkId/timestampSec from the prompt).
interface StoredRoadmapCitation {
	chunkId: string;
	sourceId: string;
	sourceTitle: string;
	sourceType: string;
	locator: unknown;
	text: string;
}

interface StoredRoadmapConcept {
	title: string;
	summary: string;
	orderRank: number;
	citations: StoredRoadmapCitation[];
}

// Caps how many chunks feed the roadmap prompt — bounded regardless of
// notebook size because these are the topic's top retrieval hits, not every
// chunk in every source (the previous full-scan approach didn't fit in a
// prompt once a notebook had more than a handful of sources).
const RETRIEVAL_TOP_K = 40;

// Builds one roadmap row's concepts, scoped to the topic it was created with:
// embeds the topic, retrieves its most relevant chunks from Qdrant (same
// mechanism as chat queries), asks the LLM to identify an ordered set of
// concepts with citations back to those chunks, then stores the result.
// Mirrors ingestSource's status lifecycle (PENDING -> GENERATING -> READY/FAILED).
// Each generation is its own row (see roadmap.ts's POST /), so multiple
// topics per notebook coexist instead of overwriting each other.
export async function generateRoadmap(roadmapId: string) {
	const existing = await prisma.roadmap.update({
		where: { id: roadmapId },
		data: { status: RoadmapStatus.GENERATING, errorMessage: null },
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

		const chunkInputs = chunks.map((chunk) => {
			const locator = chunk.locator as Record<string, unknown>;
			const timestampSec = typeof locator.startSec === "number" ? locator.startSec : null;
			return {
				sourceId: chunk.source.id,
				sourceTitle: chunk.source.title,
				chunkId: chunk.id,
				timestampSec,
				text: chunk.text,
			};
		});

		const rawConcepts = await generateRoadmapConcepts(chunkInputs, topic);

		// Look up full chunk/source info so stored citations carry everything the
		// frontend's SourceViewer needs (sourceTitle/sourceType/locator/text) —
		// same denormalize-for-display idea as Qdrant's chunk payload.
		const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

		// Defensive filtering: drop any citation the model invented rather than
		// reused verbatim from the context (same spirit as retriever.ts's
		// defensive parsing of structured LLM output).
		const concepts: StoredRoadmapConcept[] = rawConcepts
			.map((concept) => ({
				title: concept.title,
				summary: concept.summary,
				orderRank: concept.orderRank,
				citations: concept.citations.flatMap((c) => {
					const chunk = chunkById.get(c.chunkId);
					if (!chunk) return [];
					return [
						{
							chunkId: chunk.id,
							sourceId: chunk.source.id,
							sourceTitle: chunk.source.title,
							sourceType: chunk.source.type,
							locator: chunk.locator,
							text: chunk.text,
						},
					];
				}),
			}))
			.filter((concept) => concept.citations.length > 0)
			.sort((a, b) => a.orderRank - b.orderRank);

		if (concepts.length === 0) {
			throw new Error("Couldn't identify any concepts with valid citations from these sources");
		}

		await prisma.roadmap.update({
			where: { id: roadmapId },
			data: { status: RoadmapStatus.READY, concepts: concepts as unknown as object, errorMessage: null },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Roadmap generation failed";
		await prisma.roadmap.update({
			where: { id: roadmapId },
			data: { status: RoadmapStatus.FAILED, errorMessage: message },
		});
		throw err;
	}
}
