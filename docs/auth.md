# Auth

JWT-based email/password auth. Stateless — no session store, no refresh tokens.

## Flow

1. `POST /auth/signup` or `/auth/login` — [apps/server/src/routes/auth.ts](../apps/server/src/routes/auth.ts)
2. Password hashed with bcrypt (`bcrypt.hash(password, 10)`), or verified with `bcrypt.compare`.
3. On success, a JWT is signed and returned:

```ts
// apps/server/src/routes/auth.ts
function issueToken(userId: string) {
	return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}
```

4. Frontend stores `{ token, user }` in `localStorage` under `chaibooklm.auth` — [apps/web/src/auth/AuthContext.tsx](../apps/web/src/auth/AuthContext.tsx)
5. Every subsequent API call sends `Authorization: Bearer <token>` — [apps/web/src/lib/api.ts](../apps/web/src/lib/api.ts) `request()` helper.
6. Every protected server route runs `requireAuth` middleware, which verifies the JWT and sets `req.userId`:

```ts
// apps/server/src/middleware/requireAuth.ts
const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
req.userId = payload.userId;
```

7. Route handlers scope all queries to `req.userId` (see [notebooks.md](notebooks.md) for the ownership check pattern) — this is the only authorization mechanism; there are no roles/permissions.

## Env

`JWT_SECRET`, `JWT_EXPIRES_IN` (default `7d`) — [apps/server/src/config.ts](../apps/server/src/config.ts)

## Frontend route protection

`apps/web/src/components/ProtectedRoute.tsx` redirects to `/login` if `AuthContext`'s `token` is null.
