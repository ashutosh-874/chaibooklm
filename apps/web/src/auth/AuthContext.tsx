import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { api, type User } from "../lib/api.ts";

interface AuthContextValue {
	token: string | null;
	user: User | null;
	login: (email: string, password: string) => Promise<void>;
	signup: (email: string, password: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "chaibooklm.auth";

function loadStoredAuth(): { token: string; user: User } | null {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const stored = loadStoredAuth();
	const [token, setToken] = useState<string | null>(stored?.token ?? null);
	const [user, setUser] = useState<User | null>(stored?.user ?? null);

	const persist = useCallback((token: string, user: User) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
		setToken(token);
		setUser(user);
	}, []);

	const login = useCallback(
		async (email: string, password: string) => {
			const { token, user } = await api.login(email, password);
			persist(token, user);
		},
		[persist],
	);

	const signup = useCallback(
		async (email: string, password: string) => {
			const { token, user } = await api.signup(email, password);
			persist(token, user);
		},
		[persist],
	);

	const logout = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setToken(null);
		setUser(null);
	}, []);

	const value = useMemo(() => ({ token, user, login, signup, logout }), [token, user, login, signup, logout]);

	return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
	const ctx = use(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
