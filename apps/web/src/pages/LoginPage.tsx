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
		<div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap", background: "var(--color-bg)", color: "var(--color-text)" }}>
			{/* Left branding panel */}
			<div style={{ flex: "1 1 46%", minWidth: "280px", background: "radial-gradient(circle at 30% 20%, var(--color-accent-900), var(--color-bg) 60%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px", position: "relative", overflow: "hidden" }}>
				<div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 60%)" }}></div>
				<div style={{ position: "relative" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px" }}>
						<div style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1.5px solid var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-accent)", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "16px" }}>C</div>
						<span style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: "19px" }}>ChaibookLM</span>
					</div>
					<h1 style={{ maxWidth: "480px", fontSize: "40px", lineHeight: 1.12 }}>Every answer, traced back to the page it came from.</h1>
					<p style={{ maxWidth: "440px", fontSize: "15px", opacity: 0.75 }}>Upload papers, transcripts and pages into a notebook, then ask questions and follow every claim to its exact source.</p>
				</div>
			</div>

			{/* Right form panel */}
			<div style={{ flex: "1 1 54%", minWidth: "320px", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
				<form className="card elev-md" style={{ width: "min(380px, 100%)", padding: "32px", gap: "6px" }} onSubmit={handleSubmit}>
					<h3 style={{ marginBottom: "4px" }}>Welcome back</h3>
					<p className="text-muted" style={{ fontSize: "13px", marginBottom: "18px" }}>Sign in to access your research notebooks</p>
					
					<div className="field">
						<label htmlFor="cb-email">Email</label>
						<input
							className="input"
							id="cb-email"
							type="email"
							placeholder="you@lab.edu"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					
					<div className="field">
						<label htmlFor="cb-pass">Password</label>
						<input
							className="input"
							id="cb-pass"
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>

					{error && <p className="error" style={{ marginBottom: "10px" }}>{error}</p>}
					
					<button type="submit" className="btn btn-primary btn-block" style={{ marginTop: "10px" }} disabled={submitting}>
						{submitting ? "Signing in…" : "Sign in"}
					</button>
					
					<p style={{ fontSize: "13px", textAlign: "center", margin: "16px 0 0", opacity: 0.8 }}>
						Don't have an account? <Link to="/signup">Sign up</Link>
					</p>
				</form>
			</div>
		</div>
	);
}
