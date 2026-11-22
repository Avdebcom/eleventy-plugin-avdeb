import avdeb from "../index.js";

export default function (eleventyConfig) {
	// The referral code comes from AVDEB_REF_CODE (environment or .env).
	eleventyConfig.addPlugin(avdeb, {
		accentColor: "#c2410c",
	});
	eleventyConfig.addPassthroughCopy("style.css");
}

export const config = {
	dir: { input: ".", includes: "_includes", output: "_site" },
	markdownTemplateEngine: "njk",
};
