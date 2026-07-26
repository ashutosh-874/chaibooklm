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

interface DialogueLine {
	speaker: "A" | "B";
	text: string;
}

export function parseDialogue(script: string): DialogueLine[] {
	const lines = script.split("\n");
	const dialogue: DialogueLine[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("Host A:")) {
			dialogue.push({ speaker: "A", text: trimmed.substring(7).trim() });
		} else if (trimmed.startsWith("Host B:")) {
			dialogue.push({ speaker: "B", text: trimmed.substring(7).trim() });
		} else if (trimmed) {
			// If it doesn't have a tag but there's text, append it to the last line or default to Host A
			if (dialogue.length > 0) {
				dialogue[dialogue.length - 1].text += " " + trimmed;
			} else {
				dialogue.push({ speaker: "A", text: trimmed });
			}
		}
	}
	return dialogue;
}

// Synthesizes a full narration script into a single mp3 buffer. Supports
// dual-host dialogue via Google Cloud TTS — Host A always speaks in the voice
// the user picked (the one shown as "selected" in PodcastPanel), Host B gets
// the other voice, so the picker still controls the primary narrator instead
// of being silently ignored.
export async function synthesizeSpeech(script: string, voice: "male" | "female"): Promise<Buffer> {
	if (!config.googleTts.apiKey) {
		throw new Error("Podcast generation isn't configured (missing GOOGLE_TTS_API_KEY)");
	}

	const voiceNameA = voice === "male" ? config.googleTts.voiceNameMale : config.googleTts.voiceNameFemale;
	const voiceNameB = voice === "male" ? config.googleTts.voiceNameFemale : config.googleTts.voiceNameMale;

	const dialogue = parseDialogue(script);
	const buffers: Buffer[] = [];

	for (const line of dialogue) {
		const voiceName = line.speaker === "A" ? voiceNameA : voiceNameB;
		// Guard against an unusually long single turn exceeding Google TTS's per-request limit.
		for (const part of splitScript(line.text)) {
			buffers.push(await synthesizePart(part, voiceName));
		}
	}

	return Buffer.concat(buffers);
}
