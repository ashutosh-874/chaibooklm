import dns from "node:dns/promises";
import net from "node:net";

// SSRF guard for fetching user-submitted URLs: refuses to connect to
// loopback/private/link-local addresses (including the 169.254.169.254
// cloud-metadata address), re-validates on every redirect hop (not just the
// first URL — the most commonly missed gap in naive SSRF guards), and caps
// timeout + response size. Residual risk: DNS-rebinding between this lookup
// and the actual fetch() connection isn't closed (would need a custom
// dispatcher pinning the connection to the validated IP) — accepted for
// this project's scope.

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

function isPrivateOrReservedIp(ip: string): boolean {
	const version = net.isIP(ip);

	if (version === 4) {
		const [a, b] = ip.split(".").map(Number);
		if (a === 127) return true; // loopback
		if (a === 10) return true; // RFC1918
		if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
		if (a === 192 && b === 168) return true; // RFC1918
		if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
		if (a === 0) return true;
		if (a >= 224) return true; // multicast/reserved
		return false;
	}

	if (version === 6) {
		const lower = ip.toLowerCase();
		if (lower === "::1") return true; // loopback
		if (lower.startsWith("fe80:")) return true; // link-local
		if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
		if (lower.startsWith("::ffff:")) {
			// IPv4-mapped IPv6 — unwrap and re-check as IPv4.
			const v4 = lower.split(":").pop();
			if (v4 && net.isIP(v4) === 4) return isPrivateOrReservedIp(v4);
		}
		return false;
	}

	return true; // not a parseable IP — refuse rather than guess
}

async function assertHostIsPublic(hostname: string): Promise<void> {
	if (net.isIP(hostname)) {
		if (isPrivateOrReservedIp(hostname)) {
			throw new Error(`Refusing to fetch a private/reserved address: ${hostname}`);
		}
		return;
	}

	const addresses = await dns.lookup(hostname, { all: true });
	if (addresses.length === 0) throw new Error(`Could not resolve host: ${hostname}`);
	for (const { address } of addresses) {
		if (isPrivateOrReservedIp(address)) {
			throw new Error(`Refusing to fetch "${hostname}" — resolves to a private/reserved address`);
		}
	}
}

export interface SafeFetchResult {
	html: string;
	finalUrl: string;
}

// Fetches HTML from a user-submitted URL, following redirects manually so
// every hop gets the same private-IP check as the original URL.
export async function safeFetchHtml(inputUrl: string): Promise<SafeFetchResult> {
	let current: URL;
	try {
		current = new URL(inputUrl);
	} catch {
		throw new Error("Invalid URL");
	}

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		if (current.protocol !== "http:" && current.protocol !== "https:") {
			throw new Error(`Unsupported protocol: ${current.protocol}`);
		}
		await assertHostIsPublic(current.hostname);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		let res: Response;
		try {
			res = await fetch(current, { redirect: "manual", signal: controller.signal });
		} finally {
			clearTimeout(timeout);
		}

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) throw new Error("Redirect response had no Location header");
			current = new URL(location, current); // re-validated at the top of the next iteration
			continue;
		}

		if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);

		const contentType = res.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
			throw new Error(`URL did not return HTML content (got "${contentType || "unknown content type"}")`);
		}

		const reader = res.body?.getReader();
		if (!reader) throw new Error("Empty response body");

		const parts: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new Error("Response too large");
			}
			parts.push(value);
		}

		return { html: Buffer.concat(parts).toString("utf-8"), finalUrl: current.toString() };
	}

	throw new Error("Too many redirects");
}
