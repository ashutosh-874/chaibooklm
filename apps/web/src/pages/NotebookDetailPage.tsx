import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { SourceViewer } from "../components/SourceViewer.tsx";
import { AddSourceModal } from "../components/AddSourceModal.tsx";
import { RoadmapPanel } from "../components/RoadmapPanel.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { api, ApiError, type Notebook, type Source } from "../lib/api.ts";
import { type Citation, streamQuery } from "../lib/queryStream.ts";

function isSettling(sources: Source[]) {
	return sources.some((s) => s.status === "UPLOADING" || s.status === "INDEXING");
}

export function NotebookDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { token } = useAuth();
	const navigate = useNavigate();
	const [notebook, setNotebook] = useState<Notebook | null>(null);
	const [sources, setSources] = useState<Source[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [text, setText] = useState("");
	const [textTitle, setTextTitle] = useState("");
	const [submittingText, setSubmittingText] = useState(false);
	const [submittingPdf, setSubmittingPdf] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [submittingVtt, setSubmittingVtt] = useState(false);
	const vttFileInputRef = useRef<HTMLInputElement>(null);

	const [url, setUrl] = useState("");
	const [urlTitle, setUrlTitle] = useState("");
	const [submittingUrl, setSubmittingUrl] = useState(false);
	const [youtubeVideo, setYoutubeVideo] = useState("");
	const [youtubeTitle, setYoutubeTitle] = useState("");
	const [submittingYoutube, setSubmittingYoutube] = useState(false);

	const [chatQuery, setChatQuery] = useState("");
	const [chatQuerySubmitted, setChatQuerySubmitted] = useState("");
	const [answer, setAnswer] = useState("");
	const [citations, setCitations] = useState<Citation[]>([]);
	const [asking, setAsking] = useState(false);
	const [chatError, setChatError] = useState<string | null>(null);
	const [viewingCitation, setViewingCitation] = useState<Citation | null>(null);
	
	const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
	const [rightTab, setRightTab] = useState<"CHAT" | "ROADMAP">("CHAT");

	const [playlistUrl, setPlaylistUrl] = useState("");
	const [submittingPlaylist, setSubmittingPlaylist] = useState(false);

	const refreshSources = useCallback(async () => {
		if (!token || !id) return;
		try {
			setSources(await api.listSources(token, id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to load sources");
		}
	}, [token, id]);

	useEffect(() => {
		if (!token || !id) return;
		api.getNotebook(token, id).then(setNotebook).catch(() => setError("Notebook not found"));
		refreshSources();
	}, [token, id, refreshSources]);

	useEffect(() => {
		if (!isSettling(sources)) return;
		const timer = setInterval(refreshSources, 2000);
		return () => clearInterval(timer);
	}, [sources, refreshSources]);

	async function handleAddText(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !id || !text.trim()) return;
		setSubmittingText(true);
		setError(null);
		try {
			const source = await api.createTextSource(token, id, text.trim(), textTitle.trim() || undefined);
			setSources((prev) => [source, ...prev]);
			setText("");
			setTextTitle("");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to add text source");
		} finally {
			setSubmittingText(false);
		}
	}

	async function handleAddPdf(e: React.FormEvent) {
		e.preventDefault();
		const file = fileInputRef.current?.files?.[0];
		if (!token || !id || !file) return;
		setSubmittingPdf(true);
		setError(null);
		try {
			const source = await api.createPdfSource(token, id, file);
			setSources((prev) => [source, ...prev]);
			if (fileInputRef.current) fileInputRef.current.value = "";
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to upload PDF");
		} finally {
			setSubmittingPdf(false);
		}
	}

	async function handleAddVtt(e: React.FormEvent) {
		e.preventDefault();
		const file = vttFileInputRef.current?.files?.[0];
		if (!token || !id || !file) return;
		setSubmittingVtt(true);
		setError(null);
		try {
			if (file.name.toLowerCase().endsWith(".zip")) {
				const result = await api.createVttZipSources(token, id, file);
				setSources((prev) => [...result.sources, ...prev]);
			} else {
				const source = await api.createTranscriptSource(token, id, file);
				setSources((prev) => [source, ...prev]);
			}
			if (vttFileInputRef.current) vttFileInputRef.current.value = "";
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to add transcript(s)");
		} finally {
			setSubmittingVtt(false);
		}
	}

	async function handleAddUrl(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !id || !url.trim()) return;
		setSubmittingUrl(true);
		setError(null);
		try {
			const source = await api.createUrlSource(token, id, url.trim(), urlTitle.trim() || undefined);
			setSources((prev) => [source, ...prev]);
			setUrl("");
			setUrlTitle("");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to add web page");
		} finally {
			setSubmittingUrl(false);
		}
	}

	async function handleAddYoutube(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !id || !youtubeVideo.trim()) return;
		setSubmittingYoutube(true);
		setError(null);
		try {
			const source = await api.createYoutubeSource(token, id, youtubeVideo.trim(), youtubeTitle.trim() || undefined);
			setSources((prev) => [source, ...prev]);
			setYoutubeVideo("");
			setYoutubeTitle("");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to add YouTube video");
		} finally {
			setSubmittingYoutube(false);
		}
	}

	async function handleAddPlaylist(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !id || !playlistUrl.trim()) return;
		setSubmittingPlaylist(true);
		setError(null);
		try {
			const result = await api.createYoutubePlaylistSources(token, id, playlistUrl.trim());
			setSources((prev) => [...result.sources, ...prev]);
			setPlaylistUrl("");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to add playlist");
		} finally {
			setSubmittingPlaylist(false);
		}
	}

	async function handleDelete(source: Source) {
		if (!token || !id) return;
		if (!window.confirm(`Delete "${source.title}"?`)) return;
		try {
			await api.deleteSource(token, id, source.id);
			setSources((prev) => prev.filter((s) => s.id !== source.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete source");
		}
	}

	async function handleReindex(source: Source) {
		if (!token || !id) return;
		try {
			await api.reindexSource(token, id, source.id);
			refreshSources();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to reindex source");
		}
	}

	async function handleAsk(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !id || !chatQuery.trim() || asking) return;
		setAsking(true);
		setChatQuerySubmitted(chatQuery.trim());
		setChatQuery("");
		setAnswer("");
		setCitations([]);
		setChatError(null);
		try {
			await streamQuery(token, id, chatQuery.trim(), {
				onToken: (t) => setAnswer((prev) => prev + t),
				onCitations: setCitations,
				onDone: () => setAsking(false),
				onError: (message) => {
					setChatError(message);
					setAsking(false);
				},
			});
		} catch (err) {
			setChatError(err instanceof Error ? err.message : "Query failed");
			setAsking(false);
		}
	}

	function renderAnswerText(text: string, currentCitations: Citation[]) {
		const parts = text.split(/(\[\d+\])/g);
		return parts.map((part, index) => {
			const match = part.match(/^\[(\d+)\]$/);
			if (match) {
				const n = parseInt(match[1], 10);
				const citation = currentCitations.find((c) => c.n === n);
				if (citation) {
					return (
						<button
							key={index}
							type="button"
							className="citation-chip-inline"
							onClick={() => setViewingCitation(citation)}
						>
							{n}
						</button>
					);
				}
			}
			return <span key={index}>{part}</span>;
		});
	}

	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)", overflow: "hidden" }}>
			{/* Navigation Header */}
			<nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)", flexShrink: 0 }}>
				<button type="button" className="btn btn-ghost btn-icon" aria-label="Back" onClick={() => navigate("/")}>
					<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
						<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/>
					</svg>
				</button>
				<span className="nav-brand" style={{ fontSize: "15px" }}>{notebook?.name ?? "…"}</span>
				<span className="tag tag-neutral">{sources.length} {sources.length === 1 ? "source" : "sources"}</span>
			</nav>

			{/* Main Two-Pane Layout */}
			<div style={{ flex: 1, display: "flex", flexWrap: "wrap", overflow: "hidden" }}>
				{/* Left Pane: Sources */}
				<div style={{ flex: "1 1 340px", minWidth: "300px", maxWidth: "420px", borderRight: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", height: "100%" }}>
					<div style={{ padding: "16px 18px 10px", flexShrink: 0 }}>
						<button type="button" className="btn btn-primary btn-block" onClick={() => setIsAddSourceOpen(true)}>
							<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
								<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>
							</svg>
							Add source
						</button>
					</div>

					<div style={{ padding: "6px 18px 24px", flex: 1, overflowY: "auto" }}>
						{error && <p className="error" style={{ marginBottom: "12px" }}>{error}</p>}
						
						{sources.length === 0 ? (
							<div style={{ textAlign: "center", padding: "48px 12px", opacity: 0.8 }}>
								<p className="text-muted" style={{ fontSize: "13px" }}>
									No sources yet. Add a PDF, page, or transcript to start building this notebook's knowledge base.
								</p>
							</div>
						) : (
							<div style={{ display: "flex", flexDirection: "column" }}>
								{sources.map((source) => {
									const isSpinning = source.status === "UPLOADING" || source.status === "INDEXING";
									const hasDot = source.status === "READY" || source.status === "FAILED";
									const statusClass = `status-badge status-${source.status.toLowerCase()}`;
									const statusLabel = source.status.charAt(0) + source.status.slice(1).toLowerCase();
									
									const date = new Date(source.createdAt).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric"
									});
									const meta = `${source.type} · added ${date}`;

									return (
										<div key={source.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 0", borderBottom: "1px solid var(--color-divider)" }}>
											<div style={{ width: "30px", height: "30px", flex: "none", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
												{source.type === "PDF"
												? "PDF"
												: source.type === "URL"
													? "URL"
													: source.type === "YOUTUBE"
														? "YT"
														: source.type === "VTT"
															? "VTT"
															: "TXT"}
											</div>
											
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
													{source.title}
												</div>
												<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
													<span className={statusClass}>
														{isSpinning && <span className="spinner" />}
														{hasDot && <span className="status-dot" />}
														{statusLabel}
													</span>
													<span className="text-muted" style={{ fontSize: "11px" }}>{meta}</span>
												</div>
												{source.status === "FAILED" && source.errorMessage && (
													<div className="error source-error">{source.errorMessage}</div>
												)}
											</div>
											
											<div style={{ display: "flex", gap: "2px", flex: "none" }}>
												<button type="button" className="btn btn-ghost btn-icon" style={{ width: "26px", height: "26px" }} aria-label="Reindex" onClick={() => handleReindex(source)}>
													<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
														<path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.75,170.82,224,128,224c-37.32,0-63.7-21.24-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44a95.87,95.87,0,0,0,72,32.09c35.83,0,58.5-21.4,59.31-22.09a8,8,0,0,1,10.92-1.63ZM216,32a8,8,0,0,0-8,8V64.15C191.7,45.24,165.32,24,128,24,85.18,24,59.42,49.25,58.33,50.34a8,8,0,0,0,11.34,11.32C70.48,60.93,93.15,40,128,40a95.87,95.87,0,0,1,72,32.09H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Z"/>
													</svg>
												</button>
												<button type="button" className="btn btn-ghost btn-icon" style={{ width: "26px", height: "26px" }} aria-label="Delete" onClick={() => handleDelete(source)}>
													<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
														<path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM104,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/>
													</svg>
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{/* Right Pane: Chat / Roadmap */}
				<div style={{ flex: "2 1 480px", minWidth: "340px", display: "flex", flexDirection: "column", height: "100%" }}>
					<Tabs
						tabs={[
							{ value: "CHAT", label: "Chat" },
							{ value: "ROADMAP", label: "Roadmap" },
						]}
						active={rightTab}
						onChange={setRightTab}
					/>

					{rightTab === "ROADMAP" && token && id && (
						<RoadmapPanel token={token} notebookId={id} onViewCitation={setViewingCitation} />
					)}

					{rightTab === "CHAT" && (
					<>
					{/* Messages List Area */}
					<div style={{ flex: 1, overflowY: "auto", padding: "22px 26px", display: "flex", flexDirection: "column", gap: "18px" }}>
						{chatError && <p className="error">{chatError}</p>}

						{!chatQuerySubmitted && !answer && !asking ? (
							<div style={{ margin: "auto", textAlign: "center", maxWidth: "360px" }}>
								<h4 style={{ marginBottom: "6px" }}>Ask this notebook something</h4>
								<p className="text-muted" style={{ fontSize: "13px" }}>
									Answers are grounded in your sources with inline citations you can click through to verify.
								</p>
								<button
									type="button"
									className="btn btn-secondary"
									style={{ marginTop: "12px" }}
									onClick={() => {
										setChatQuery("What positional encoding does the original Transformer use, and why sinusoidal?");
									}}
								>
									Try: "What positional encoding does the Transformer use?"
								</button>
							</div>
						) : (
							<>
								{/* User query message bubble */}
								{chatQuerySubmitted && (
									<div style={{ alignSelf: "flex-end", maxWidth: "72%", background: "var(--color-accent-900)", color: "var(--color-text)", padding: "10px 14px", borderRadius: "12px 12px 2px 12px", fontSize: "14px" }}>
										{chatQuerySubmitted}
									</div>
								)}

								{/* AI Answer streaming card */}
								{(answer || asking) && (
									<div style={{ maxWidth: "88%" }}>
										<div className="card elev-sm" style={{ padding: "16px 18px", fontSize: "14px", lineHeight: "1.6" }}>
											<div>
												{asking && !answer ? (
													<span className="text-muted" style={{ animation: "cbPulse 1.5s infinite" }}>Thinking…</span>
												) : (
													renderAnswerText(answer, citations)
												)}
											</div>
											
											{/* Citations List Footer (Visible when done/not asking) */}
											{!asking && answer && citations.length > 0 && (
												<>
													<div className="hr" style={{ margin: "12px 0 10px" }} />
													<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
														{citations.map((c) => (
															<button
																key={c.chunkId}
																type="button"
																onClick={() => setViewingCitation(c)}
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: "8px",
																	textAlign: "left",
																	background: "transparent",
																	border: "1px solid var(--color-divider)",
																	borderRadius: "8px",
																	padding: "7px 10px",
																	color: "var(--color-text)",
																	cursor: "pointer",
																	fontSize: "12px",
																	width: "100%",
																}}
															>
																<span className="tag tag-outline" style={{ padding: "2px 7px" }}>
																	{c.n}
																</span>
																<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
																	{c.sourceTitle}
																</span>
																<span className="text-muted" style={{ fontSize: "11px" }}>
																	{c.locator.page
																	? `p. ${c.locator.page}`
																	: c.locator.sourceUrl
																		? "web"
																		: c.locator.startSec != null
																			? `${Math.floor(c.locator.startSec / 60)}:${String(Math.floor(c.locator.startSec % 60)).padStart(2, "0")}`
																			: "text"}
																</span>
															</button>
														))}
													</div>
												</>
											)}
										</div>
									</div>
								)}
							</>
						)}
					</div>

					{/* Composer Input Area */}
					<form onSubmit={handleAsk} style={{ padding: "14px 20px 20px", borderTop: "1px solid var(--color-divider)", flexShrink: 0 }}>
						<div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
							<textarea
								className="input"
								rows={1}
								placeholder="Ask a question about your sources…"
								style={{ resize: "none", minHeight: "36px" }}
								value={chatQuery}
								onChange={(e) => setChatQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleAsk(e);
									}
								}}
							/>
							<button type="submit" className="btn btn-primary btn-icon" aria-label="Send" disabled={asking || !chatQuery.trim()}>
								<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
									<path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L69.15,128,40.92,218.66A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.9-2.08l167.9-96.05a16,16,0,0,0,.07-27.87ZM56,224.05,56,224l25.51-84H144a8,8,0,0,0,0-16H81.56L56,40.09l.11,0L224,136Z"/>
								</svg>
							</button>
						</div>
					</form>
					</>
					)}
				</div>
			</div>

			{/* Add Source Modal Dialog */}
			<AddSourceModal
				isOpen={isAddSourceOpen}
				onClose={() => setIsAddSourceOpen(false)}
				textTitle={textTitle}
				setTextTitle={setTextTitle}
				text={text}
				setText={setText}
				handleAddText={handleAddText}
				submittingText={submittingText}
				handleAddPdf={handleAddPdf}
				submittingPdf={submittingPdf}
				fileInputRef={fileInputRef}
				urlTitle={urlTitle}
				setUrlTitle={setUrlTitle}
				url={url}
				setUrl={setUrl}
				handleAddUrl={handleAddUrl}
				submittingUrl={submittingUrl}
				youtubeTitle={youtubeTitle}
				setYoutubeTitle={setYoutubeTitle}
				youtubeVideo={youtubeVideo}
				setYoutubeVideo={setYoutubeVideo}
				handleAddYoutube={handleAddYoutube}
				submittingYoutube={submittingYoutube}
				vttFileInputRef={vttFileInputRef}
				handleAddVtt={handleAddVtt}
				submittingVtt={submittingVtt}
				playlistUrl={playlistUrl}
				setPlaylistUrl={setPlaylistUrl}
				handleAddPlaylist={handleAddPlaylist}
				submittingPlaylist={submittingPlaylist}
			/>

			{/* Source Viewer Modal Dialog */}
			{viewingCitation && token && id && (
				<SourceViewer
					token={token}
					notebookId={id}
					citation={viewingCitation}
					source={sources.find((s) => s.id === viewingCitation.sourceId)}
					onClose={() => setViewingCitation(null)}
				/>
			)}
		</div>
	);
}
