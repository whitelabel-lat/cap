export const BRAND_NAME = "Zellia Clips";

export const BRAND_SHORT_NAME = "Zellia Clips";

export const BRAND_COMPANY = "Zellia";

export const BRAND_DESCRIPTION =
	"Graba, comparte y comenta videos con tu equipo.";

export const BRAND_SOURCE_CODE_URL = "https://github.com/whitelabel-lat/cap";

export const BRAND_COLORS = {
	primary: "#023562",
	primaryDark: "#002041",
	secondary: "#5799BA",
	accent: "#FC4501",
	ink: "#252422",
} as const;

export const BRAND_LOGO_PATHS = {
	wordmark: "/logos/zellia/logo.svg",
	wordmarkWhite: "/logos/zellia/logo-dark.svg",
	isotype: "/logos/zellia/isotype.svg",
	isotypeWhite: "/logos/zellia/isotype-white.svg",
	email: "/logos/zellia/logo-email.png",
} as const;

export const brandTitle = (title: string) => `${title} | ${BRAND_NAME}`;

export const brandAssetUrl = (baseUrl: string, path: string) =>
	`${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
