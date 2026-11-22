/**
 * Key-value stores for the catalog client.
 *
 * MemoryStore lives as long as the process: `eleventy --serve` rebuilds reuse it.
 * FileStore adds a JSON file (default `.cache/avdeb/catalog.json`) so the next build — locally or on
 * a CI host that keeps `.cache` — reuses fresh products and still has the last good copy (kept for a
 * week) when AVDEB can't be reached.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class MemoryStore {
	constructor(entries) {
		this.data = new Map(entries);
		this.dirty = false;
	}

	async get(key) {
		return this.data.has(key) ? this.data.get(key) : null;
	}

	async set(key, value) {
		this.data.set(key, value);
		this.dirty = true;
	}

	async delete(key) {
		const had = this.data.delete(key);
		if (had) this.dirty = true;
		return had;
	}

	async list(prefix = "") {
		const out = [];
		for (const [key, value] of this.data) if (key.startsWith(prefix)) out.push({ key, value });
		return out;
	}

	/** Nothing to persist. */
	save() {
		return false;
	}
}

const FORMAT = 1;

export class FileStore extends MemoryStore {
	constructor(file) {
		let entries = [];
		try {
			const json = JSON.parse(readFileSync(file, "utf8"));
			if (json && json.format === FORMAT && json.entries && typeof json.entries === "object") {
				entries = Object.entries(json.entries);
			}
		} catch {
			// first run, or an unreadable file: start empty
		}
		super(entries);
		this.file = file;
	}

	/** Write the file if anything changed. Never throws (a read-only disk just means no disk cache). */
	save() {
		if (!this.dirty) return false;
		try {
			mkdirSync(dirname(this.file), { recursive: true });
			const tmp = `${this.file}.${process.pid}.tmp`;
			writeFileSync(tmp, JSON.stringify({ format: FORMAT, entries: Object.fromEntries(this.data) }));
			renameSync(tmp, this.file);
			this.dirty = false;
			return true;
		} catch {
			return false;
		}
	}
}
