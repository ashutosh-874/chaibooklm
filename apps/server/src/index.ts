import { config } from "./config.ts";

import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.ts";
import { notebooksRouter } from "./routes/notebooks.ts";
import { podcastRouter } from "./routes/podcast.ts";
import { queryRouter } from "./routes/query.ts";
import { roadmapRouter } from "./routes/roadmap.ts";
import { sourcesRouter } from "./routes/sources.ts";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/notebooks", notebooksRouter);
app.use("/notebooks/:notebookId/sources", sourcesRouter);
app.use("/notebooks/:notebookId/query", queryRouter);
app.use("/notebooks/:notebookId/roadmap", roadmapRouter);
app.use("/notebooks/:notebookId/podcast", podcastRouter);

// biome-ignore lint: express error middleware needs all 4 params to be recognized
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	console.error(err);
	const message = err instanceof Error ? err.message : "Internal server error";
	res.status(500).json({ error: message });
});

app.listen(config.port, () => {
	console.log(`🚀 Server listening on http://localhost:${config.port}`);
});
