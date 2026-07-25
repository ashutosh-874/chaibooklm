import { config } from "../config.ts";
import { embedTexts, openai } from "./openai.ts";
import { qdrant } from "./qdrant.ts";

// Ported from advance-rag-pipeline/src/retriever.js, adapted for OpenAI SDK v6
// (client construction differs; response_format/streaming shapes are unchanged)
// and scoped to a single notebook's Qdrant collection instead of one global one.

export interface QueryVariants {
	stepBack: string;
	rewritten: string;
	subQueries: string[];
}

// Expands a query into variants that improve retrieval: a broader step-back
// question, a typo-fixed/explicit rewrite, and 3 focused sub-questions.
export async function queryRewriting(query: string): Promise<QueryVariants> {
	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.2,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "query_rewriting",
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						stepBack: {
							type: "string",
							description:
								"A broader, higher-level 'step-back' question whose answer gives useful background for the original query.",
						},
						rewritten: {
							type: "string",
							description:
								"The original query with spelling/grammar fixed and made clear and self-contained. Preserve the original intent.",
						},
						subQueries: {
							type: "array",
							description: "Exactly 3 focused sub-questions the original query can be decomposed into.",
							items: { type: "string" },
						},
					},
					required: ["stepBack", "rewritten", "subQueries"],
				},
			},
		},
		messages: [
			{
				role: "system",
				content:
					"You are a query understanding assistant for a retrieval system. " +
					"Given a user's question, produce query variants that help retrieve relevant documents. " +
					"Apply three techniques: (1) step-back prompting -> one broader background question; " +
					"(2) query rewriting -> fix typos/grammar and make the query explicit and self-contained; " +
					"(3) sub-query decomposition -> break the query into exactly 3 focused sub-questions. " +
					"Respond ONLY with the structured JSON.",
			},
			{ role: "user", content: query },
		],
	});

	const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

	return {
		stepBack: parsed.stepBack ?? "",
		rewritten: parsed.rewritten ?? query,
		subQueries: Array.isArray(parsed.subQueries) ? parsed.subQueries.slice(0, 3) : [],
	};
}

// HyDE: ask the model to write a short hypothetical passage that answers the
// query, then embed that instead of the bare question — it tends to land
// closer to real documents in vector space.
export async function hydeDocument(query: string): Promise<string> {
	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.3,
		messages: [
			{
				role: "system",
				content:
					"You are an expert writer. Write a concise, factual passage (3-5 sentences) that directly answers " +
					"the user's question, as if it were an excerpt from a relevant reference document. " +
					"Write confidently in a neutral, encyclopedic tone. Do not add disclaimers or say you are unsure.",
			},
			{ role: "user", content: query },
		],
	});

	return completion.choices[0]?.message?.content?.trim() ?? "";
}

interface QdrantHit {
	id: string | number;
	score: number;
	payload?: Record<string, unknown> | null;
}

async function searchByVector(collection: string, vector: number[]): Promise<QdrantHit[]> {
	return qdrant.search(collection, {
		vector,
		limit: config.retrieval.topK,
		with_payload: true,
	}) as unknown as Promise<QdrantHit[]>;
}

export interface FusedChunk {
	chunkId: string;
	rrfScore: number;
	bestScore: number;
	matchedBy: string[];
}

// Reciprocal Rank Fusion: a chunk's fused score is the sum, over every ranked
// list it appears in, of 1/(k+rank). Chunks that rank highly across several
// query variants bubble to the top even if no single variant ranked them #1.
function reciprocalRankFusion(rankedLists: Array<{ label: string; hits: QdrantHit[] }>, k = config.retrieval.rrfK) {
	const fused = new Map<string, FusedChunk>();

	for (const { label, hits } of rankedLists) {
		hits.forEach((h, index) => {
			const chunkId = h.payload?.chunkId as string | undefined;
			if (!chunkId) return; // shouldn't happen, but don't let a bad point crash retrieval

			const contribution = 1 / (k + (index + 1));
			const existing = fused.get(chunkId);
			if (existing) {
				existing.rrfScore += contribution;
				existing.bestScore = Math.max(existing.bestScore, h.score);
				existing.matchedBy.push(label);
			} else {
				fused.set(chunkId, { chunkId, rrfScore: contribution, bestScore: h.score, matchedBy: [label] });
			}
		});
	}

	return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

// Multi-query retrieval: expand the query (rewrite, step-back, HyDE, 3 sub-queries),
// search the notebook's Qdrant collection with every variant, fuse with RRF, keep top finalK.
export async function retrieveChunks(collection: string, query: string): Promise<FusedChunk[]> {
	const [{ stepBack, rewritten, subQueries }, hyde] = await Promise.all([queryRewriting(query), hydeDocument(query)]);

	const labelled = [
		{ label: "rewritten", text: rewritten },
		{ label: "stepBack", text: stepBack },
		{ label: "hyde", text: hyde },
		...subQueries.map((q, i) => ({ label: `subQuery${i + 1}`, text: q })),
	].filter((q) => q.text.trim().length > 0);

	const vectors = await embedTexts(labelled.map((q) => q.text));
	const resultsPerQuery = await Promise.all(vectors.map((v) => searchByVector(collection, v)));

	const rankedLists = labelled.map((q, i) => ({ label: q.label, hits: resultsPerQuery[i] }));
	const fused = reciprocalRankFusion(rankedLists);

	return fused.slice(0, config.retrieval.finalK);
}
