import type { QdrantClient } from "@qdrant/js-client-rest";

// Point-level Qdrant helpers shared by server (collection lifecycle, delete-on-source-delete)
// and worker (upsert during ingestion, delete-before-reindex). Each app builds its own
// QdrantClient from its own config and passes it in here, so this file stays config-free.

// Creates the notebook's collection if it doesn't already exist.
// Vector size must match the embedding model's dimensions.
export async function ensureCollection(client: QdrantClient, name: string, vectorSize: number) {
	const exists = await client.collectionExists(name);
	if (exists.exists) return;

	try {
		await client.createCollection(name, {
			vectors: { size: vectorSize, distance: "Cosine" },
		});
	} catch (err) {
		// Another concurrent request may have created it first (409 Conflict).
		const stillMissing = !(await client.collectionExists(name)).exists;
		if (stillMissing) throw err;
	}
}

export async function deleteCollection(client: QdrantClient, name: string) {
	const exists = await client.collectionExists(name);
	if (!exists.exists) return;
	await client.deleteCollection(name);
}

// Removes every point belonging to one source (used on source delete, and before
// re-embedding on reindex so old chunks don't linger alongside the new ones).
export async function deleteSourcePoints(client: QdrantClient, collection: string, sourceId: string) {
	await client.delete(collection, {
		filter: { must: [{ key: "sourceId", match: { value: sourceId } }] },
	});
}
