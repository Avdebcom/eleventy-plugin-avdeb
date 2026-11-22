/**
 * The AVDEB runtime behind the Eleventy plugin: settings, the cached catalog client and every
 * render entry point. Usable on its own in JavaScript data files and `.11ty.js` templates.
 *
 * Nothing here throws into a build: a failed lookup renders an HTML comment (or no products) and
 * logs a warning, so one unreachable API never breaks a deploy.
 */

import { join, resolve } from "node:path";

import { maxLimit, sanitizeQuery } from "./catalog.js";
import { createCatalogClient } from "./client.js";
import { PACKAGE_NAME } from "./constants.js";
import { readEnv } from "./env.js";
import { parseButton, parseEmbed, queryFor } from "./options.js";
import { renderButton, renderEmbed, escapeHtml } from "./render.js";
import { disclosureFor, resolveSettings } from "./settings.js";
import { contains, parseAttributes, replace, strip } from "./shortcodes.js";
import { FileStore, MemoryStore } from "./store.js";
import { buildCards, viewAllHref } from "./view.js";

export const DEFAULT_CACHE_DIRECTORY = ".cache/avdeb";

/**
 * Shortcode / function arguments → one attribute object.
 *   "https://avdeb.com/category/stickers/"                → { link }
 *   'https://avdeb.com/category/stickers/ layout="list"'  → { link, layout }
 *   { url: "…", layout: "list" }                          → as is
 * A second object argument is merged on top (Nunjucks keyword arguments land here too).
 */
export function toAttrs(arg, extra) {
	let attrs = {};
	if (typeof arg === "string" || typeof arg === "number") {
		const s = String(arg).trim();
		attrs = /\s|=/.test(s) ? parseAttributes(s) : s ? { link: s } : {};
	} else if (arg && typeof arg === "object" && !Array.isArray(arg)) {
		attrs = { ...arg };
	}
	if (extra && typeof extra === "object" && !Array.isArray(extra)) Object.assign(attrs, extra);
	delete attrs.__keywords;
	return attrs;
}

function headingLevelOf(attrs, fallback = 2) {
	const raw = attrs.headingLevel ?? attrs["heading-level"] ?? attrs.heading_level;
	const n = Number.parseInt(String(raw ?? ""), 10);
	return Number.isFinite(n) ? n : fallback;
}

function localeOf(attrs, fallback) {
	const l = typeof attrs.locale === "string" ? attrs.locale.trim() : "";
	return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(l) ? l : fallback;
}

/**
 * @param {object} [options] the plugin options (see README)
 * @param {object} [deps] test seams: { fetch, env, now, log }
 */
