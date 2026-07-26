import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Defensive load, same pattern as db.ts — works regardless of which app
// imports it first or what its cwd is; DATABASE_URL/S3_* live in the repo-root .env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// S3-compatible object storage for uploaded PDFs/VTTs and generated podcast
// mp3s. `server` and `worker` run as separate containers/filesystems in
// production (Railway), so local disk can't be shared between them the way
// it could in single-machine dev — every file source's originIdentifier and
// Podcast.audioPath is an S3 key, not a path, and both apps read/write it
// through this module instead of the filesystem directly.
const s3 = new S3Client({
	region: process.env.S3_REGION || "auto",
	endpoint: process.env.S3_ENDPOINT || undefined, // set for R2/MinIO; omit for real AWS S3
	forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
	},
});

const bucket = process.env.S3_BUCKET ?? "";

export async function uploadObject(key: string, body: Buffer, contentType?: string): Promise<void> {
	await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function downloadObject(key: string): Promise<Buffer> {
	const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	const chunks: Uint8Array[] = [];
	// @ts-expect-error — Body is a Node Readable at runtime (this SDK client only ever runs in Node/Bun).
	for await (const chunk of res.Body) chunks.push(chunk);
	return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
	await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
