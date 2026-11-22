import avdeb from "../index.js";

export default function (eleventyConfig) {
	eleventyConfig.addPlugin(avdeb, {
		// Or set AVDEB_REF_CODE / AVDEB_SECRET_KEY in the environment or a .env file.
		refCode: process.env.AVDEB_REF_CODE ?? "YOURCODE",
		accentColor: "#c2410c",
	});
	eleventyConfig.addPassthroughCopy("style.css");
}

export const config = {
	dir: { input: ".", includes: "_includes", output: "_site" },
	markdownTemplateEngine: "njk",
};
