import { readdirSync, readFileSync } from "node:fs";
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

	it("exposes the Zellia palette and the AGPL source link", () => {
		expect(BRAND_COLORS.primary).toBe("#023562");
		expect(BRAND_COLORS.secondary).toBe("#5799BA");
		expect(BRAND_COLORS.accent).toBe("#FC4501");
		expect(BRAND_SOURCE_CODE_URL).toBe("https://github.com/whitelabel-lat/cap");
	});

	it("points every logo path at an existing public file", () => {
		for (const path of Object.values(BRAND_LOGO_PATHS)) {
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
		expect(source).not.toMatch(/alternative to Loom/i);
		expect(source).not.toMatch(/["`>]Cap[:"`<]|\bCap Recording\b/);
	});

	it.each([
		"app/(org)/dashboard/_components/Navbar/DashboardSearch.tsx",
		"app/(org)/dashboard/caps/components/EmptyCapState.tsx",
		"app/(org)/dashboard/caps/components/web-recorder-dialog/HowItWorksPanel.tsx",
		"app/(org)/dashboard/caps/record/RecordVideoPage.tsx",
		"app/(org)/onboarding/components/DownloadPage.tsx",
		"components/UsageButton.tsx",
	])("%s shows no upstream Cap name or Cap cloud-only controls", (file) => {
		const source = read(file);
		expect(source).not.toMatch(/\bCap\b/);
		expect(source).not.toMatch(/Search caps/);
	});

	it("hides the Cap Chrome extension button outside Cap cloud", () => {
		for (const file of [
			"components/ChromeRecorderButton.tsx",
			"app/(org)/dashboard/caps/components/EmptyCapState.tsx",
		]) {
			expect(read(file)).toContain("NEXT_PUBLIC_IS_CAP");
		}
	});

	it("does not hardcode the old blue", () => {
		for (const file of [
			"../../packages/ui/src/components/icons/LogoBadge.tsx",
			"../../packages/ui/src/components/LogoSpinner.tsx",
			"lib/og/template.tsx",
		]) {
			expect(read(file).toLowerCase()).not.toContain("#4785ff");
		}
	});

	it("keeps the logo theme-aware", () => {
		expect(read("../../packages/ui/src/components/icons/Logo.tsx")).toContain(
			"fill-gray-12",
		);
	});
});

describe("emails and subjects", () => {
	const emailsDir = join(repoRoot, "packages", "database", "emails");
	const allowedFiles = new Set([
		"config.ts",
		"signed-baa.tsx",
		"download-link.tsx",
	]);
	const emailFiles = readdirSync(emailsDir).filter(
		(file) => /\.tsx?$/.test(file) && !allowedFiles.has(file),
	);

	it.each(emailFiles)("emails/%s does not mention Cap", (file) => {
		const source = readFileSync(join(emailsDir, file), "utf8");
		const offending = source.split("\n").filter((line) => /\bCap\b/.test(line));
		expect(offending).toEqual([]);
	});

	it("only keeps the gated cloud senders in config.ts", () => {
		const config = readFileSync(join(emailsDir, "config.ts"), "utf8");
		const offending = config
			.split("\n")
			.filter((line) => /\bCap\b|cap\.so/.test(line))
			.filter((line) => !/<[^>]*@(send|auth)\.cap\.so>/.test(line));
		expect(offending).toEqual([]);
		expect(config).not.toContain("CAP_LOGO_URL");
		expect(config).toContain("BRAND_NAME");
	});

	it("keeps the email logo helper", () => {
		expect(readFileSync(join(emailsDir, "brand.ts"), "utf8")).toContain(
			"emailLogoUrl",
		);
	});

	it.each([
		"../../packages/database/auth/auth-options.ts",
		"app/api/mobile/[...route]/route.ts",
		"app/api/webhooks/stripe/route.ts",
		"lib/Notification.ts",
		"actions/organization/send-invites.ts",
		"actions/videos/viewer-invites.ts",
		"app/api/v1/[...route]/route.ts",
		"app/api/desktop/[...route]/video.ts",
	])("%s has no Cap in email subjects", (file) => {
		expect(read(file)).not.toMatch(
			/subject:(?:(?!react:)[\s\S]){0,200}?\bCap\b/,
		);
	});

	it("names the Cap desktop app in the desktop download subject", () => {
		const source = read("actions/send-download-link.ts");
		expect(source).toContain('subject: "Your Cap desktop download links"');
		expect(source).toContain("marketing: true");
	});

	it("does not contain broken find-and-replace phrases", () => {
		const sources = emailFiles.map((file) =>
			readFileSync(join(emailsDir, file), "utf8"),
		);
		for (const source of sources) {
			expect(source).not.toMatch(
				/Your video (Verification|Login|Pro)|your video Pro|View Your video/,
			);
			expect(source).not.toContain("Zellia Clips Pro");
		}
	});
});

describe("whitelabel documentation and AGPL", () => {
	it("documents the brand in WHITELABEL.md", () => {
		expect(readFileSync(join(repoRoot, "WHITELABEL.md"), "utf8")).toContain(
			"Marca (Zellia Clips)",
		);
	});

	it.each([
		"app/(org)/dashboard/_components/Navbar/Items.tsx",
		"app/s/[videoId]/_components/ShareHeader.tsx",
		"app/c/[id]/page.tsx",
		"app/not-found.tsx",
	])("%s links to the source code", (file) => {
		expect(read(file)).toContain("BRAND_SOURCE_CODE_URL");
	});
});
