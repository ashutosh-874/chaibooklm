import { config } from "../config.ts";

// Google Cloud TTS caps request text at 5,000 bytes — split on paragraph
// boundaries and synthesize each piece separately rather than truncating the
// script or risking a rejected request on longer notebooks.
const MAX_CHARS_PER_REQUEST = 4500;

function splitScript(script: string): string[] {
	const paragraphs = script.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
	const parts: string[] = [];
	let current = "";

	for (const paragraph of paragraphs) {
		if (current && current.length + 2 + paragraph.length > MAX_CHARS_PER_REQUEST) {
			parts.push(current);
			current = "";
		}
		current = current ? `${current}\n\n${paragraph}` : paragraph;
	}
	if (current) parts.push(current);

	return parts.length > 0 ? parts : [script];
}

interface SynthesizeResponse {
	audioContent?: string;
	error?: { message?: string };
}

async function synthesizePart(text: string, voiceName: string): Promise<Buffer> {
	// languageCode must match the voice's locale prefix, e.g. "en-US-Standard-D" -> "en-US".
	const languageCode = voiceName.split("-").slice(0, 2).join("-");

	const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.googleTts.apiKey}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			input: { text },
			voice: { languageCode, name: voiceName },
			audioConfig: { audioEncoding: "MP3" },
		}),
	});

	const data = (await res.json()) as SynthesizeResponse;
	if (!res.ok || !data.audioContent) {
		throw new Error(`Google TTS request failed (${res.status}): ${data.error?.message ?? "no audio returned"}`);
	}

	return Buffer.from(data.audioContent, "base64");
}

// Synthesizes a full narration script into a single mp3 buffer. Splits long
// scripts across multiple Google TTS requests (see splitScript) and
// concatenates the resulting mp3 bytes — sequential mp3 frames concatenate
// cleanly enough for spoken narration, no re-encoding needed for v1.
export async function synthesizeSpeech(script: string, voice: "male" | "female"): Promise<Buffer> {
	if (!config.googleTts.apiKey) {
		throw new Error("Podcast generation isn't configured (missing GOOGLE_TTS_API_KEY)");
	}

	const voiceName = voice === "male" ? config.googleTts.voiceNameMale : config.googleTts.voiceNameFemale;
	const parts = splitScript(script);
	const buffers: Buffer[] = [];
	for (const part of parts) {
		buffers.push(await synthesizePart(part, voiceName));
	}
	return Buffer.concat(buffers);
}
