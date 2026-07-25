import { getVideoDetails } from "youtube-caption-extractor";
import type { TimedSegment } from "../lib/chunk.ts";

export interface YoutubeExtractResult {
	title: string | null;
	segments: TimedSegment[];
}

// Fetches timestamped captions + metadata for a video. Like every YouTube-transcript
// library, this hits an unofficial internal API — treat "no captions" or a thrown
// error as an expected failure mode (FAILED, readable message), not a bug to retry around.
export async function extractYoutube(videoId: string): Promise<YoutubeExtractResult> {
	const details = await getVideoDetails({ videoID: videoId });

	const segments = details.subtitles
		.map((s) => ({ start: Number.parseFloat(s.start), dur: Number.parseFloat(s.dur), text: s.text }))
		.filter((s) => Number.isFinite(s.start) && Number.isFinite(s.dur));

	if (segments.length === 0) {
		throw new Error("No captions available for this video");
	}

	return { title: details.title?.trim() || null, segments };
}