export function createAvdeb(options = {}, deps = {}) {
	const root = resolve(options.root ?? process.cwd());
	const settings = resolveSettings(options, deps.env ?? readEnv(root));
	const log = deps.log ?? {
		info: (m) => console.log(`[${PACKAGE_NAME}] ${m}`),
		warn: (m) => console.warn(`[${PACKAGE_NAME}] ${m}`),
	};

	const cacheDirectory = options.cacheDirectory === false ? null : (options.cacheDirectory ?? DEFAULT_CACHE_DIRECTORY);
	const store = cacheDirectory ? new FileStore(join(resolve(root, cacheDirectory), "catalog.json")) : new MemoryStore();

	const client = createCatalogClient({
		kv: store,
		fetch: deps.fetch ?? ((url, init) => fetch(url, init)),
		apiKey: settings.apiKey,
		refCode: settings.refCode,
		cacheMinutes: settings.cacheMinutes,
		budgetPerMinute: settings.requestsPerMinute,
		now: deps.now,
		log: { warn: (message, data) => log.warn(`${message}${data?.error ? `: ${data.error}` : ""}`) },
	});

	// Identical embeds on many pages share one request.
	const inflight = new Map();
	let announced = false;

	function announce() {
		if (announced) return;
		announced = true;
		for (const w of settings.warnings) log.warn(w);
		if (settings.apiKey) log.info("Using your AVDEB secret key (referral code added automatically).");
		else if (settings.refCode) log.info(`Using referral code "${settings.refCode}".`);
		else log.warn("No AVDEB secret key or referral code set: product links won't earn commission.");
	}

	/** Products for a sanitised query. Never throws: on failure the list is empty. */
	function lookup(query) {
		announce();
		const key = JSON.stringify(query);
		let hit = inflight.get(key);
		if (!hit) {
			hit = client
				.products(query)
				.then((out) => ({ products: out.products, ref: out.ref || "", error: out.error ?? null }))
				.catch((error) => ({ products: [], ref: "", error: error instanceof Error ? error.message : String(error) }))
				.finally(() => setTimeout(() => inflight.delete(key), 0));
			inflight.set(key, hit);
		}
		return hit;
	}

	function prepare(attrs) {
		const o = parseEmbed(attrs, settings.display);
		const query = sanitizeQuery(queryFor(o), maxLimit(Boolean(settings.apiKey)));
		return { o, query };
	}

	/** One embed (products or one product) as HTML. */
	async function products(arg, extra) {
		const attrs = toAttrs(arg, extra);
		try {
			const { o, query } = prepare(attrs);
			const out = await lookup(query);
			return renderEmbed(
				{ products: out.products, ref: out.ref, query, disclosure: disclosureFor(settings, out.ref) },
				o,
				{ locale: localeOf(attrs, settings.locale), headingLevel: headingLevelOf(attrs) },
			);
		} catch (error) {
			log.warn(`embed failed: ${error instanceof Error ? error.message : String(error)}`);
			return `<!-- AVDEB Products: ${escapeHtml(error instanceof Error ? error.message : String(error))} -->`;
		}
	}

	/** One featured product (horizontal card, hero or compact card). */
	function product(arg, extra) {
		const attrs = toAttrs(arg, extra);
		if (attrs.link !== undefined && attrs.product === undefined && attrs.handle === undefined) {
			attrs.product = attrs.link;
			delete attrs.link;
		}
		attrs.mode = "product";
		return products(attrs);
	}

	/** The referral code links carry: the key owner's with a secret key, else `refCode`. */
	async function ref() {
		try {
			return (await client.ref()) || settings.refCode;
		} catch {
			return settings.refCode;
		}
	}

	/** A referral button to any avdeb.com page. */
	async function button(arg, extra) {
		const attrs = toAttrs(arg, extra);
		if (attrs.href === undefined && attrs.link !== undefined) attrs.href = attrs.link;
		announce();
		return renderButton(parseButton(attrs), await ref(), settings.display);
	}

	/** Replace `{avdeb-products …}`, `{avdeb-product …}` and `{avdeb-button …}` tags in HTML. */
	function replaceTags(html) {
		if (typeof html !== "string" || !contains(html)) return Promise.resolve(html);
		return replace(html, (tag, attrs) => {
			if (tag === "button") return button(attrs);
			if (tag === "product") return products({ ...attrs, mode: "product" });
			return products(attrs);
		});
	}

	/** Products and render-ready cards for your own markup. */
	async function data(arg, extra) {
		const attrs = toAttrs(arg, extra);
		const { o, query } = prepare(attrs);
		const out = await lookup(query);
		const cards = buildCards(out.products, o, { locale: localeOf(attrs, settings.locale) });
		return {
			products: out.products,
			cards,
			ref: out.ref,
			viewAll: o.viewAll ? viewAllHref(query, out.products, out.ref) : null,
			disclosure: disclosureFor(settings, out.ref),
			error: out.error,
		};
	}

	return {
		settings,
		products,
		product,
		button,
		data,
		ref,
		replaceTags,
		strip,
		contains,
		/** Write the disk cache (the plugin calls this after every build). */
		save: () => store.save(),
		/** Drop every cached product query ("refresh products now"). */
		refresh: () => client.flush(),
		stats: () => client.stats(),
	};
}
