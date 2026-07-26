import { FlashcardStatus, prisma } from "@chaibooklm/shared";
import { embedTexts, generateFlashcards as generateFlashcardsLLM } from "../lib/openai.ts";
import { searchByVector } from "../lib/qdrant.ts";

// Stored shape: each card's citation is enriched with everything the
// frontend's SourceViewer needs to open the cited chunk directly, unlike the
// LLM's raw output (which only reuses sourceId/chunkId/timestampSec).
interface StoredFlashcard {
	front: string;
	back: string;
	citation: {
		chunkId: string;
		sourceId: string;
		sourceTitle: string;
		sourceType: string;
		locator: unknown;
		text: string;
	} | null;
}

// Caps how many chunks feed the flashcard prompt — bounded regardless of
// notebook size because these are the topic's top retrieval hits, same
// reasoning as RETRIEVAL_TOP_K in generateRoadmap.ts.
const RETRIEVAL_TOP_K = 30;

// Builds one flashcard set's cards, scoped to the topic it was created with:
// embeds the topic, retrieves its most relevant chunks from Qdrant (same
// mechanism as chat queries and roadmap/podcast generation), asks the LLM for
// a small set of Q&A flashcards with citations back to those chunks, then
// stores the result. Mirrors generateRoadmap's status lifecycle — this job
// only takes the set to CARDS_READY; quiz generation is a separate,
// synchronous step (see apps/server/src/lib/quiz.ts).
export async function generateFlashcards(flashcardSetId: string) {
	const existing = await prisma.flashcardSet.update({
		where: { id: flashcardSetId },
		data: { status: FlashcardStatus.GENERATING, errorMessage: null },
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

		const rawCards = await generateFlashcardsLLM(chunkInputs, topic);

		// Look up full chunk/source info so stored citations carry everything the
		// frontend's SourceViewer needs, same denormalize-for-display idea as
		// generateRoadmap.ts. Defensive: drop the citation (not the whole card)
		// if the model invented a chunkId rather than reusing one from context.
		const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
		const flashcards: StoredFlashcard[] = rawCards.map((card) => {
			const chunk = chunkById.get(card.citation.chunkId);
			return {
				front: card.front,
				back: card.back,
				citation: chunk
					? {
							chunkId: chunk.id,
							sourceId: chunk.source.id,
							sourceTitle: chunk.source.title,
							sourceType: chunk.source.type,
							locator: chunk.locator,
							text: chunk.text,
						}
					: null,
			};
		});

		if (flashcards.length === 0) {
			throw new Error("Couldn't generate any flashcards from these sources");
		}

		await prisma.flashcardSet.update({
			where: { id: flashcardSetId },
			data: { status: FlashcardStatus.CARDS_READY, flashcards: flashcards as unknown as object, errorMessage: null },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Flashcard generation failed";
		await prisma.flashcardSet.update({
			where: { id: flashcardSetId },
			data: { status: FlashcardStatus.FAILED, errorMessage: message },
		});
		throw err;
	}
}
