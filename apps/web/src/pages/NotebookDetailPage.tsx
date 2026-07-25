import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { SourceViewer } from "../components/SourceViewer.tsx";
import { api, ApiError, type Notebook, type Source } from "../lib/api.ts";
import { type Citation, streamQuery } from "../lib/queryStream.ts";

// Sources still being processed -> keep polling; once every source has
// settled (READY or FAILED) the list is quiet and polling can stop.
function isSettling(sources: Source[]) {
	return sources.some((s) => s.status === "UPLOADING" || s.status === "INDEXING");
}

export function NotebookDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { token } = useAuth();
	const [notebook, setNotebook] = useState<Notebook | null>(null);
	const [sources, setSources] = useState<Source[]>([]);
	const [error, setError] = useState<string | null>(null);

	const [text, setText] = useState("");
	const [textTitle, setTextTitle] = useState("");
	const [submittingText, setSubmittingText] = useState(false);
	const [submittingPdf, setSubmittingPdf] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [chatQuery, setChatQuery] = useState("");
	const [answer, setAnswer] = useState("");
	const [citations, setCitations] = useState<Citation[]>([]);
	const [asking, setAsking] = useState(false);
	const [chatError, setChatError] = useState<string | null>(null);
	const [viewingCitation, setViewingCitation] = useState<Citation | null>(null);

	const refreshSources = useCallback(async () => {
		if (!token || !id) return;
		try {
			setSources(await api.listSources(token, id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to load sources");
		}
	}, [token, id]);

	// Initial load of the notebook name + its sources.
	useEffect(() => {
		if (!token || !id) return;
		api.getNotebook(token, id).then(setNotebook).catch(() => setError("Notebook not found"));
		refreshSources();
	}, [token, id, refreshSources]);

	// Poll every 2s only while something is still UPLOADING/INDEXING.
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

	return (
		<div className="notebook-detail-page">
			<Link to="/">&larr; Notebooks</Link>
			<h1>{notebook?.name ?? "…"}</h1>

			<div className="add-source-forms">
				<form className="add-source-form" onSubmit={handleAddText}>
					<h2>Add text</h2>
					<input
						type="text"
						placeholder="Title (optional)"
						value={textTitle}
						onChange={(e) => setTextTitle(e.target.value)}
					/>
					<textarea placeholder="Paste text…" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
					<button type="submit" disabled={submittingText || !text.trim()}>
						{submittingText ? "Adding…" : "Add text source"}
					</button>
				</form>

				<form className="add-source-form" onSubmit={handleAddPdf}>
					<h2>Upload PDF</h2>
					<input type="file" accept="application/pdf" ref={fileInputRef} />
					<button type="submit" disabled={submittingPdf}>
						{submittingPdf ? "Uploading…" : "Upload PDF"}
					</button>
				</form>
			</div>

			{error && <p className="error">{error}</p>}

			<h2>Sources</h2>
			{sources.length === 0 ? (
				<p>No sources yet.</p>
			) : (
				<ul className="source-list">
					{sources.map((source) => (
						<li key={source.id}>
							<div>
								<span className={`status-badge status-${source.status.toLowerCase()}`}>{source.status}</span>
								<span className="source-title">
									[{source.type}] {source.title}
								</span>
								{source.status === "FAILED" && source.errorMessage && (
									<p className="error source-error">{source.errorMessage}</p>
								)}
							</div>
							<div>
								<button type="button" onClick={() => handleReindex(source)}>
									Reindex
								</button>
								<button type="button" onClick={() => handleDelete(source)}>
									Delete
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<h2>Ask a question</h2>
			<form className="chat-form" onSubmit={handleAsk}>
				<input
					type="text"
					placeholder="Ask something about this notebook's sources…"
					value={chatQuery}
					onChange={(e) => setChatQuery(e.target.value)}
				/>
				<button type="submit" disabled={asking || !chatQuery.trim()}>
					{asking ? "Thinking…" : "Ask"}
				</button>
			</form>

			{chatError && <p className="error">{chatError}</p>}

			{answer && (
				<div className="chat-answer">
					<p>{answer}</p>
					{citations.length > 0 && (
						<ul className="citation-list">
							{citations.map((c) => (
								<li key={c.chunkId}>
									<button type="button" className="citation-chip" onClick={() => setViewingCitation(c)}>
										[{c.n}] {c.sourceTitle} ({c.sourceType})
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}

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
