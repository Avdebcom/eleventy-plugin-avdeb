/**
 * Finds `{avdeb-products …}`, `{avdeb-product …}` and `{avdeb-button …}` tags in rendered HTML (the
 * transform and the `avdeb` filter) and replaces them. Pure module.
 *
 *   {avdeb-products https://avdeb.com/creators/cleo/ layout="carousel" limit="8" heading="From my shop"}
 *   {avdeb-product https://avdeb.com/store/cat-sticker/ variant="hero" badge="Editor's pick"}
 *   {avdeb-button href="/creators/cleo/" label="Visit my shop" variant="outline" align="center"}
 *
 * The first bare value is the link (or search phrase). Markdown and editors mangle tags in
 * predictable ways, so entities (&quot; &amp; &nbsp;) and curly quotes are normalised, and a tag
 * that sits alone in a paragraph replaces the whole `<p>` (block HTML inside a <p> is invalid).
 * Write `{{avdeb-products}}` to show a tag literally.
 */
const TAG_RE = /(?<!\{)\{avdeb-(products|product|button)(\s[^{}]*)?\}(?!\})/gi;
const PARA_RE =
	/<p(?:\s[^>]*)?>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*(\{avdeb-(?:products|product|button)(?:\s[^{}]*)?\})(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi;
const LITERAL_RE = /\{(\{avdeb-[^{}]*\})\}/gi;
/** Bare words that are boolean switches rather than part of a search phrase. */
const FLAGS = ["hideprice", "hidecreator", "newtab", "viewall", "showprice", "showcreator", "showbadges"];
export function contains(text) {
	return typeof text === "string" && /\{avdeb-/i.test(text);
}
const ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	ldquo: '"',
	rdquo: '"',
	lsquo: "'",
	rsquo: "'",
	hellip: "…",
};
export function decodeEntities(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
		if (code[0] === "#") {
			const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
		}
		return ENTITIES[code.toLowerCase()] ?? m;
	});
}
/**
 * `https://avdeb.com/x/ layout="grid" limit=6 hide-price` → { link, layout: "grid", limit: "6", "hide-price": "true" }
 * `cat stickers layout=list` → { link: "cat stickers", layout: "list" }
 */
export function parseAttributes(raw) {
	let s = decodeEntities(String(raw ?? "").replace(/<[^>]*>/g, ""));
	s = s
		.replace(/[“”„″]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/ /g, " ");
	const attrs = {};
	const words = [];
	const re = /([A-Za-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))|"([^"]*)"|'([^']*)'|(\S+)/g;
	for (const m of s.matchAll(re)) {
		if (m[1] !== undefined) {
			const name = m[1].toLowerCase();
			if (!(name in attrs)) attrs[name] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
			continue;
		}
		const quoted = m[5] ?? m[6];
		const bare = (quoted ?? m[7] ?? "").trim();
		if (bare === "") continue;
		if (quoted === undefined && FLAGS.includes(bare.replace(/[-_]/g, "").toLowerCase())) {
			const name = bare.toLowerCase();
			if (!(name in attrs)) attrs[name] = "true";
		} else {
			words.push(bare);
		}
	}
	// Bare words form the link / search phrase unless link= was given explicitly.
	if (words.length && !("link" in attrs)) attrs.link = words.join(" ");
	return attrs;
}
/** Replace every tag in `text`. `render` may be async; tags are rendered in parallel. */
export async function replace(text, render) {
	if (!contains(text)) return text;
	// Unwrap tags that are alone in a paragraph, then render every tag.
	const unwrapped = text.replace(PARA_RE, "$1");
	const jobs = [];
	unwrapped.replace(TAG_RE, (_m, tag, raw) => {
		jobs.push(render(tag.toLowerCase(), parseAttributes(raw ?? "")));
		return "";
	});
	const out = await Promise.all(jobs);
	let i = 0;
	return unwrapped.replace(TAG_RE, () => out[i++] ?? "").replace(LITERAL_RE, "$1");
}
/** Remove the tags (feeds, excerpts, plain-text contexts). */
export function strip(text) {
	if (!contains(text)) return text;
	return text.replace(PARA_RE, "").replace(TAG_RE, "").replace(LITERAL_RE, "$1");
}
