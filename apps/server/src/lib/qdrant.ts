import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config.ts";

export const qdrant = new QdrantClient({ url: config.qdrant.url });

// Creates the notebook's collection if it doesn't already exist.
// Vector size must match the embedding model's dimensions.
export async function ensureCollection(name: string) {
	const exists = await qdrant.collectionExists(name);
	if (exists.exists) return;

	try {
		await qdrant.createCollection(name, {
			vectors: {
				size: config.openai.embeddingDimensions,
				distance: "Cosine",
			},
		});
	} catch (err) {
		// Another concurrent request may have created it first (409 Conflict).
		const stillMissing = !(await qdrant.collectionExists(name)).exists;
		if (stillMissing) throw err;
	}
}

export async function deleteCollection(name: string) {
	const exists = await qdrant.collectionExists(name);
	if (!exists.exists) return;
	await qdrant.deleteCollection(name);
}
