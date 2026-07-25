import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError } from "../lib/api.ts";

export function LoginPage() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await login(email, password);
			navigate("/", { replace: true });
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Login failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="auth-page">
			<form className="auth-form" onSubmit={handleSubmit}>
				<h1>Log in</h1>
				<label>
					Email
					<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
				</label>
				<label>
					Password
					<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
				</label>
				{error && <p className="error">{error}</p>}
				<button type="submit" disabled={submitting}>
					{submitting ? "Logging in…" : "Log in"}
				</button>
				<p>
					No account? <Link to="/signup">Sign up</Link>
				</p>
			</form>
		</div>
	);
}
