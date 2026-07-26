import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Worker and server share the same on-disk uploads directory (apps/server/uploads) —
// the server already relies on this for reading PDF/VTT files via Source.originIdentifier
// paths it wrote; podcast generation writes into the same place so the server's
// file-serving route (GET /podcast/:id/file) can read it back with no extra plumbing.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.join(__dirname, "..", "..", "..", "server", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
