const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
	const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
	// Skip Content-Type for FormData (PDF uploads) so fetch can set the multipart boundary itself.
	if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${API_URL}${path}`, { ...options, headers });

	if (res.status === 204) return undefined as T;

	const data = await res.json().catch(() => null);
	if (!res.ok) {
		throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
	}
	return data as T;
}

export interface User {
	id: string;
	email: string;
}

export interface Notebook {
	id: string;
	name: string;
	userId: string;
	qdrantCollection: string;
	createdAt: string;
	updatedAt: string;
}

// Kept as local string-union types (not imported from @chaibooklm/shared) because that
// package also re-exports Node-only code (Prisma/pg/Qdrant clients) that can't bundle for the browser.
export type SourceType = "PDF" | "TEXT" | "URL" | "YOUTUBE" | "VTT";
export type SourceStatus = "UPLOADING" | "INDEXING" | "READY" | "FAILED";

export interface Source {
	id: string;
	notebookId: string;
	type: SourceType;
	title: string;
	status: SourceStatus;
	errorMessage: string | null;
	// File path on disk for PDF, the raw submitted string for TEXT.
	originIdentifier: string;
	createdAt: string;
	updatedAt: string;
}

// Shape depends on source type: PDF chunks carry `page`, URL chunks carry
// `sourceUrl`, YOUTUBE chunks carry `startSec`/`endSec`/`videoId`, TEXT chunks carry none of these.
export interface Locator {
	page?: number;
	charStart: number;
	charEnd: number;
	sourceUrl?: string;
	startSec?: number;
	endSec?: number;
	videoId?: string;
}

export type RoadmapStatus = "PENDING" | "GENERATING" | "READY" | "FAILED" | null;

// Same shape as queryStream.ts's Citation (minus `n`, which is chat-answer
// specific) — the roadmap job denormalizes this at generation time so the
// existing SourceViewer can open a roadmap citation with no extra fetch.
export interface RoadmapConceptCitation {
	chunkId: string;
	sourceId: string;
	sourceTitle: string;
	sourceType: SourceType;
	locator: Locator;
	text: string;
}

export interface RoadmapConcept {
	title: string;
	summary: string;
	orderRank: number;
	citations: RoadmapConceptCitation[];
}

export interface Roadmap {
	id: string;
	notebookId: string;
	status: RoadmapStatus;
	topic: string | null;
	errorMessage?: string | null;
	concepts: RoadmapConcept[] | null;
	createdAt: string;
	updatedAt: string;
}

export type PodcastStatus = "PENDING" | "GENERATING" | "READY" | "FAILED" | null;
export type PodcastVoice = "male" | "female";

export interface Podcast {
	id: string;
	notebookId: string;
	status: PodcastStatus;
	voice: PodcastVoice;
	topic: string | null;
	script: string | null;
	errorMessage?: string | null;
	createdAt: string;
	updatedAt: string;
}

export const api = {
	signup: (email: string, password: string) =>
		request<{ token: string; user: User }>("/auth/signup", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),
	login: (email: string, password: string) =>
		request<{ token: string; user: User }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),
	listNotebooks: (token: string) => request<Notebook[]>("/notebooks", {}, token),
	getNotebook: (token: string, id: string) => request<Notebook>(`/notebooks/${id}`, {}, token),
	createNotebook: (token: string, name: string) =>
		request<Notebook>("/notebooks", { method: "POST", body: JSON.stringify({ name }) }, token),
	renameNotebook: (token: string, id: string, name: string) =>
		request<Notebook>(`/notebooks/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }, token),
	deleteNotebook: (token: string, id: string) =>
		request<void>(`/notebooks/${id}`, { method: "DELETE" }, token),

	listSources: (token: string, notebookId: string) =>
		request<Source[]>(`/notebooks/${notebookId}/sources`, {}, token),
	createTextSource: (token: string, notebookId: string, text: string, title?: string) =>
		request<Source>(
			`/notebooks/${notebookId}/sources`,
			{ method: "POST", body: JSON.stringify({ text, title }) },
			token,
		),
	createPdfSource: (token: string, notebookId: string, file: File) => {
		const form = new FormData();
		form.append("file", file);
		return request<Source>(`/notebooks/${notebookId}/sources`, { method: "POST", body: form }, token);
	},
	createUrlSource: (token: string, notebookId: string, url: string, title?: string) =>
		request<Source>(
			`/notebooks/${notebookId}/sources`,
			{ method: "POST", body: JSON.stringify({ url, title }) },
			token,
		),
	createYoutubeSource: (token: string, notebookId: string, video: string, title?: string) =>
		request<Source>(
			`/notebooks/${notebookId}/sources`,
			{ method: "POST", body: JSON.stringify({ video, title }) },
			token,
		),
	createTranscriptSource: (token: string, notebookId: string, file: File) => {
		const form = new FormData();
		form.append("file", file);
		return request<Source>(`/notebooks/${notebookId}/sources`, { method: "POST", body: form }, token);
	},
	createYoutubePlaylistSources: (token: string, notebookId: string, playlistUrl: string) =>
		request<{ count: number; sources: Source[] }>(
			`/notebooks/${notebookId}/sources/youtube-playlist`,
			{ method: "POST", body: JSON.stringify({ playlistUrl }) },
			token,
		),
	createVttZipSources: (token: string, notebookId: string, file: File) => {
		const form = new FormData();
		form.append("file", file);
		return request<{ count: number; sources: Source[] }>(
			`/notebooks/${notebookId}/sources/vtt-zip`,
			{ method: "POST", body: form },
			token,
		);
	},
	deleteSource: (token: string, notebookId: string, sourceId: string) =>
		request<void>(`/notebooks/${notebookId}/sources/${sourceId}`, { method: "DELETE" }, token),
	reindexSource: (token: string, notebookId: string, sourceId: string) =>
		request<{ message: string }>(`/notebooks/${notebookId}/sources/${sourceId}/reindex`, { method: "POST" }, token),

	// Not routed through request() — this returns raw PDF bytes, not JSON.
	async fetchSourceFile(token: string, notebookId: string, sourceId: string): Promise<ArrayBuffer> {
		const res = await fetch(`${API_URL}/notebooks/${notebookId}/sources/${sourceId}/file`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) throw new ApiError(res.status, `Failed to load PDF (${res.status})`);
		return res.arrayBuffer();
	},

	listRoadmaps: (token: string, notebookId: string) => request<Roadmap[]>(`/notebooks/${notebookId}/roadmap`, {}, token),
	getRoadmap: (token: string, notebookId: string, roadmapId: string) =>
		request<Roadmap>(`/notebooks/${notebookId}/roadmap/${roadmapId}`, {}, token),
	getRoadmapTopics: (token: string, notebookId: string) =>
		request<{ topics: string[] }>(`/notebooks/${notebookId}/roadmap/topics`, {}, token),
	generateRoadmap: (token: string, notebookId: string, topic: string) =>
		request<Roadmap>(`/notebooks/${notebookId}/roadmap`, { method: "POST", body: JSON.stringify({ topic }) }, token),
	deleteRoadmap: (token: string, notebookId: string, roadmapId: string) =>
		request<void>(`/notebooks/${notebookId}/roadmap/${roadmapId}`, { method: "DELETE" }, token),

	listPodcasts: (token: string, notebookId: string) => request<Podcast[]>(`/notebooks/${notebookId}/podcast`, {}, token),
	getPodcast: (token: string, notebookId: string, podcastId: string) =>
		request<Podcast>(`/notebooks/${notebookId}/podcast/${podcastId}`, {}, token),
	getPodcastTopics: (token: string, notebookId: string) =>
		request<{ topics: string[] }>(`/notebooks/${notebookId}/podcast/topics`, {}, token),
	generatePodcast: (token: string, notebookId: string, voice: PodcastVoice, topic: string) =>
		request<Podcast>(`/notebooks/${notebookId}/podcast`, { method: "POST", body: JSON.stringify({ voice, topic }) }, token),
	deletePodcast: (token: string, notebookId: string, podcastId: string) =>
		request<void>(`/notebooks/${notebookId}/podcast/${podcastId}`, { method: "DELETE" }, token),

	// Not routed through request() — this returns raw mp3 bytes, not JSON. A
	// plain <audio src> can't send an Authorization header, so the caller fetches
	// this as a blob and points <audio> at an object URL instead (see fetchSourceFile).
	async fetchPodcastFile(token: string, notebookId: string, podcastId: string): Promise<ArrayBuffer> {
		const res = await fetch(`${API_URL}/notebooks/${notebookId}/podcast/${podcastId}/file`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) throw new ApiError(res.status, `Failed to load podcast audio (${res.status})`);
		return res.arrayBuffer();
	},
};
