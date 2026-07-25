const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8090";

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
	const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
	if (options.body) headers["Content-Type"] = "application/json";
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
	createNotebook: (token: string, name: string) =>
		request<Notebook>("/notebooks", { method: "POST", body: JSON.stringify({ name }) }, token),
	renameNotebook: (token: string, id: string, name: string) =>
		request<Notebook>(`/notebooks/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }, token),
	deleteNotebook: (token: string, id: string) =>
		request<void>(`/notebooks/${id}`, { method: "DELETE" }, token),
};
