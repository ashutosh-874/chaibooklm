import type { Locator, SourceType } from "./api.ts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Citation {
	n: number;
	chunkId: string;
	sourceId: string;
	sourceTitle: string;
	sourceType: SourceType;
	locator: Locator;
}

interface StreamCallbacks {
	onToken: (text: string) => void;
	onCitations: (citations: Citation[]) => void;
	onDone: () => void;
	onError: (message: string) => void;
}

// Plain `EventSource` can only issue GET requests, but the query endpoint needs
// a POST body (the question) — so this manually reads the fetch response body
// and parses the "event: <name>\ndata: <json>\n\n" frames the server writes.
export async function streamQuery(token: string, notebookId: string, query: string, callbacks: StreamCallbacks) {
	const res = await fetch(`${API_URL}/notebooks/${notebookId}/query`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ query }),
	});

	if (!res.ok || !res.body) {
		const data = await res.json().catch(() => null);
		callbacks.onError(data?.error ?? `Request failed (${res.status})`);
		return;
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const frames = buffer.split("\n\n");
		buffer = frames.pop() ?? ""; // last item may be a partial frame, keep for next read

		for (const frame of frames) {
			const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
			const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
			if (!eventLine || !dataLine) continue;

			const event = eventLine.slice("event: ".length);
			const data = JSON.parse(dataLine.slice("data: ".length));

			if (event === "token") callbacks.onToken(data.text);
			else if (event === "citations") callbacks.onCitations(data.citations);
			else if (event === "done") callbacks.onDone();
			else if (event === "error") callbacks.onError(data.error);
		}
	}
}
