import { config } from "../config.ts";

const MAX_PLAYLIST_VIDEOS = 50;

export interface PlaylistVideo {
	videoId: string;
	title: string;
}

// Pulls the `list=` param out of common playlist URL forms, or accepts a bare playlist ID.
export function extractPlaylistId(input: string): string | null {
	const trimmed = input.trim();
	const match = trimmed.match(/[?&]list=([\w-]+)/);
	if (match) return match[1];
	if (/^[\w-]{10,}$/.test(trimmed)) return trimmed; // bare ID, generous length check
	return null;
}

interface PlaylistItemsResponse {
	items?: Array<{
		snippet?: { title?: string; resourceId?: { videoId?: string } };
	}>;
	nextPageToken?: string;
	error?: { message?: string };
}

// Resolves a playlist into its video IDs + titles via the YouTube Data API v3,
// paginating through playlistItems.list. Capped at MAX_PLAYLIST_VIDEOS so one
// request can't enqueue an unbounded number of ingest jobs.
export async function resolvePlaylistVideoIds(playlistUrl: string): Promise<PlaylistVideo[]> {
	if (!config.youtube.dataApiKey) {
		throw new Error("YouTube playlist import isn't configured (missing YOUTUBE_DATA_API_KEY)");
	}

	const playlistId = extractPlaylistId(playlistUrl);
	if (!playlistId) {
		throw new Error("Couldn't find a valid playlist ID in that URL");
	}

	const videos: PlaylistVideo[] = [];
	let pageToken: string | undefined;

	do {
		const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
		url.searchParams.set("part", "snippet");
		url.searchParams.set("playlistId", playlistId);
		url.searchParams.set("maxResults", "50");
		url.searchParams.set("key", config.youtube.dataApiKey);
		if (pageToken) url.searchParams.set("pageToken", pageToken);

		const res = await fetch(url);
		const data = (await res.json()) as PlaylistItemsResponse;

		if (!res.ok) {
			throw new Error(`YouTube Data API error: ${data.error?.message ?? res.statusText}`);
		}

		for (const item of data.items ?? []) {
			const videoId = item.snippet?.resourceId?.videoId;
			if (!videoId) continue;
			videos.push({ videoId, title: item.snippet?.title?.trim() || videoId });
			if (videos.length >= MAX_PLAYLIST_VIDEOS) return videos;
		}

		pageToken = data.nextPageToken;
	} while (pageToken);

	if (videos.length === 0) {
		throw new Error("This playlist has no videos, or it's private/unavailable");
	}

	return videos;
}
