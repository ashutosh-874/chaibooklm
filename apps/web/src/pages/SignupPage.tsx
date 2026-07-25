import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { ApiError } from "../lib/api.ts";

export function SignupPage() {
	const { signup } = useAuth();
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
			await signup(email, password);
			navigate("/", { replace: true });
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Signup failed");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="auth-page">
			<form className="auth-form" onSubmit={handleSubmit}>
				<h1>Sign up</h1>
				<label>
					Email
					<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
				</label>
				<label>
					Password
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						minLength={8}
						required
					/>
				</label>
				{error && <p className="error">{error}</p>}
				<button type="submit" disabled={submitting}>
					{submitting ? "Creating account…" : "Sign up"}
				</button>
				<p>
					Already have an account? <Link to="/login">Log in</Link>
				</p>
			</form>
		</div>
	);
}
