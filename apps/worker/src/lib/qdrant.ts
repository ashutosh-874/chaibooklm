import { QdrantClient } from "@qdrant/js-client-rest";
import * as shared from "@chaibooklm/shared";
import { config } from "../config.ts";

export const qdrant = new QdrantClient({ url: config.qdrant.url });

export const ensureCollection = (name: string) =>
	shared.ensureCollection(qdrant, name, config.openai.embeddingDimensions);

export const deleteSourcePoints = (collection: string, sourceId: string) =>
	shared.deleteSourcePoints(qdrant, collection, sourceId);

// Writes embedded chunks into the notebook's collection. `wait: true` so the
// job doesn't report READY before the points are actually searchable.
export function upsertPoints(
	collection: string,
	points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>,
) {
	return qdrant.upsert(collection, { wait: true, points });
}

interface QdrantHit {
	id: string | number;
	score: number;
	payload?: Record<string, unknown> | null;
}

// Topic-scoped roadmap generation needs the same kind of vector search the
// server's retriever does for chat queries — mirrors searchByVector in
// apps/server/src/lib/retriever.ts, just against the worker's own client.
export function searchByVector(collection: string, vector: number[], limit: number): Promise<QdrantHit[]> {
	return qdrant.search(collection, { vector, limit, with_payload: true }) as unknown as Promise<QdrantHit[]>;
}
