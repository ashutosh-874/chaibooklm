import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { api, ApiError, type Notebook } from "../lib/api.ts";

export function NotebooksPage() {
	const { token, user, logout } = useAuth();
	const [notebooks, setNotebooks] = useState<Notebook[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newName, setNewName] = useState("");
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		if (!token) return;
		api
			.listNotebooks(token)
			.then(setNotebooks)
			.catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notebooks"))
			.finally(() => setLoading(false));
	}, [token]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!token || !newName.trim()) return;
		setCreating(true);
		setError(null);
		try {
			const notebook = await api.createNotebook(token, newName.trim());
			setNotebooks((prev) => [notebook, ...prev]);
			setNewName("");
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to create notebook");
		} finally {
			setCreating(false);
		}
	}

	async function handleRename(notebook: Notebook) {
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

	async function handleDelete(notebook: Notebook) {
		if (!token) return;
		if (!window.confirm(`Delete "${notebook.name}"? This cannot be undone.`)) return;
		try {
			await api.deleteNotebook(token, notebook.id);
			setNotebooks((prev) => prev.filter((n) => n.id !== notebook.id));
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Failed to delete notebook");
		}
	}

	return (
		<div className="notebooks-page">
			<header className="notebooks-header">
				<h1>ChaibookLM</h1>
				<div>
					<span>{user?.email}</span>
					<button type="button" onClick={logout}>
						Log out
					</button>
				</div>
			</header>

			<form className="create-notebook-form" onSubmit={handleCreate}>
				<input
					type="text"
					placeholder="New notebook name"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
				/>
				<button type="submit" disabled={creating || !newName.trim()}>
					{creating ? "Creating…" : "Create notebook"}
				</button>
			</form>

			{error && <p className="error">{error}</p>}

			{loading ? (
				<p>Loading…</p>
			) : notebooks.length === 0 ? (
				<p>No notebooks yet. Create your first one above.</p>
			) : (
				<ul className="notebook-list">
					{notebooks.map((notebook) => (
						<li key={notebook.id}>
							<Link to={`/notebooks/${notebook.id}`}>{notebook.name}</Link>
							<div>
								<button type="button" onClick={() => handleRename(notebook)}>
									Rename
								</button>
								<button type="button" onClick={() => handleDelete(notebook)}>
									Delete
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
