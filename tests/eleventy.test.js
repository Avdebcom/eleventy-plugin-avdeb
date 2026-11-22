import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import Eleventy from "@11ty/eleventy";

import avdeb, { injectAssets } from "../index.js";
import { fakeApi } from "./helpers.js";

function site(files) {
	const dir = mkdtempSync(join(tmpdir(), "avdeb-11ty-"));
	for (const [name, body] of Object.entries(files)) {
		mkdirSync(join(dir, name, ".."), { recursive: true });
		writeFileSync(join(dir, name), body);
	}
	return dir;
}

const LAYOUT = "<!doctype html><html><head><title>t</title></head><body>{{ content | safe }}</body></html>";

test("Eleventy build: shortcodes, filters, Markdown tags and asset links", async () => {
	const dir = site({
		"_includes/base.njk": LAYOUT,
		"njk.njk": '---\nlayout: base.njk\n---\n{% avdebProducts { tag: "stickers", layout: "carousel" } %}{% avdebButton { href: "/creators/cleo/", label: "Shop" } %}',
		"liquid.liquid": "---\nlayout: base.njk\n---\n{% avdebProduct \"https://avdeb.com/store/cat-sticker/\" %}{% assign r = \"cats\" | avdebData %}<i>{{ r.cards.size }}</i>",
		"post.md": '---\nlayout: base.njk\n---\nHello\n\n{avdeb-products https://avdeb.com/category/stickers/ layout="list"}\n',
		"plain.md": "---\nlayout: base.njk\n---\nNo products here.\n",
	});
	const api = fakeApi();
	const elev = new Eleventy(dir, join(dir, "_site"), {
		quietMode: true,
		config(cfg) {
			cfg.addPlugin(avdeb, { refCode: "ABC12345", fetch: api.fetch, cacheDirectory: false });
		},
	});
	const pages = Object.fromEntries((await elev.toJSON()).map((p) => [p.url, p.content]));

	assert.match(pages["/njk/"], /avdeb--carousel/);
	assert.match(pages["/njk/"], /avdeb-btn/);
	assert.match(pages["/njk/"], /<link rel="stylesheet" href="\/assets\/avdeb\/avdeb.css"><script src="\/assets\/avdeb\/avdeb.js" defer><\/script><\/head>/);
	assert.match(pages["/liquid/"], /avdeb--single/);
	assert.match(pages["/liquid/"], /<i>2<\/i>/);
	assert.doesNotMatch(pages["/liquid/"], /avdeb.js/);
	assert.match(pages["/post/"], /avdeb--list/);
	assert.doesNotMatch(pages["/post/"], /\{avdeb-/);
	assert.doesNotMatch(pages["/plain/"], /avdeb.css/);
});

test("injectAssets is idempotent and skips fragments", () => {
	const html = '<html><head></head><body><section class="avdeb avdeb--grid"></section></body></html>';
	const once = injectAssets(html);
	assert.equal(injectAssets(once), once);
	assert.equal(injectAssets('<section class="avdeb x"></section>'), '<section class="avdeb x"></section>');
});
