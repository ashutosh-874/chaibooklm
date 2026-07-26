import { QdrantClient } from "@qdrant/js-client-rest";
import * as shared from "@chaibooklm/shared";
import { config } from "../config.ts";

export const qdrant = new QdrantClient({ url: config.qdrant.url, apiKey: config.qdrant.apiKey });

// Thin bindings of the shared point-level helpers to this app's client + config,
// so route handlers can call `ensureCollection(name)` without threading `qdrant` through.
export const ensureCollection = (name: string) =>
	shared.ensureCollection(qdrant, name, config.openai.embeddingDimensions);

export const deleteCollection = (name: string) => shared.deleteCollection(qdrant, name);

export const deleteSourcePoints = (collection: string, sourceId: string) =>
	shared.deleteSourcePoints(qdrant, collection, sourceId);
