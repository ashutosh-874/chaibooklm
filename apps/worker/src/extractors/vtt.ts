import { parseSync } from "subtitle";
import type { TimedSegment } from "../lib/chunk.ts";

// `subtitle`'s parseSync auto-detects SRT vs WebVTT and returns a unified cue
// list ({start,end} in ms) either way — one parser handles both formats, so
// there's no separate SRT code path needed. Takes the raw file text directly
// (already downloaded from S3 by the caller) rather than reading from disk.
export function extractVtt(raw: string): TimedSegment[] {
	const nodes = parseSync(raw);

	const segments: TimedSegment[] = [];
	for (const node of nodes) {
		if (node.type !== "cue") continue;
		const text = node.data.text.trim();
		if (!text) continue;
		segments.push({ start: node.data.start / 1000, dur: (node.data.end - node.data.start) / 1000, text });
	}

	if (segments.length === 0) {
		throw new Error("No cues found in this transcript file");
	}

	return segments;
}
