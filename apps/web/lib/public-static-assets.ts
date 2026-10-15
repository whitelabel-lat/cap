const PUBLIC_ASSET_PREFIXES = ["/logos/", "/fonts/", "/rive/", "/sounds/"];

const PUBLIC_ASSET_PATTERNS = [
	/^\/favicon(-\d+x\d+)?\.(png|ico)$/,
	/^\/apple-touch-icon(-precomposed)?\.png$/,
	/^\/android-chrome-\d+x\d+\.png$/,
	/^\/mstile-\d+x\d+\.png$/,
];

const PUBLIC_ASSET_FILES = new Set([
	"/safari-pinned-tab.svg",
	"/site.webmanifest",
	"/browserconfig.xml",
	"/og.png",
	"/cap-logo.png",
	"/cap-icon.svg",
	"/google.svg",
	"/theme-script.js",
]);

export const isPublicStaticAsset = (path: string) =>
	PUBLIC_ASSET_FILES.has(path) ||
	PUBLIC_ASSET_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
	PUBLIC_ASSET_PATTERNS.some((pattern) => pattern.test(path));
