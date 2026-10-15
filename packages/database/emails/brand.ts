import { buildEnv } from "@cap/env";
import { BRAND_LOGO_PATHS, brandAssetUrl } from "@cap/utils/brand";

export const emailLogoUrl = () =>
	brandAssetUrl(buildEnv.NEXT_PUBLIC_WEB_URL, BRAND_LOGO_PATHS.email);
