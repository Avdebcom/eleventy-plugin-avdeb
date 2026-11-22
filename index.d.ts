/** eleventy-plugin-avdeb: AVDEB products in Eleventy, with your affiliate referral code on every link. */

export type Layout = "grid" | "carousel" | "list" | "spotlight";
export type CardStyle = "elevated" | "outline" | "minimal";
export type Theme = "site" | "inherit" | "light" | "dark" | "auto";
export type ImageRatio = "square" | "portrait" | "landscape";
export type ProductVariant = "card" | "horizontal" | "hero";
export type ButtonVariant = "solid" | "outline" | "link";
export type Alignment = "start" | "center" | "end";

export interface DisplayOptions {
	/** Default layout. Default "grid". */
	layout?: Layout;
	/** Columns (1–6). Default 3. */
	columns?: number;
	cardStyle?: CardStyle;
	/** "site" (default) inherits your colours and fonts. */
	theme?: Theme;
	/** Hex colour for buttons and highlights. */
	accentColor?: string;
	/** Corner radius in px (0–32). Default 16. */
	radius?: number;
	imageRatio?: ImageRatio;
	/** Button text on cards. Default "View product". */
	ctaLabel?: string;
	showPrice?: boolean;
	showCreator?: boolean;
	showBadges?: boolean;
	/** Open product links in a new tab. */
	newTab?: boolean;
}

export interface AvdebOptions extends DisplayOptions {
	/** Secret key (avdeb_sk_…). Default: the AVDEB_SECRET_KEY environment variable or .env entry. */
	apiKey?: string;
	/** Referral code added as ?ref= to every link. Default: AVDEB_REF_CODE. */
	refCode?: string;
	/** Show the affiliate disclosure under embeds that carry a code. Default true. */
	showDisclosure?: boolean;
	disclosureText?: string;
	/** How long fetched products stay fresh, in minutes (5–2880). Default 360. */
	cacheMinutes?: number;
	/** Where the product cache is kept between builds. Default ".cache/avdeb"; false keeps it in memory. */
	cacheDirectory?: string | false;
	/** Max catalog requests per minute. Default 120. */
	requestsPerMinute?: number;
	/** Locale for prices. Default "en-US". */
	locale?: string;
	/** Copy avdeb.css/avdeb.js to the output and link them on pages with embeds. Default true. */
	assets?: boolean;
	/** URL folder for the assets. Default "/assets/avdeb/". */
	assetsUrl?: string;
	/** Replace {avdeb-…} tags in every HTML page. Default true. */
	transform?: boolean;
	/** Custom fetch (proxies, tests). */
	fetch?: typeof globalThis.fetch;
}

/** Options for one embed. Every display option can be overridden too. */
export interface EmbedAttributes extends DisplayOptions {
	/** Any avdeb.com creator, category or product link, or search words. */
	url?: string;
	link?: string;
	creator?: string;
	tag?: string;
	type?: string;
	q?: string;
	/** One product: a product link or handle. */
	product?: string;
	limit?: number;
	heading?: string;
	intro?: string;
	headingLevel?: number;
	viewAll?: boolean;
	hidePrice?: boolean;
	hideCreator?: boolean;
	variant?: ProductVariant;
	badge?: string;
	note?: string;
	locale?: string;
}

export interface ButtonAttributes {
	href?: string;
	label?: string;
	variant?: ButtonVariant;
	align?: Alignment;
}

export interface CardView {
	key: string;
	href: string;
	rel: string;
	target: "_blank" | undefined;
	title: string;
	image: string | null;
	width: number;
	height: number;
	price: string | null;
	compareAt: string | null;
	discount: number | null;
	isNew: boolean;
	creator: string | null;
}

export interface AvdebData {
	products: unknown[];
	cards: CardView[];
	ref: string;
	viewAll: string | null;
	disclosure: string | null;
	error: string | null;
}

type Arg = string | EmbedAttributes;

export interface Avdeb {
	products(arg?: Arg, extra?: EmbedAttributes): Promise<string>;
	product(arg?: Arg, extra?: EmbedAttributes): Promise<string>;
	button(arg?: string | ButtonAttributes, extra?: ButtonAttributes): Promise<string>;
	data(arg?: Arg, extra?: EmbedAttributes): Promise<AvdebData>;
	ref(): Promise<string>;
	replaceTags(html: string): Promise<string>;
	strip(html: string): string;
	save(): boolean;
	refresh(): Promise<void>;
}

/** The runtime on its own, for JavaScript data files and .11ty.js templates. */
export function createAvdeb(options?: AvdebOptions & { root?: string }): Avdeb;
export function injectAssets(html: string, base?: string): string;
export function parseAttributes(raw: string): Record<string, string>;
export const VERSION: string;

declare function avdebPlugin(eleventyConfig: any, options?: AvdebOptions): void;
export { avdebPlugin };
export default avdebPlugin;
