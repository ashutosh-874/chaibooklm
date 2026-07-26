import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Podcast } from "../lib/api.ts";

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

interface DialogueLine {
	speaker: string;
	text: string;
}

function parseScriptToDialogue(script: string): DialogueLine[] {
	const lines = script.split("\n");
	const dialogue: DialogueLine[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("Host A:")) {
			dialogue.push({ speaker: "Host A", text: trimmed.substring(7).trim() });
		} else if (trimmed.startsWith("Host B:")) {
			dialogue.push({ speaker: "Host B", text: trimmed.substring(7).trim() });
		} else if (trimmed) {
			if (dialogue.length > 0) {
				dialogue[dialogue.length - 1].text += "\n" + trimmed;
			} else {
				dialogue.push({ speaker: "Host A", text: trimmed });
			}
		}
	}
	return dialogue;
}

interface CustomAudioPlayerProps {
	src: string;
}

export function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [volume, setVolume] = useState(1);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.src = src;
		audio.load();
		setIsPlaying(false);
		setCurrentTime(0);
	}, [src]);

	const togglePlay = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (isPlaying) {
			audio.pause();
			setIsPlaying(false);
		} else {
			audio.play().catch((err) => console.error("Audio playback error:", err));
			setIsPlaying(true);
		}
	};

	const handleTimeUpdate = () => {
		if (audioRef.current) {
			setCurrentTime(audioRef.current.currentTime);
		}
	};

	const handleLoadedMetadata = () => {
		if (audioRef.current) {
			setDuration(audioRef.current.duration);
		}
	};

	const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseFloat(e.target.value);
		if (audioRef.current) {
			audioRef.current.currentTime = val;
			setCurrentTime(val);
		}
	};

	const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const val = Number.parseFloat(e.target.value);
		setSpeed(val);
		if (audioRef.current) {
			audioRef.current.playbackRate = val;
		}
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseFloat(e.target.value);
		setVolume(val);
		if (audioRef.current) {
			audioRef.current.volume = val;
		}
	};

	const formatTime = (time: number) => {
		if (Number.isNaN(time)) return "0:00";
		const mins = Math.floor(time / 60);
		const secs = Math.floor(time % 60);
		return `${mins}:${String(secs).padStart(2, "0")}`;
	};

	return (
		<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(35, 37, 50, 0.75)", backdropFilter: "blur(12px)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)" }}>
			<audio
				ref={audioRef}
				onTimeUpdate={handleTimeUpdate}
				onLoadedMetadata={handleLoadedMetadata}
				onEnded={() => setIsPlaying(false)}
			/>
			
			<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
				<button
					type="button"
					onClick={togglePlay}
					className="btn btn-primary btn-icon"
					style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--color-accent)", color: "var(--color-bg)", border: "none", boxShadow: "0 0 10px rgba(145, 132, 217, 0.4)", flexShrink: 0 }}
					aria-label={isPlaying ? "Pause" : "Play"}
				>
					{isPlaying ? (
						<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
							<path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"/>
						</svg>
					) : (
						<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
							<path d="M228.4,121.37,76.4,32.33A8,8,0,0,0,64,39.22V216.78a8,8,0,0,0,12.4,6.89l152-89a8,8,0,0,0,0-13.3Z"/>
						</svg>
					)}
				</button>
				
				<div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
					<span style={{ fontSize: "12px", fontFamily: "monospace", opacity: 0.8 }}>{formatTime(currentTime)}</span>
					<input
						type="range"
						min="0"
						max={duration || 100}
						value={currentTime}
						onChange={handleScrub}
						style={{ flex: 1, height: "4px", accentColor: "var(--color-accent)", background: "var(--color-neutral-800)", border: "none", borderRadius: "2px", cursor: "pointer" }}
					/>
					<span style={{ fontSize: "12px", fontFamily: "monospace", opacity: 0.8 }}>{formatTime(duration)}</span>
				</div>
			</div>
			
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "10px", marginTop: "4px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" style={{ opacity: 0.7 }}>
						<path d="M160,32a8,8,0,0,0-8,8v176a8,8,0,0,0,13.66,5.66L232,155.31V100.69L165.66,34.34A8,8,0,0,0,160,32ZM72,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H72l69.66,69.66A8,8,0,0,0,155,239.31v-222A8,8,0,0,0,141.66,11L72,80Z"/>
					</svg>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={volume}
						onChange={handleVolumeChange}
						style={{ width: "70px", height: "4px", accentColor: "var(--color-accent)", background: "var(--color-neutral-800)", cursor: "pointer" }}
					/>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<span style={{ fontSize: "11px", opacity: 0.7 }}>Speed</span>
					<select
						value={speed}
						onChange={handleSpeedChange}
						style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", padding: "2px 6px", fontSize: "12px", outline: "none", cursor: "pointer" }}
					>
						<option value="1">1.0x</option>
						<option value="1.25">1.25x</option>
						<option value="1.5">1.5x</option>
						<option value="2">2.0x</option>
					</select>
				</div>
			</div>
		</div>
	);
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

	async function handleGenerate(topic: string | null) {
		const trimmedTopic = topic?.trim();
		if (!trimmedTopic) return;
		setGenerating(true);
		setError(null);
		try {
			const podcast = await api.generatePodcast(token, notebookId, trimmedTopic);
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
							<div style={{ width: "44px", height: "44px", margin: "0 auto 12px", borderRadius: "12px", background: "var(--color-accent-900)", color: "var(--color-accent-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
								<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
									<path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z" />
								</svg>
							</div>
							<p className="text-muted" style={{ fontSize: "13px" }}>
								Turn this notebook's sources into a two-host podcast dialogue you can listen to.
							</p>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column" }}>
							{podcasts.map((podcast) => (
								<button key={podcast.id} type="button" onClick={() => openPodcast(podcast)} className="list-row">
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{podcast.topic}
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
						Pick a topic to narrate — a two-host dialogue script scoped to that topic will be generated and read aloud.
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
											style={{ cursor: "pointer" }}
											onClick={() => handleGenerate(topic)}
											disabled={generating}
										>
											{topic}
										</button>
									))}
								</div>
							)}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									handleGenerate(customTopic);
								}}
								style={{ display: "flex", gap: "8px" }}
							>
								<input
									className="input"
									type="text"
									placeholder="Or type your own topic…"
									value={customTopic}
									onChange={(e) => setCustomTopic(e.target.value)}
								/>
								<button type="submit" className="btn btn-primary" disabled={generating || !customTopic.trim()}>
									{generating ? "Starting…" : "Go"}
								</button>
							</form>
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
							Podcast for: <strong>{selected.topic}</strong>
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
						<div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
							{loadingAudio ? (
								<span className="text-muted" style={{ fontSize: "13px" }}>
									Loading audio…
								</span>
							) : audioUrl ? (
								<CustomAudioPlayer src={audioUrl} />
							) : null}
							
							{selected.script && (
								<div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px" }}>
									{parseScriptToDialogue(selected.script).map((line, idx) => {
										const isHostA = line.speaker === "Host A";
										return (
											<div
												key={idx}
												style={{
													display: "flex",
													flexDirection: "column",
													alignSelf: isHostA ? "flex-start" : "flex-end",
													maxWidth: "85%",
													alignItems: isHostA ? "flex-start" : "flex-end",
												}}
											>
												<span style={{ fontSize: "10px", fontWeight: 600, color: isHostA ? "var(--color-accent)" : "var(--color-accent-2)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
													{line.speaker}
												</span>
												<div
													style={{
														padding: "10px 14px",
														borderRadius: "14px",
														borderTopLeftRadius: isHostA ? "2px" : "14px",
														borderTopRightRadius: isHostA ? "14px" : "2px",
														background: isHostA ? "var(--color-surface)" : "var(--color-accent-900)",
														border: "1px solid var(--color-divider)",
														fontSize: "13px",
														lineHeight: "1.55",
														color: "var(--color-text)",
														boxShadow: "var(--shadow-sm)"
													}}
												>
													{line.text}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
