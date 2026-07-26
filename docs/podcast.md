# Podcast (bonus feature)

Flow: **suggest topics → pick one + voice → retrieval-scoped script → Google TTS → mp3.**

## Schema

`Podcast` in [prisma/schema.prisma](../prisma/schema.prisma) — `status` (`PENDING|GENERATING|READY|FAILED`), `voice` (`"male"|"female"`), `topic`, `script`, `audioPath`. Many rows per notebook.

## Topic suggestions

Same `suggestTopics()` as roadmap — `GET /notebooks/:notebookId/podcast/topics` in [apps/server/src/routes/podcast.ts](../apps/server/src/routes/podcast.ts).

## Generation route

`POST /notebooks/:notebookId/podcast` `{ voice, topic }` — creates `Podcast` row (`PENDING`), enqueues, 202. `GET /:podcastId/file` streams the mp3 (`res.type("audio/mpeg")`).

## Worker job

[apps/worker/src/jobs/generatePodcast.ts](../apps/worker/src/jobs/generatePodcast.ts):

```ts
export async function generatePodcast(podcastId: string) {
	// status = GENERATING
	const [vector] = await embedTexts([topic]);
	const hits = await searchByVector(notebook.qdrantCollection, vector, RETRIEVAL_TOP_K); // 30
	// group retrieved chunks by source
	const script = await generatePodcastScript(sourceInputs, topic); // plain text, not JSON
	const audioBuffer = await synthesizeSpeech(script, voice);
	await fs.writeFile(path.join(uploadDir, `podcast-${podcastId}.mp3`), audioBuffer);
	// status = READY, script + audioPath stored
}
```

Same topic-embed → Qdrant-search pattern as [roadmap.md](roadmap.md), grouped by source for the script prompt instead of per-concept citations.

## Script generation

`generatePodcastScript` in [apps/worker/src/lib/openai.ts](../apps/worker/src/lib/openai.ts) — plain chat completion (no structured JSON, same style as `hydeDocument` in [rag-query.md](rag-query.md)):

> "You are a podcast host writing a solo narration script about the topic... 700-1000 words... no stage directions, sound effect cues, or headings."

## Text-to-speech

[apps/worker/src/lib/googleTts.ts](../apps/worker/src/lib/googleTts.ts) — direct `fetch` to Google Cloud TTS REST API, **API-key auth** (`?key=`), not a service account:

```ts
fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
	method: "POST",
	body: JSON.stringify({ input: { text }, voice: { languageCode, name: voiceName }, audioConfig: { audioEncoding: "MP3" } }),
});
```

Script > ~4500 chars is split on paragraph boundaries (`splitScript`), synthesized per-part, mp3 buffers concatenated (`Buffer.concat`) — Google TTS caps request text at 5,000 bytes.

## Shared file storage

[apps/worker/src/lib/uploads.ts](../apps/worker/src/lib/uploads.ts) — worker writes to the same `apps/server/uploads` directory the server's multer uploads use (`path.join(__dirname, "..", "..", "..", "server", "uploads")`), so the server's file route can read it back with no extra plumbing.

## Env

`GOOGLE_TTS_API_KEY`, `GOOGLE_TTS_VOICE_MALE` (default `en-US-Standard-D`), `GOOGLE_TTS_VOICE_FEMALE` (default `en-US-Standard-F`) — [apps/worker/src/config.ts](../apps/worker/src/config.ts).

## Frontend

[apps/web/src/components/PodcastPanel.tsx](../apps/web/src/components/PodcastPanel.tsx) — list → topic+voice picker → detail. Audio fetched as an authenticated blob (`fetchPodcastFile`) and played via `URL.createObjectURL` — a plain `<audio src>` can't send the `Authorization` header the file route requires.
