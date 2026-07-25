import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { api, ApiError, type Notebook } from "../lib/api.ts";

export function NotebooksPage() {
	const { token, user, logout } = useAuth();
	const navigate = useNavigate();
	const [notebooks, setNotebooks] = useState<Notebook[]>([]);
	const [notebookSourcesCounts, setNotebookSourcesCounts] = useState<Record<string, number>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newName, setNewName] = useState("");
	const [creating, setCreating] = useState(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

	useEffect(() => {
		if (!token) return;
		api
			.listNotebooks(token)
			.then(async (nbs) => {
				setNotebooks(nbs);
				setLoading(false);
				
				// Fetch source counts in the background
				const counts: Record<string, number> = {};
				await Promise.all(
					nbs.map(async (nb) => {
						try {
							const sources = await api.listSources(token, nb.id);
							counts[nb.id] = sources.length;
						} catch (e) {
							counts[nb.id] = 0;
						}
					})
				);
				setNotebookSourcesCounts(counts);
			})
			.catch((err) => {
				setError(err instanceof ApiError ? err.message : "Failed to load notebooks");
				setLoading(false);
			});
	}, [token]);

	useEffect(() => {
		const handleGlobalClick = () => {
			setActiveMenuId(null);
		};
		window.addEventListener("click", handleGlobalClick);
		return () => window.removeEventListener("click", handleGlobalClick);
	}, []);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !newName.trim()) return;
		setCreating(true);
		setError(null);
		try {
			const notebook = await api.createNotebook(token, newName.trim());
			setNotebooks((prev) => [notebook, ...prev]);
			setNewName("");
			setIsCreateModalOpen(false);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to create notebook");
		} finally {
			setCreating(false);
		}
	}

	async function handleRename(notebook: Notebook, e: React.MouseEvent) {
		e.stopPropagation();
		if (!token) return;
		const name = window.prompt("Rename notebook", notebook.name);
		if (!name || name === notebook.name) return;
		try {
			const updated = await api.renameNotebook(token, notebook.id, name);
			setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to rename notebook");
		}
	}

	async function handleDelete(notebook: Notebook, e: React.MouseEvent) {
		e.stopPropagation();
		if (!token) return;
		if (!window.confirm(`Delete "${notebook.name}"? This cannot be undone.`)) return;
		try {
			await api.deleteNotebook(token, notebook.id);
			setNotebooks((prev) => prev.filter((n) => n.id !== notebook.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete notebook");
		}
	}

	const userInitials = user?.email
		? user.email.split("@")[0].substring(0, 2).toUpperCase()
		: "JR";

	return (
		<div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
			{/* Navigation Header */}
			<nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)" }}>
				<span className="nav-brand" style={{ display: "flex", alignItems: "center", gap: "9px" }}>
					<span style={{ width: "26px", height: "26px", borderRadius: "7px", border: "1.5px solid var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-accent)", fontSize: "13px", fontWeight: 600 }}>C</span>
					ChaibookLM
				</span>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<span className="text-muted" style={{ fontSize: "13px" }}>{user?.email}</span>
					<button type="button" className="btn btn-ghost" style={{ fontSize: "13px" }} onClick={logout}>
						Log out
					</button>
					<div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--color-accent-800)", color: "var(--color-accent-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>
						{userInitials}
					</div>
				</div>
			</nav>

			{/* Content Area */}
			<div style={{ maxWidth: "1120px", width: "100%", margin: "0 auto", padding: "36px 32px 64px" }}>
				<div style={{ display: "flex", alignItems: "center", justifySpaceBetween: "space-between", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
					<div>
						<h2 style={{ marginBottom: "4px" }}>Your notebooks</h2>
						<p className="text-muted" style={{ fontSize: "13px", margin: 0 }}>
							{loading ? "Loading..." : `${notebooks.length} ${notebooks.length === 1 ? "notebook" : "notebooks"}`}
						</p>
					</div>
					<button type="button" className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
						<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
							<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>
						</svg>
						New notebook
					</button>
				</div>

				{error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}

				{loading ? (
					<div style={{ padding: "48px 12px", textAlign: "center", opacity: 0.8 }}>
						<p className="text-muted">Loading notebooks...</p>
					</div>
				) : notebooks.length === 0 ? (
					<div className="card" style={{ alignItems: "center", textAlign: "center", padding: "72px 24px", gap: "12px", border: "1px dashed var(--color-divider)", background: "transparent" }}>
						<div style={{ width: "56px", height: "56px", borderRadius: "14px", border: "1.5px solid var(--color-divider)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px", color: "var(--color-neutral-400)" }}>
							<svg width="24" height="24" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="10">
								<rect x="44" y="36" width="168" height="184" rx="10"/>
								<line x1="76" y1="80" x2="180" y2="80"/>
								<line x1="76" y1="116" x2="180" y2="116"/>
								<line x1="76" y1="152" x2="140" y2="152"/>
							</svg>
						</div>
						<h4 style={{ margin: 0 }}>No notebooks yet</h4>
						<p className="text-muted" style={{ maxWidth: "340px", fontSize: "13px", margin: 0 }}>
							Create a notebook to gather sources — PDFs, pages, transcripts — and start asking questions grounded in them.
						</p>
						<button type="button" className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)} style={{ marginTop: "8px" }}>
							Create your first notebook
						</button>
					</div>
				) : (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
						{notebooks.map((notebook) => {
							const sourcesCount = notebookSourcesCounts[notebook.id] ?? 0;
							const sourcesLabel = `${sourcesCount} ${sourcesCount === 1 ? "source" : "sources"}`;
							const relativeTime = new Date(notebook.updatedAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit"
							});

							return (
								<div
									key={notebook.id}
									className="card elev-sm"
									style={{ cursor: "pointer", position: "relative" }}
									onClick={() => navigate(`/notebooks/${notebook.id}`)}
								>
									<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
										<div className="card-kicker">{sourcesLabel}</div>
										<div style={{ position: "relative" }}>
											<button
												type="button"
												className="btn btn-ghost btn-icon"
												aria-label="More"
												style={{ width: "26px", height: "26px" }}
												onClick={(e) => {
													e.stopPropagation();
													setActiveMenuId(activeMenuId === notebook.id ? null : notebook.id);
												}}
											>
												<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
													<circle cx="128" cy="64" r="14"/>
													<circle cx="128" cy="128" r="14"/>
													<circle cx="128" cy="192" r="14"/>
												</svg>
											</button>
											
											{activeMenuId === notebook.id && (
												<div
													style={{
														position: "absolute",
														right: 0,
														top: "28px",
														background: "var(--color-surface)",
														borderRadius: "var(--radius-md)",
														boxShadow: "var(--shadow-md)",
														zIndex: 10,
														minWidth: "120px",
														padding: "4px 0",
														border: "1px solid var(--color-divider)",
													}}
													onClick={(e) => e.stopPropagation()}
												>
													<button
														type="button"
														className="btn btn-ghost"
														style={{ width: "100%", justifyContent: "flex-start", padding: "6px 12px", fontSize: "13px", color: "var(--color-text)" }}
														onClick={(e) => {
															setActiveMenuId(null);
															handleRename(notebook, e);
														}}
													>
														Rename
													</button>
													<button
														type="button"
														className="btn btn-ghost"
														style={{ width: "100%", justifyContent: "flex-start", padding: "6px 12px", fontSize: "13px", color: "var(--color-danger-text)" }}
														onClick={(e) => {
															setActiveMenuId(null);
															handleDelete(notebook, e);
														}}
													>
														Delete
													</button>
												</div>
											)}
										</div>
									</div>
									<div className="card-title">{notebook.name}</div>
									<div className="card-meta">
										<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
											<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm40,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h32a8,8,0,0,1,0,16Z"/>
										</svg>
										<span>Updated {relativeTime}</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Create Notebook Dialog */}
			{isCreateModalOpen && (
				<div className="dialog-backdrop" onClick={() => setIsCreateModalOpen(false)}>
					<form className="dialog" style={{ width: "min(400px, 100%)" }} onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
							<div className="dialog-title">New notebook</div>
							<button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={() => setIsCreateModalOpen(false)}>
								<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
									<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
								</svg>
							</button>
						</div>
						<div className="dialog-body">
							<div className="field">
								<label htmlFor="nb-name">Notebook Name</label>
								<input
									id="nb-name"
									className="input"
									type="text"
									placeholder="e.g. Attention Mechanisms Survey"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									required
									autoFocus
								/>
							</div>
						</div>
						<div className="dialog-actions">
							<button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
								Cancel
							</button>
							<button type="submit" className="btn btn-primary" disabled={creating || !newName.trim()}>
								{creating ? "Creating…" : "Create"}
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}
