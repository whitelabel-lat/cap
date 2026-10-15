import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	BRAND_COLORS,
	BRAND_DESCRIPTION,
	BRAND_LOGO_PATHS,
	BRAND_NAME,
	BRAND_SHORT_NAME,
	BRAND_SOURCE_CODE_URL,
	brandAssetUrl,
} from "@cap/utils/brand";
import { describe, expect, it } from "vitest";

// whitelabel fork: the product is rebranded as Zellia Clips. These tests keep
// the brand module, the PWA manifest and the user-facing files in sync so an
// upstream merge that reintroduces "Cap" branding fails here.

const webRoot = join(__dirname, "..", "..");
const repoRoot = join(webRoot, "..", "..");
const read = (path: string) => readFileSync(join(webRoot, path), "utf8");

describe("brand module", () => {
	it("names the product Zellia Clips", () => {
		expect(BRAND_NAME).toBe("Zellia Clips");
		expect(BRAND_SHORT_NAME).toBe("Zellia Clips");
		expect(BRAND_DESCRIPTION).toBe(
			"Graba, comparte y comenta videos con tu equipo.",
		);
	});

	it("exposes the Zellia palette", () => {
		expect(BRAND_COLORS.primary).toBe("#023562");
		expect(BRAND_COLORS.secondary).toBe("#5799BA");
		expect(BRAND_COLORS.accent).toBe("#FC4501");
	});

	it("keeps the AGPL source link", () => {
		expect(BRAND_SOURCE_CODE_URL).toBe("https://github.com/whitelabel-lat/cap");
	});

	it("points every logo path at an existing public file", () => {
		for (const path of Object.values(BRAND_LOGO_PATHS)) {
			expect(path.startsWith("/")).toBe(true);
			expect(() => readFileSync(join(webRoot, "public", path))).not.toThrow();
		}
	});

	it("builds absolute asset urls from the web url", () => {
		expect(brandAssetUrl("https://clips.example.com/", "/a.png")).toBe(
			"https://clips.example.com/a.png",
		);
		expect(brandAssetUrl("https://clips.example.com", "a.png")).toBe(
			"https://clips.example.com/a.png",
		);
	});
});

describe("web manifest", () => {
	const manifest = JSON.parse(read("public/site.webmanifest")) as {
		name: string;
		short_name: string;
		theme_color: string;
		background_color: string;
	};

	it("uses the brand name and colors", () => {
		expect(manifest.name).toBe("Zellia Clips");
		expect(manifest.short_name).toBe("Zellia Clips");
		expect(manifest.theme_color).toBe(BRAND_COLORS.primary);
		expect(manifest.background_color).toBe("#FFFFFF");
	});
});

describe("user-facing files", () => {
	const files = [
		"app/layout.tsx",
		"app/api/og/route.tsx",
		"app/s/[videoId]/page.tsx",
		"app/s/[videoId]/_components/ShareHeader.tsx",
		"app/embed/[videoId]/page.tsx",
		"app/embed/[videoId]/_components/EmbedVideo.tsx",
		"app/c/[id]/page.tsx",
		"components/VideoThumbnail.tsx",
		"lib/share-video-metadata.ts",
		"lib/oembed.ts",
		"lib/og/template.tsx",
		"lib/og/video-og.tsx",
		"../../packages/ui/src/components/icons/Logo.tsx",
		"../../packages/ui/src/components/icons/LogoBadge.tsx",
		"../../packages/ui/src/components/LogoSpinner.tsx",
	];

	it.each(files)("%s has no upstream branding literals", (file) => {
		const source = read(file);
		expect(source).not.toMatch(/https:\/\/cap\.so/);
		expect(source).not.toContain("Powered by Cap");
		expect(source).not.toContain('alt="Cap"');
		expect(source).not.toContain('aria-label="Cap Logo"');
		expect(source).not.toMatch(/alternative to Loom/i);
		expect(source).not.toMatch(/["`>]Cap[:"`<]|\bCap Recording\b/);
	});

	it("keeps the cloud-only senders out of the self-hosted path", () => {
		const config = read("../../packages/database/emails/config.ts");
		expect(config).not.toContain("CAP_LOGO_URL");
		expect(read("../../packages/database/emails/brand.ts")).toContain(
			"emailLogoUrl",
		);
		expect(config).toContain("BRAND_NAME");
		const gated = config.split("\n").filter((line) => /cap\.so/.test(line));
		expect(
			gated.every((line) => /<[^>]*@(send|auth)\.cap\.so>/.test(line)),
		).toBe(true);
	});

	it("does not hardcode the old blue in logo components", () => {
		for (const file of [
			"../../packages/ui/src/components/icons/LogoBadge.tsx",
			"../../packages/ui/src/components/LogoSpinner.tsx",
			"lib/og/template.tsx",
		]) {
			expect(read(file).toLowerCase()).not.toContain("#4785ff");
		}
	});

	it("documents the brand in WHITELABEL.md", () => {
		expect(readFileSync(join(repoRoot, "WHITELABEL.md"), "utf8")).toContain(
			"Marca (Zellia Clips)",
		);
	});

	it("keeps the source code link in the dashboard sidebar (AGPL)", () => {
		expect(read("app/(org)/dashboard/_components/Navbar/Items.tsx")).toContain(
			"BRAND_SOURCE_CODE_URL",
		);
	});
});
