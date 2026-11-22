import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createAvdeb, toAttrs } from "../src/lib/avdeb.js";
import { fakeApi, scriptedFetch, silent } from "./helpers.js";

const make = (options = {}, deps = {}) =>
	createAvdeb({ cacheDirectory: false, ...options }, { env: {}, log: silent, ...deps });

test("toAttrs: link, tag-style string, object and keyword arguments", () => {
	assert.deepEqual(toAttrs("https://avdeb.com/x/"), { link: "https://avdeb.com/x/" });
	assert.deepEqual(toAttrs('cats layout="list"'), { layout: "list", link: "cats" });
	assert.deepEqual(toAttrs({ tag: "a" }, { limit: 2, __keywords: true }), { tag: "a", limit: 2 });
	assert.deepEqual(toAttrs(undefined), {});
});

test("products: one request per query, referral code in links, disclosure", async () => {
	const api = fakeApi();
	const avdeb = make({ refCode: "ABC12345" }, { fetch: api.fetch });
	const [a, b] = await Promise.all([avdeb.products({ tag: "stickers" }), avdeb.products("https://avdeb.com/category/stickers/")]);
	assert.equal(a, b);
	assert.equal(api.calls.length, 1);
	assert.match(api.calls[0].url, /tag=stickers/);
	assert.match(api.calls[0].url, /ref=ABC12345/);
	assert.match(a, /avdeb__disclosure/);
	await avdeb.products({ tag: "stickers" });
	assert.equal(api.calls.length, 1, "cached");
});

test("secret key: Bearer header, no ref param, higher limit", async () => {
	const key = `avdeb_sk_${"b".repeat(32)}`;
	const api = fakeApi();
	const avdeb = make({ apiKey: key }, { fetch: api.fetch });
	await avdeb.products({ q: "cats", limit: 40 });
	assert.equal(api.calls[0].headers.Authorization, `Bearer ${key}`);
	assert.doesNotMatch(api.calls[0].url, /ref=/);
	assert.match(api.calls[0].url, /limit=40/);
	assert.match(await avdeb.button({ href: "/creators/cleo/" }), /\?ref=KEYREF/);
});

test("product(): a product link becomes one featured card", async () => {
	const api = fakeApi();
	const avdeb = make({ refCode: "R" }, { fetch: api.fetch });
	const html = await avdeb.product("https://avdeb.com/store/cat-sticker/", { variant: "hero" });
	assert.match(api.calls[0].url, /handle=cat-sticker/);
	assert.match(html, /avdeb--single avdeb--hero/);
});

test("replaceTags renders every tag kind", async () => {
	const avdeb = make({ refCode: "R" }, { fetch: fakeApi().fetch });
	const html = await avdeb.replaceTags(
		'<p>{avdeb-products cats layout="list"}</p><p>{avdeb-product https://avdeb.com/store/cat-sticker/}</p><p>{avdeb-button href="/x/" label="Go"}</p>',
	);
	assert.match(html, /avdeb--list/);
	assert.match(html, /avdeb--single/);
	assert.match(html, /avdeb-btn--solid/);
	assert.doesNotMatch(html, /\{avdeb-/);
});

test("data(): cards for your own markup", async () => {
	const avdeb = make({ refCode: "R" }, { fetch: fakeApi().fetch });
	const out = await avdeb.data({ tag: "stickers", limit: 1 });
	assert.equal(out.cards.length, 1);
	assert.equal(out.cards[0].price, "$4.90");
	assert.equal(out.viewAll, "https://avdeb.com/category/stickers/?ref=R");
	assert.equal(out.disclosure, "As an AVDEB affiliate, I earn a commission from qualifying purchases.");
});

test("API down: never throws; the disk cache serves the last good copy to the next build", async () => {
	const dir = mkdtempSync(join(tmpdir(), "avdeb-"));
	const first = createAvdeb({ refCode: "R", root: dir }, { env: {}, log: silent, fetch: fakeApi().fetch });
	assert.match(await first.products({ tag: "stickers" }), /Cat Sticker/);
	assert.equal(first.save(), true);
	assert.ok(JSON.parse(readFileSync(join(dir, ".cache/avdeb/catalog.json"), "utf8")).entries);

	// Next build, cache expired (now + 1 day), API failing.
	const down = scriptedFetch(() => new Error("offline"));
	const later = Date.now() + 86_400_000;
	const second = createAvdeb({ refCode: "R", root: dir }, { env: {}, log: silent, fetch: down.fetch, now: () => later });
	assert.match(await second.products({ tag: "stickers" }), /Cat Sticker/);
	assert.equal(down.calls.length, 1);

	const empty = make({ refCode: "R" }, { fetch: scriptedFetch(() => ({ status: 500, body: { error: "boom" } })).fetch });
	assert.match(await empty.products({ tag: "x" }), /^<!-- AVDEB Products/);
});
