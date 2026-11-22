/** Reads AVDEB_* variables from process.env and the project's .env files (Node only). */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal .env reader (KEY=value, optional quotes, # comments) — only AVDEB_* variables. */
export function parseEnvFile(source) {
	const out = {};
	for (const line of String(source).split(/\r?\n/)) {
		const m = /^\s*(?:export\s+)?(AVDEB_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
		if (!m) continue;
		let value = m[2];
		const quoted = /^(["'])(.*)\1$/.exec(value);
		value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
		out[m[1]] = value;
	}
	return out;
}

/** `.env` then `.env.local` from `root`; real environment variables win. */
export function readEnv(root = process.cwd()) {
	const merged = {};
	for (const file of [".env", ".env.local"]) {
		try {
			Object.assign(merged, parseEnvFile(readFileSync(join(root, file), "utf8")));
		} catch {
			// missing file
		}
	}
	for (const k of ["AVDEB_SECRET_KEY", "AVDEB_REF_CODE"]) {
		if (process.env[k]) merged[k] = process.env[k];
	}
	return merged;
}
