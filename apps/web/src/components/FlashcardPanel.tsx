import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type FlashcardSet } from "../lib/api.ts";
import type { Citation } from "../lib/queryStream.ts";

interface FlashcardPanelProps {
	token: string;
	notebookId: string;
	onViewCitation: (citation: Citation) => void;
}

const POLL_STATUSES = new Set(["PENDING", "GENERATING"]);

type View = "LIST" | "PICKER" | "DETAIL";

function statusLabel(status: FlashcardSet["status"]) {
	if (!status) return "";
	return status
		.split("_")
		.map((w) => w.charAt(0) + w.slice(1).toLowerCase())
		.join(" ");
}

function citationLabel(startSec?: number, page?: number) {
	if (startSec != null) return `${Math.floor(startSec / 60)}:${String(Math.floor(startSec % 60)).padStart(2, "0")}`;
	if (page) return `p. ${page}`;
	return "text";
}

export function FlashcardPanel({ token, notebookId, onViewCitation }: FlashcardPanelProps) {
	const [view, setView] = useState<View>("LIST");
	const [sets, setSets] = useState<FlashcardSet[]>([]);
	const [loadingList, setLoadingList] = useState(true);
	const [selected, setSelected] = useState<FlashcardSet | null>(null);
	const [error, setError] = useState<string | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Topic-picking step, shown before generation — same idea as Roadmap/Podcast.
	const [topics, setTopics] = useState<string[] | null>(null);
	const [loadingTopics, setLoadingTopics] = useState(false);
	const [customTopic, setCustomTopic] = useState("");
	const [generating, setGenerating] = useState(false);

	// Per-card flip state (front/back) — keyed by index, reset whenever a
	// different set is opened.
	const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

	// Quiz-taking state — which option the user picked per question, and
	// whether they've submitted (revealing correct/incorrect + explanations).
	const [answers, setAnswers] = useState<Record<number, number>>({});
	const [submittedQuiz, setSubmittedQuiz] = useState(false);
	const [generatingQuiz, setGeneratingQuiz] = useState(false);

	const refreshList = useCallback(async () => {
		try {
			const result = await api.listFlashcardSets(token, notebookId);
			setSets(result);
			return result;
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to load flashcard sets");
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
				const result = await api.getFlashcardSet(token, notebookId, selected.id);
				setSelected(result);
				setSets((prev) => prev.map((s) => (s.id === result.id ? result : s)));
			} catch (err) {
				setError(err instanceof ApiError ? err.message : "Failed to refresh flashcard set");
			}
		}, 3000);
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [view, selected, token, notebookId]);

	function openSet(set: FlashcardSet) {
		setSelected(set);
		setFlippedCards(new Set());
		setAnswers({});
		setSubmittedQuiz(false);
		setView("DETAIL");
	}

	async function handleDelete(set: FlashcardSet, e: React.MouseEvent) {
		e.stopPropagation();
		if (!window.confirm(`Delete the flashcard set for "${set.topic}"?`)) return;
		try {
			await api.deleteFlashcardSet(token, notebookId, set.id);
			setSets((prev) => prev.filter((s) => s.id !== set.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete flashcard set");
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
			const result = await api.getFlashcardTopics(token, notebookId);
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
			const set = await api.generateFlashcards(token, notebookId, topic.trim());
			setSets((prev) => [set, ...prev]);
			openSet(set);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to start flashcard generation");
		} finally {
			setGenerating(false);
		}
	}

	function toggleFlip(index: number) {
		setFlippedCards((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	}

	async function handleGenerateQuiz() {
		if (!selected) return;
		setGeneratingQuiz(true);
		setError(null);
		try {
			const updated = await api.generateQuiz(token, notebookId, selected.id);
			setSelected(updated);
			setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
			setAnswers({});
			setSubmittedQuiz(false);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to generate quiz");
		} finally {
			setGeneratingQuiz(false);
		}
	}

	function selectAnswer(questionIndex: number, optionIndex: number) {
		if (submittedQuiz) return;
		setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
	}

	const quizScore =
		selected?.quiz && submittedQuiz ? selected.quiz.filter((q, i) => answers[i] === q.correctIndex).length : null;

	return (
		<div style={{ flex: 1, overflowY: "auto", padding: "22px 26px", display: "flex", flexDirection: "column", gap: "16px" }}>
			{error && <p className="error">{error}</p>}

			{view === "LIST" && (
				<>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<h4 style={{ margin: 0 }}>Flashcards</h4>
						<button type="button" className="btn btn-primary" onClick={openPicker}>
							New flashcards
						</button>
					</div>

					{loadingList ? (
						<span className="text-muted" style={{ fontSize: "13px" }}>
							Loading…
						</span>
					) : sets.length === 0 ? (
						<div style={{ margin: "auto", textAlign: "center", maxWidth: "380px" }}>
							<div style={{ width: "44px", height: "44px", margin: "0 auto 12px", borderRadius: "12px", background: "var(--color-accent-900)", color: "var(--color-accent-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
								<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
									<path d="M216,40H72A16,16,0,0,0,56,56V72H40A16,16,0,0,0,24,88V200a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V184h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,200H40V88H184Zm32-32H200V88a16,16,0,0,0-16-16H72V56H216Z" />
								</svg>
							</div>
							<p className="text-muted" style={{ fontSize: "13px" }}>
								Generate a small set of flashcards for a topic, then test yourself with a quiz built from them.
							</p>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column" }}>
							{sets.map((set) => (
								<button
									key={set.id}
									type="button"
									onClick={() => openSet(set)}
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
											{set.topic}
										</div>
										<div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
											<span className={`status-badge status-${(set.status ?? "").toLowerCase()}`}>
												{POLL_STATUSES.has(set.status ?? "") && <span className="spinner" />}
												{statusLabel(set.status)}
											</span>
											<span className="text-muted" style={{ fontSize: "11px" }}>
												{new Date(set.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
											</span>
										</div>
									</div>
									<button type="button" className="btn btn-ghost btn-icon" style={{ width: "26px", height: "26px" }} aria-label="Delete" onClick={(e) => handleDelete(set, e)}>
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
						<h4 style={{ margin: 0 }}>New flashcards</h4>
					</div>
					<p className="text-muted" style={{ fontSize: "13px" }}>
						Pick a topic — a small set of Q&amp;A flashcards will be generated, which you can then quiz yourself on.
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
								Flashcards for: <strong>{selected.topic}</strong>
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

					{selected.status === "FAILED" && <p className="error">{selected.errorMessage ?? "Flashcard generation failed."}</p>}

					{selected.flashcards && selected.flashcards.length > 0 && (
						<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
							<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "12px" }}>
								{selected.flashcards.map((card, i) => {
									const flipped = flippedCards.has(i);
									return (
										<button
											key={`${card.front}-${i}`}
											type="button"
											onClick={() => toggleFlip(i)}
											className="card elev-sm"
											style={{
												padding: "16px 18px",
												textAlign: "left",
												cursor: "pointer",
												border: flipped ? "1px solid var(--color-accent-700)" : "1px solid transparent",
												width: "100%",
												minHeight: "132px",
												justifyContent: "space-between",
												transition: "border-color 120ms ease",
												color: "var(--color-text)",
												font: "inherit",
											}}
										>
											<div>
												<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
													<span className={flipped ? "tag tag-accent-2" : "tag tag-accent"}>{flipped ? "Answer" : "Question"}</span>
													<span className="text-muted" style={{ fontSize: "10.5px", flexShrink: 0 }}>
														{i + 1}/{selected.flashcards?.length}
													</span>
												</div>
												<p style={{ fontSize: "13.5px", lineHeight: "1.55", marginTop: "10px", marginBottom: 0 }}>{flipped ? card.back : card.front}</p>
											</div>
											<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "10px" }}>
												{flipped && card.citation ? (
													<span
														className="tag tag-neutral"
														style={{ cursor: "pointer", border: "none" }}
														onClick={(e) => {
															e.stopPropagation();
															if (!card.citation) return;
															onViewCitation({ ...card.citation, n: 1 });
														}}
													>
														{card.citation.sourceTitle} · {citationLabel(card.citation.locator.startSec, card.citation.locator.page)}
													</span>
												) : (
													<span />
												)}
												<span className="text-muted" style={{ fontSize: "10.5px", display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
													<svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor">
														<path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.75,170.82,224,128,224c-37.32,0-63.7-21.24-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44a95.87,95.87,0,0,0,72,32.09c35.83,0,58.5-21.4,59.31-22.09a8,8,0,0,1,10.92-1.63ZM216,32a8,8,0,0,0-8,8V64.15C191.7,45.24,165.32,24,128,24,85.18,24,59.42,49.25,58.33,50.34a8,8,0,0,0,11.34,11.32C70.48,60.93,93.15,40,128,40a95.87,95.87,0,0,1,72,32.09H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Z" />
													</svg>
													flip
												</span>
											</div>
										</button>
									);
								})}
							</div>

							{(selected.status === "CARDS_READY" || selected.status === "QUIZ_READY") && !selected.quiz && (
								<button type="button" className="btn btn-primary" onClick={handleGenerateQuiz} disabled={generatingQuiz} style={{ alignSelf: "flex-start" }}>
									{generatingQuiz ? "Generating quiz…" : "Generate quiz"}
								</button>
							)}
						</div>
					)}

					{selected.quiz && selected.quiz.length > 0 && (
						<div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "6px" }}>
							<div className="hr" />
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<h4 style={{ margin: 0 }}>Quiz</h4>
								{submittedQuiz && quizScore != null && (
									<span
										className="tag"
										style={{
											background: quizScore / selected.quiz.length >= 0.6 ? "var(--color-success-bg)" : "var(--color-danger-bg)",
											color: quizScore / selected.quiz.length >= 0.6 ? "var(--color-success-text)" : "var(--color-danger-text)",
											fontWeight: 600,
										}}
									>
										Score: {quizScore} / {selected.quiz.length}
									</span>
								)}
							</div>

							{selected.quiz.map((q, qi) => (
								<div key={`${q.question}-${qi}`} className="card elev-sm" style={{ padding: "16px 18px" }}>
									<p style={{ fontSize: "13px", fontWeight: 500, marginBottom: "12px" }}>
										{qi + 1}. {q.question}
									</p>
									<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
										{q.options.map((option, oi) => {
											const isPicked = answers[qi] === oi;
											const isCorrect = oi === q.correctIndex;
											const showResult = submittedQuiz;

											let borderColor = "var(--color-divider)";
											let background = "transparent";
											if (showResult && isCorrect) {
												borderColor = "transparent";
												background = "var(--color-success-bg)";
											} else if (showResult && isPicked && !isCorrect) {
												borderColor = "transparent";
												background = "var(--color-danger-bg)";
											} else if (isPicked) {
												borderColor = "var(--color-accent)";
												background = "color-mix(in srgb, var(--color-accent) 12%, transparent)";
											}

											return (
												<button
													key={option}
													type="button"
													onClick={() => selectAnswer(qi, oi)}
													disabled={submittedQuiz}
													style={{
														display: "flex",
														alignItems: "center",
														gap: "10px",
														textAlign: "left",
														padding: "8px 12px",
														borderRadius: "8px",
														border: `1px solid ${borderColor}`,
														background,
														color: showResult && isCorrect ? "var(--color-success-text)" : showResult && isPicked && !isCorrect ? "var(--color-danger-text)" : "var(--color-text)",
														fontSize: "13px",
														cursor: submittedQuiz ? "default" : "pointer",
													}}
												>
													<span
														style={{
															flexShrink: 0,
															width: "20px",
															height: "20px",
															borderRadius: "50%",
															border: "1px solid currentColor",
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
															fontSize: "10.5px",
															fontWeight: 700,
															opacity: showResult ? 1 : 0.7,
														}}
													>
														{String.fromCharCode(65 + oi)}
													</span>
													<span style={{ flex: 1 }}>{option}</span>
													{showResult && isCorrect && (
														<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" style={{ flexShrink: 0 }}>
															<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
														</svg>
													)}
													{showResult && isPicked && !isCorrect && (
														<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" style={{ flexShrink: 0 }}>
															<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
														</svg>
													)}
												</button>
											);
										})}
									</div>
									{submittedQuiz && (
										<p className="text-muted" style={{ fontSize: "12px", marginTop: "10px", lineHeight: "1.5" }}>
											{q.explanation}
										</p>
									)}
								</div>
							))}

							{!submittedQuiz && (
								<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
									<button
										type="button"
										className="btn btn-primary"
										onClick={() => setSubmittedQuiz(true)}
										disabled={Object.keys(answers).length < selected.quiz.length}
									>
										Submit quiz
									</button>
									<span className="text-muted" style={{ fontSize: "12px" }}>
										{Object.keys(answers).length} / {selected.quiz.length} answered
									</span>
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
