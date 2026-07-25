import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Defensive load so `prisma` works regardless of which app imports it first
// or what its cwd is — DATABASE_URL lives in the repo-root .env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
export * from "./generated/prisma/client.ts";
