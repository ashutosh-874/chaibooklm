import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@chaibooklm/shared";
import { z } from "zod";
import { config } from "../config.ts";

export const authRouter = Router();

const credentialsSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
});

function issueToken(userId: string) {
	return jwt.sign({ userId }, config.jwt.secret, {
		expiresIn: config.jwt.expiresIn,
	} as jwt.SignOptions);
}

authRouter.post("/signup", async (req, res) => {
	const parsed = credentialsSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: "Invalid email or password (min 8 chars)" });
	}
	const { email, password } = parsed.data;

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return res.status(409).json({ error: "Email already registered" });
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: { email, passwordHash },
	});

	const token = issueToken(user.id);
	return res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

authRouter.post("/login", async (req, res) => {
	const parsed = credentialsSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: "Invalid email or password" });
	}
	const { email, password } = parsed.data;

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
		return res.status(401).json({ error: "Invalid email or password" });
	}

	const token = issueToken(user.id);
	return res.json({ token, user: { id: user.id, email: user.email } });
});
