import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Podcast, type PodcastVoice } from "../lib/api.ts";

interface PodcastPanelProps {
	token: string;
	notebookId: string;
}

const POLL_STATUSES = new Set(["PENDING", "GENERATING"]);

type View = "LIST" | "PICKER" | "DETAIL";

function statusLabel(status: Podcast["status"]) {
	if (!status) return "";
	return status.charAt(0) + status.slice(1).toLowerCase();
}

export function PodcastPanel({ token, notebookId }: PodcastPanelProps) {
	const [view, setView] = useState<View>("LIST");
	const [podcasts, setPodcasts] = useState<Podcast[]>([]);
	const [loadingList, setLoadingList] = useState(true);
	const [selected, setSelected] = useState<Podcast | null>(null);
	const [error, setError] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const [generating, setGenerating] = useState(false);

	// Topic-picking step, shown before generation — same idea as RoadmapPanel's:
	// scopes retrieval to a single topic instead of scanning every source.
	const [topics, setTopics] = useState<string[] | null>(null);
	const [loadingTopics, setLoadingTopics] = useState(false);
	const [customTopic, setCustomTopic] = useState("");
	const [pickedTopic, setPickedTopic] = useState<string | null>(null);

	// The audio route needs an Authorization header a plain <audio src> can't
	// send, so the mp3 is fetched as a blob and played from an object URL —
	// same reasoning as fetchSourceFile does for PDFs.
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [loadingAudio, setLoadingAudio] = useState(false);

	const refreshList = useCallback(async () => {
		try {
			const result = await api.listPodcasts(token, notebookId);
			setPodcasts(result);
			return result;
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to load podcasts");
			return [];
		}
	}, [token, notebookId]);

	useEffect(() => {
		refreshList().finally(() => setLoadingList(false));
	}, [refreshList]);

	useEffect(() => {
		if (view !== "DETAIL" || !selected || !POLL_STATUSES.has(selected.status ?? "")) {
			if (pollRef.current) clearInterval(pollRef.current);
			return;
		}
		pollRef.current = setInterval(async () => {
			try {
				const result = await api.getPodcast(token, notebookId, selected.id);
				setSelected(result);
				setPodcasts((prev) => prev.map((p) => (p.id === result.id ? result : p)));
			} catch (err) {
				setError(err instanceof ApiError ? err.message : "Failed to refresh podcast");
			}
		}, 3000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [view, selected, token, notebookId]);

	// Loads the audio blob whenever a READY podcast is opened, and cleans up
	// the previous object URL so blobs don't pile up across selections.
	useEffect(() => {
		setAudioUrl((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
		if (view !== "DETAIL" || !selected || selected.status !== "READY") return;

		let cancelled = false;
		setLoadingAudio(true);
		api
			.fetchPodcastFile(token, notebookId, selected.id)
			.then((buffer) => {
				if (cancelled) return;
				setAudioUrl(URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" })));
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load podcast audio");
			})
			.finally(() => {
				if (!cancelled) setLoadingAudio(false);
			});

		return () => {
			cancelled = true;
		};
	}, [view, selected, token, notebookId]);

	function openPodcast(podcast: Podcast) {
		setSelected(podcast);
		setView("DETAIL");
	}

	async function handleDelete(podcast: Podcast, e: React.MouseEvent) {
		e.stopPropagation();
		if (!window.confirm("Delete this podcast?")) return;
		try {
			await api.deletePodcast(token, notebookId, podcast.id);
			setPodcasts((prev) => prev.filter((p) => p.id !== podcast.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete podcast");
		}
	}

	function openPicker() {
		setTopics(null);
		setCustomTopic("");
		setPickedTopic(null);
		setError(null);
		setView("PICKER");
	}

	async function loadTopics() {
		setLoadingTopics(true);
		setError(null);
		try {
			const result = await api.getPodcastTopics(token, notebookId);
			setTopics(result.topics);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to suggest topics");
		} finally {
			setLoadingTopics(false);
		}
	}

	async function handleGenerate(voice: PodcastVoice) {
		const topic = pickedTopic?.trim();
		if (!topic) return;
		setGenerating(true);
		setError(null);
		try {
			const podcast = await api.generatePodcast(token, notebookId, voice, topic);
			setPodcasts((prev) => [podcast, ...prev]);
			setSelected(podcast);
			setView("DETAIL");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to start podcast generation");
		} finally {
			setGenerating(false);
		}
	}

	return (
		<div style={{ flex: 1, overflowY: "auto", padding: "22px 26px", display: "flex", flexDirection: "column", gap: "16px" }}>
			{error && <p className="error">{error}</p>}

			{view === "LIST" && (
				<>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<h4 style={{ margin: 0 }}>Podcasts</h4>
						<button type="button" className="btn btn-primary" onClick={openPicker}>
							New podcast
						</button>
					</div>

					{loadingList ? (
						<span className="text-muted" style={{ fontSize: "13px" }}>
							Loading…
						</span>
					) : podcasts.length === 0 ? (
						<div style={{ margin: "auto", textAlign: "center", maxWidth: "380px" }}>
							<p className="text-muted" style={{ fontSize: "13px" }}>
								Turn this notebook's sources into a spoken narration you can listen to, in a male or female voice.
							</p>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column" }}>
							{podcasts.map((podcast) => (
								<button
									key={podcast.id}
									type="button"
									onClick={() => openPodcast(podcast)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
										padding: "11px 4px",
										borderBottom: "1px solid var(--color-divider)",
										background: "transparent",
										border: "none",
										borderBottomWidth: "1px",
										borderBottomStyle: "solid",
										borderBottomColor: "var(--color-divider)",
										textAlign: "left",
										cursor: "pointer",
										color: "var(--color-text)",
										width: "100%",
									}}
								>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{podcast.topic} <span className="text-muted">· {podcast.voice === "male" ? "male" : "female"}</span>
										</div>
										<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
											<span className={`status-badge status-${(podcast.status ?? "").toLowerCase()}`}>
												{POLL_STATUSES.has(podcast.status ?? "") && <span className="spinner" />}
												{statusLabel(podcast.status)}
											</span>
											<span className="text-muted" style={{ fontSize: "11px" }}>
												{new Date(podcast.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
											</span>
										</div>
									</div>
									<button type="button" className="btn btn-ghost btn-icon" style={{ width: "26px", height: "26px" }} aria-label="Delete" onClick={(e) => handleDelete(podcast, e)}>
										<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
											<path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM104,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
										</svg>
									</button>
								</button>
							))}
						</div>
					)}
				</>
			)}

			{view === "PICKER" && (
				<div style={{ margin: "auto", textAlign: "center", maxWidth: "440px", width: "100%" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
						<button type="button" className="btn btn-ghost btn-icon" style={{ width: "24px", height: "24px" }} onClick={() => setView("LIST")} aria-label="Back">
							<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
								<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
							</svg>
						</button>
						<h4 style={{ margin: 0 }}>New podcast</h4>
					</div>
					<p className="text-muted" style={{ fontSize: "13px" }}>
						Pick a topic to narrate — a spoken-style script scoped to that topic will be generated and read aloud.
					</p>

					{topics === null ? (
						<button type="button" className="btn btn-primary" style={{ marginTop: "12px" }} onClick={loadTopics} disabled={loadingTopics}>
							{loadingTopics ? "Suggesting topics…" : "Suggest topics"}
						</button>
					) : (
						<div style={{ marginTop: "14px", textAlign: "left" }}>
							{topics.length > 0 && (
								<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
									{topics.map((topic) => (
										<button
											key={topic}
											type="button"
											className="tag tag-outline"
											style={{ cursor: "pointer", ...(pickedTopic === topic ? { fontWeight: 700 } : {}) }}
											onClick={() => setPickedTopic(topic)}
											disabled={generating}
										>
											{topic}
										</button>
									))}
								</div>
							)}
							<input
								className="input"
								type="text"
								placeholder="Or type your own topic…"
								value={customTopic}
								onChange={(e) => {
									setCustomTopic(e.target.value);
									setPickedTopic(e.target.value);
								}}
							/>

							<div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
								<button type="button" className="btn btn-secondary" onClick={() => handleGenerate("male")} disabled={generating || !pickedTopic?.trim()}>
									{generating ? "Starting…" : "Male voice"}
								</button>
								<button type="button" className="btn btn-secondary" onClick={() => handleGenerate("female")} disabled={generating || !pickedTopic?.trim()}>
									{generating ? "Starting…" : "Female voice"}
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{view === "DETAIL" && selected && (
				<>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<button type="button" className="btn btn-ghost btn-icon" style={{ width: "24px", height: "24px", flexShrink: 0 }} onClick={() => setView("LIST")} aria-label="Back">
							<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
								<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
							</svg>
						</button>
						<span className="text-muted" style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
							{selected.voice === "male" ? "Male voice" : "Female voice"} podcast for: <strong>{selected.topic}</strong>
						</span>
					</div>

					{POLL_STATUSES.has(selected.status ?? "") && (
						<div style={{ margin: "auto", textAlign: "center" }}>
							<span className="spinner" />
							<p className="text-muted" style={{ fontSize: "13px", marginTop: "8px" }}>
								{selected.status === "PENDING" ? "Queued…" : "Writing the script and generating audio…"}
							</p>
						</div>
					)}

					{selected.status === "FAILED" && <p className="error">{selected.errorMessage ?? "Podcast generation failed."}</p>}

					{selected.status === "READY" && (
						<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
							{loadingAudio ? (
								<span className="text-muted" style={{ fontSize: "13px" }}>
									Loading audio…
								</span>
							) : audioUrl ? (
								// biome-ignore lint: needs controls for playback
								<audio controls src={audioUrl} style={{ width: "100%" }} />
							) : null}
							{selected.script && (
								<div className="card elev-sm" style={{ padding: "16px 18px", fontSize: "13px", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
									{selected.script}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
