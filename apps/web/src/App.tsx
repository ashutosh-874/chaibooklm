import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { NotebooksPage } from "./pages/NotebooksPage.tsx";
import { SignupPage } from "./pages/SignupPage.tsx";

export function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route path="/signup" element={<SignupPage />} />
				<Route element={<ProtectedRoute />}>
					<Route path="/" element={<NotebooksPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AuthProvider>
	);
}
