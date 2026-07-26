import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Roadmap } from "../lib/api.ts";
import type { Citation } from "../lib/queryStream.ts";

interface RoadmapPanelProps {
	token: string;
	notebookId: string;
	onViewCitation: (citation: Citation) => void;
}

const POLL_STATUSES = new Set(["PENDING", "GENERATING"]);

type View = "LIST" | "PICKER" | "DETAIL";

function statusLabel(status: Roadmap["status"]) {
	if (!status) return "";
	return status.charAt(0) + status.slice(1).toLowerCase();
}

export function RoadmapPanel({ token, notebookId, onViewCitation }: RoadmapPanelProps) {
	const [view, setView] = useState<View>("LIST");
	const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
	const [loadingList, setLoadingList] = useState(true);
	const [selected, setSelected] = useState<Roadmap | null>(null);
	const [error, setError] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Topic-picking step, shown before generation — keeps the LLM call scoped
	// to a single topic's retrieved chunks instead of scanning every source.
	const [topics, setTopics] = useState<string[] | null>(null);
	const [loadingTopics, setLoadingTopics] = useState(false);
	const [customTopic, setCustomTopic] = useState("");
	const [generating, setGenerating] = useState(false);
	const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

	const refreshList = useCallback(async () => {
		try {
			const result = await api.listRoadmaps(token, notebookId);
			setRoadmaps(result);
			return result;
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to load roadmaps");
			return [];
		}
	}, [token, notebookId]);

	useEffect(() => {
		refreshList().finally(() => setLoadingList(false));
	}, [refreshList]);

	// Polls the open roadmap while it's still generating, and keeps the list's
	// status badge for it in sync too.
	useEffect(() => {
		if (view !== "DETAIL" || !selected || !POLL_STATUSES.has(selected.status ?? "")) {
			if (pollRef.current) clearInterval(pollRef.current);
			return;
		}
		pollRef.current = setInterval(async () => {
			try {
				const result = await api.getRoadmap(token, notebookId, selected.id);
				setSelected(result);
				setRoadmaps((prev) => prev.map((r) => (r.id === result.id ? result : r)));
			} catch (err) {
				setError(err instanceof ApiError ? err.message : "Failed to refresh roadmap");
			}
		}, 3000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [view, selected, token, notebookId]);

	async function openRoadmap(roadmap: Roadmap) {
		setSelected(roadmap);
		setView("DETAIL");
	}

	async function handleDelete(roadmap: Roadmap, e: React.MouseEvent) {
		e.stopPropagation();
		if (!window.confirm(`Delete the roadmap for "${roadmap.topic}"?`)) return;
		try {
			await api.deleteRoadmap(token, notebookId, roadmap.id);
			setRoadmaps((prev) => prev.filter((r) => r.id !== roadmap.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete roadmap");
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
			const result = await api.getRoadmapTopics(token, notebookId);
			setTopics(result.topics);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to suggest topics");
		} finally {
			setLoadingTopics(false);
		}
	}

	async function handleGenerate(topic: string) {
		if (!topic.trim()) return;
		setGenerating(true);
		setError(null);
		try {
			const roadmap = await api.generateRoadmap(token, notebookId, topic.trim());
			setRoadmaps((prev) => [roadmap, ...prev]);
			setSelected(roadmap);
			setView("DETAIL");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to start roadmap generation");
		} finally {
			setGenerating(false);
		}
	}

	function citationLabel(c: Citation) {
		if (c.locator.startSec != null) {
			return `${Math.floor(c.locator.startSec / 60)}:${String(Math.floor(c.locator.startSec % 60)).padStart(2, "0")}`;
		}
		if (c.locator.page) return `p. ${c.locator.page}`;
		return "text";
	}

	return (
		<div style={{ flex: 1, overflowY: "auto", padding: "22px 26px", display: "flex", flexDirection: "column", gap: "16px" }}>
			{error && <p className="error">{error}</p>}

			{view === "LIST" && (
				<>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<h4 style={{ margin: 0 }}>Learning roadmaps</h4>
						<button type="button" className="btn btn-primary" onClick={openPicker}>
							New roadmap
						</button>
					</div>

					{loadingList ? (
						<span className="text-muted" style={{ fontSize: "13px" }}>
							Loading…
						</span>
					) : roadmaps.length === 0 ? (
						<div style={{ margin: "auto", textAlign: "center", maxWidth: "380px" }}>
							<div style={{ width: "44px", height: "44px", margin: "0 auto 12px", borderRadius: "12px", background: "var(--color-accent-900)", color: "var(--color-accent-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
								<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
									<path d="M222.14,58.87A8,8,0,0,0,214,52H180a75.94,75.94,0,0,0-52,20.61V44a8,8,0,0,0-16,0V72.61A75.94,75.94,0,0,0,60,52H26a8,8,0,0,0-8.14,8.87A94.86,94.86,0,0,0,64,133.51V232a8,8,0,0,0,16,0V133.51A94.86,94.86,0,0,0,222.14,58.87Z" />
								</svg>
							</div>
							<p className="text-muted" style={{ fontSize: "13px" }}>
								Generate a personalized, ordered list of concepts covered across this notebook's sources, each linked to where it's first covered.
							</p>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column" }}>
							{roadmaps.map((roadmap) => (
								<button key={roadmap.id} type="button" onClick={() => openRoadmap(roadmap)} className="list-row">
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{roadmap.topic}
										</div>
										<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
											<span className={`status-badge status-${(roadmap.status ?? "").toLowerCase()}`}>
												{POLL_STATUSES.has(roadmap.status ?? "") && <span className="spinner" />}
												{statusLabel(roadmap.status)}
											</span>
											<span className="text-muted" style={{ fontSize: "11px" }}>
												{new Date(roadmap.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
											</span>
										</div>
									</div>
									<button type="button" className="btn btn-ghost btn-icon" style={{ width: "26px", height: "26px" }} aria-label="Delete" onClick={(e) => handleDelete(roadmap, e)}>
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
						<h4 style={{ margin: 0 }}>New roadmap</h4>
					</div>
					<p className="text-muted" style={{ fontSize: "13px" }}>
						Pick a topic to get a personalized, ordered list of concepts, each linked to where it's first covered.
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
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
							<button type="button" className="btn btn-ghost btn-icon" style={{ width: "24px", height: "24px", flexShrink: 0 }} onClick={() => setView("LIST")} aria-label="Back">
								<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
									<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
								</svg>
							</button>
							<span className="text-muted" style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								Roadmap for: <strong>{selected.topic}</strong>
							</span>
						</div>
					</div>

					{POLL_STATUSES.has(selected.status ?? "") && (
						<div style={{ margin: "auto", textAlign: "center" }}>
							<span className="spinner" />
							<p className="text-muted" style={{ fontSize: "13px", marginTop: "8px" }}>
								{selected.status === "PENDING" ? "Queued…" : `Analyzing your sources for "${selected.topic}"…`}
							</p>
						</div>
					)}

					{selected.status === "FAILED" && (
						<p className="error">{selected.errorMessage ?? "Roadmap generation failed."}</p>
					)}

					{selected.status === "READY" && selected.concepts && (
						<div className="animate-fade-in" style={{ position: "relative", paddingLeft: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
							{/* Vertical Timeline Track Line */}
							<div
								style={{
									position: "absolute",
									left: "13px",
									top: "14px",
									bottom: "14px",
									width: "2px",
									background: "linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-900) 100%)",
									opacity: 0.6,
								}}
							/>

							{selected.concepts.map((concept, i) => {
								const stepKey = `${selected.id}-${concept.orderRank}-${i}`;
								const isCompleted = completedSteps.has(stepKey);
								
								return (
									<div key={`${concept.title}-${i}`} style={{ position: "relative" }}>
										{/* Circular Timeline Step Badge */}
										<button
											type="button"
											onClick={() => {
												setCompletedSteps((prev) => {
													const next = new Set(prev);
													if (next.has(stepKey)) {
														next.delete(stepKey);
													} else {
														next.add(stepKey);
													}
													return next;
												});
											}}
											style={{
												position: "absolute",
												left: "-32px",
												top: "2px",
												width: "28px",
												height: "28px",
												borderRadius: "50%",
												background: isCompleted ? "var(--color-success-bg)" : "var(--color-bg)",
												border: isCompleted ? "2px solid var(--color-success-text)" : "2px solid var(--color-accent)",
												color: isCompleted ? "var(--color-success-text)" : "var(--color-accent)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: "11px",
												fontWeight: 700,
												boxShadow: isCompleted ? "0 0 10px rgba(74, 222, 128, 0.4)" : "0 0 8px rgba(145, 132, 217, 0.3)",
												cursor: "pointer",
												padding: 0,
											}}
											title={isCompleted ? "Mark Incomplete" : "Mark Complete"}
										>
											{isCompleted ? (
												<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
													<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>
												</svg>
											) : (
												concept.orderRank
											)}
										</button>

										{/* Concept Card */}
										<div
											className="card elev-sm"
											style={{
												padding: "16px 18px",
												transition: "all 0.2s ease",
												opacity: isCompleted ? 0.6 : 1,
												borderLeft: isCompleted ? "3px solid var(--color-success-text)" : "1px solid var(--color-divider)",
												background: "rgba(35, 37, 50, 0.75)",
												backdropFilter: "blur(12px)",
												borderRadius: "var(--radius-md)"
											}}
										>
											<div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
												<h4 style={{ margin: 0, fontSize: "14px", textDecoration: isCompleted ? "line-through" : "none" }}>
													{concept.title}
												</h4>
											</div>
											<p style={{ fontSize: "13px", lineHeight: "1.6", marginTop: "8px" }}>{concept.summary}</p>
											
											{concept.citations.length > 0 && (
												<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
													{concept.citations.map((c, j) => (
														<button
															key={`${c.chunkId}-${j}`}
															type="button"
															className="tag tag-neutral"
															style={{ cursor: "pointer", border: "none" }}
															onClick={() => onViewCitation({ ...c, n: j + 1 })}
														>
															{c.sourceTitle} · {citationLabel({ ...c, n: j + 1 })}
														</button>
													))}
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</>
			)}
		</div>
	);
}
