/**
 * eleventy-plugin-avdeb — AVDEB products in Eleventy, with your affiliate referral code on every link.
 *
 *   // eleventy.config.js
 *   import avdeb from "eleventy-plugin-avdeb";
 *   export default function (eleventyConfig) {
 *     eleventyConfig.addPlugin(avdeb, { refCode: "YOURCODE", layout: "carousel" });
 *   }
 *
 * Adds the shortcodes `avdebProducts`, `avdebProduct` and `avdebButton`, the filters `avdeb`,
 * `avdebStrip` and `avdebData`, and a transform that turns `{avdeb-products …}` tags in your
 * Markdown into embeds. The stylesheet and carousel script are copied to the output folder and
 * linked only on pages that show products.
 */

import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAvdeb } from "./src/lib/avdeb.js";
import { PACKAGE_NAME, VERSION } from "./src/lib/constants.js";

const ASSET_DIR = fileURLToPath(new URL("./src/", import.meta.url));
const DEFAULT_ASSETS_URL = "/assets/avdeb/";

function assetsUrl(value) {
	if (typeof value !== "string" || !value.trim()) return DEFAULT_ASSETS_URL;
	let v = value.trim();
	if (!v.startsWith("/") && !/^https?:\/\//.test(v)) v = `/${v}`;
	return v.endsWith("/") ? v : `${v}/`;
}

/** Add the stylesheet (and the carousel script when needed) to a page that shows embeds. */
export function injectAssets(html, base = DEFAULT_ASSETS_URL) {
	if (typeof html !== "string" || !/class="avdeb[ "-]/.test(html)) return html;
	const head = html.search(/<\/head>/i);
	if (head === -1) return html;
	let tags = "";
	if (!html.includes(`${base}avdeb.css`)) tags += `<link rel="stylesheet" href="${base}avdeb.css">`;
	if (html.includes("data-avdeb-carousel") && !html.includes(`${base}avdeb.js`)) {
		tags += `<script src="${base}avdeb.js" defer></script>`;
	}
	return tags ? html.slice(0, head) + tags + html.slice(head) : html;
}

/**
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 * @param {import("./index.js").AvdebOptions} [options]
 */
export default function avdebPlugin(eleventyConfig, options = {}) {
	try {
		eleventyConfig.versionCheck?.(">=3.0");
	} catch (error) {
		console.warn(`[${PACKAGE_NAME}] ${error instanceof Error ? error.message : error}`);
	}

	const avdeb = createAvdeb(options, typeof options.fetch === "function" ? { fetch: options.fetch } : {});
	const base = assetsUrl(options.assetsUrl);
	const includeAssets = options.assets !== false;
	const transform = options.transform !== false;

	// Shortcodes (Nunjucks, Liquid, 11ty.js, WebC): an avdeb.com link, a tag-style string or an object.
	eleventyConfig.addAsyncShortcode("avdebProducts", (arg, extra) => avdeb.products(arg, extra));
	eleventyConfig.addAsyncShortcode("avdebProduct", (arg, extra) => avdeb.product(arg, extra));
	eleventyConfig.addAsyncShortcode("avdebButton", (arg, extra) => avdeb.button(arg, extra));

	// Filters: replace tags in any string, remove them (feeds, excerpts), or get data for your own markup.
	const asyncFilter = (name, fn) =>
		typeof eleventyConfig.addAsyncFilter === "function"
			? eleventyConfig.addAsyncFilter(name, fn)
			: eleventyConfig.addFilter(name, fn);
	asyncFilter("avdeb", (html) => avdeb.replaceTags(html == null ? "" : String(html)));
	eleventyConfig.addFilter("avdebStrip", (html) => avdeb.strip(html == null ? "" : String(html)));
	asyncFilter("avdebData", (arg, extra) => avdeb.data(arg, extra));

	eleventyConfig.addTransform("avdeb", async function (content) {
		const out = this.page?.outputPath || this.outputPath || "";
		if (typeof content !== "string" || !String(out).endsWith(".html")) return content;
		let html = transform ? await avdeb.replaceTags(content) : content;
		if (includeAssets) html = injectAssets(html, base);
		return html;
	});

	// Copy the stylesheet and script next to the site, and keep the product cache for the next build.
	eleventyConfig.on("eleventy.after", ({ dir, directories } = {}) => {
		avdeb.save();
		const output = directories?.output ?? dir?.output;
		if (!includeAssets || !output || /^https?:\/\//.test(base)) return;
		const target = join(output, base);
		try {
			mkdirSync(target, { recursive: true });
			for (const file of ["avdeb.css", "avdeb.js"]) copyFileSync(join(ASSET_DIR, file), join(target, file));
		} catch (error) {
			console.warn(`[${PACKAGE_NAME}] could not copy assets: ${error instanceof Error ? error.message : error}`);
		}
	});

	// The disk cache changes during builds; don't let it trigger rebuilds.
	if (options.cacheDirectory !== false) {
		const dirName = String(options.cacheDirectory ?? ".cache/avdeb").replace(/\/+$/, "");
		eleventyConfig.watchIgnores?.add(`${dirName}/**`);
		eleventyConfig.ignores?.add(`${dirName}/**`);
	}
}

export { avdebPlugin, createAvdeb, VERSION };
export { parseAttributes } from "./src/lib/shortcodes.js";
