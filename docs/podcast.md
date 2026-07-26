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

`generatePodcastScript` in [apps/worker/src/lib/openai.ts](../apps/worker/src/lib/openai.ts) — plain chat completion (no structured JSON, same style as `hydeDocument` in [rag-query.md](rag-query.md)). Writes a **two-host dialogue**, not a solo narration:

> "You are writing a podcast dialogue script between two hosts (Host A and Host B)... Host A is the main deep-dive narrator/expert and Host B asks inquisitive, clarifying questions... formatted exactly as sequential dialogue lines starting with either 'Host A: ' or 'Host B: '."

## Text-to-speech

[apps/worker/src/lib/googleTts.ts](../apps/worker/src/lib/googleTts.ts):

1. `parseDialogue(script)` splits the script into `{ speaker: "A" | "B", text }` lines by the `Host A:`/`Host B:` prefixes.
2. `synthesizeSpeech(script, voice)` maps the user's picked `voice` to Host A, and the opposite voice to Host B — so the picker still controls the primary narrator's voice instead of always producing a fixed male/female pairing:

```ts
const voiceNameA = voice === "male" ? config.googleTts.voiceNameMale : config.googleTts.voiceNameFemale;
const voiceNameB = voice === "male" ? config.googleTts.voiceNameFemale : config.googleTts.voiceNameMale;
```

3. Each dialogue line is synthesized separately via direct `fetch` to the Google Cloud TTS REST API, **API-key auth** (`?key=`), not a service account:

```ts
fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
	method: "POST",
	body: JSON.stringify({ input: { text }, voice: { languageCode, name: voiceName }, audioConfig: { audioEncoding: "MP3" } }),
});
```

4. Any single turn over ~4500 chars is further split on paragraph boundaries (`splitScript`) — Google TTS caps request text at 5,000 bytes. All resulting mp3 buffers are concatenated in order (`Buffer.concat`).

## Shared file storage

[apps/worker/src/lib/uploads.ts](../apps/worker/src/lib/uploads.ts) — worker writes to the same `apps/server/uploads` directory the server's multer uploads use (`path.join(__dirname, "..", "..", "..", "server", "uploads")`), so the server's file route can read it back with no extra plumbing.

## Env

`GOOGLE_TTS_API_KEY`, `GOOGLE_TTS_VOICE_MALE` (default `en-US-Standard-D`), `GOOGLE_TTS_VOICE_FEMALE` (default `en-US-Standard-F`) — [apps/worker/src/config.ts](../apps/worker/src/config.ts).

## Frontend

[apps/web/src/components/PodcastPanel.tsx](../apps/web/src/components/PodcastPanel.tsx) — list → topic+voice picker → detail. Audio fetched as an authenticated blob (`fetchPodcastFile`) and played via `URL.createObjectURL` — a plain `<audio src>` can't send the `Authorization` header the file route requires.
