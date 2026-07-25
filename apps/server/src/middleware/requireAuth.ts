import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
	if (!token) {
		return res.status(401).json({ error: "Missing bearer token" });
	}

	try {
		const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
		req.userId = payload.userId;
		next();
	} catch {
		return res.status(401).json({ error: "Invalid or expired token" });
	}
}
