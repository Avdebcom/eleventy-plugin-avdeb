import assert from "node:assert/strict";
import { test } from "node:test";

import { contains, decodeEntities, parseAttributes, replace, strip } from "../src/lib/shortcodes.js";

test("parseAttributes: link, quoted values, flags and search words", () => {
	assert.deepEqual(parseAttributes(' https://avdeb.com/category/stickers/ layout="carousel" limit=8 hide-price'), {
		layout: "carousel",
		limit: "8",
		"hide-price": "true",
		link: "https://avdeb.com/category/stickers/",
	});
	assert.deepEqual(parseAttributes(" cat stickers layout='list'"), { layout: "list", link: "cat stickers" });
	assert.deepEqual(parseAttributes(' link="x" other words'), { link: "x" });
});

test("parseAttributes: Markdown/editor mangling is undone", () => {
	const attrs = parseAttributes(' <a href="https://avdeb.com/x/">https://avdeb.com/x/</a> heading=&quot;Tom &amp; Jerry&quot; badge=“Editor’s pick”');
	assert.equal(attrs.link, "https://avdeb.com/x/");
	assert.equal(attrs.heading, "Tom & Jerry");
	assert.equal(attrs.badge, "Editor's pick");
});

test("decodeEntities handles named and numeric entities", () => {
	assert.equal(decodeEntities("&lt;b&gt; &#34;x&#x22; &nbsp;&unknown;"), '<b> "x"  &unknown;'.replace(" ", " "));
});

test("replace: unwraps a lone tag paragraph, keeps inline text, renders in order", async () => {
	const html = '<p>{avdeb-products cats}</p><p>Before {avdeb-button href="/x/"} after</p><p>{avdeb-product https://avdeb.com/store/a/}</p>';
	const seen = [];
	const out = await replace(html, async (tag, attrs) => {
		seen.push(tag);
		return `[${tag}:${attrs.link ?? attrs.href}]`;
	});
	assert.equal(out, "[products:cats]<p>Before [button:/x/] after</p>[product:https://avdeb.com/store/a/]");
	assert.deepEqual(seen, ["products", "button", "product"]);
});

test("replace: {{avdeb-…}} stays literal", async () => {
	const out = await replace("<p>Type {{avdeb-products cats}} to embed.</p>", () => "X");
	assert.equal(out, "<p>Type {avdeb-products cats} to embed.</p>");
});

test("strip removes tags; contains detects them", () => {
	assert.equal(strip("<p>{avdeb-products cats}</p><p>Hi</p>"), "<p>Hi</p>");
	assert.equal(contains("no tags"), false);
	assert.equal(contains("{AVDEB-products}"), true);
});
