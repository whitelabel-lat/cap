import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@cap/database", () => ({ db: () => ({}) }));
vi.mock("@cap/database/schema", () => ({ organizations: {} }));
vi.mock("@cap/env", () => ({
	buildEnv: { NEXT_PUBLIC_IS_CAP: undefined },
	serverEnv: () => ({ WEB_URL: "https://clips.example.com" }),
}));

import { proxy } from "../../proxy";

const run = (path: string) =>
	proxy(new NextRequest(new URL(path, "https://clips.example.com")));

describe("self-hosted proxy and public static assets", () => {
	it.each([
		"/logos/zellia/logo-email.png",
		"/favicon-32x32.png",
		"/favicon-16x16.png",
		"/apple-touch-icon.png",
		"/android-chrome-192x192.png",
		"/mstile-150x150.png",
		"/safari-pinned-tab.svg",
		"/site.webmanifest",
		"/browserconfig.xml",
		"/og.png",
		"/cap-logo.png",
		"/cap-icon.svg",
		"/theme-script.js",
		"/google.svg",
		"/rive/main.riv",
		"/sounds/start-recording.ogg",
		"/fonts/Inter-Variable-latin.woff2",
	])("serves %s without redirecting to /login", async (path) => {
		const response = await run(path);
		expect(response.headers.get("location")).toBeNull();
		expect(response.status).toBe(200);
	});

	it.each([
		"/x.png",
		"/pricing",
		"/logos-evil",
		"/favicon-evil/x",
		"/LOGOS/x",
		"/fonts/../pricing",
	])("still redirects %s to /login", async (path) => {
		const response = await run(path);
		expect(response.status).toBe(307);
		expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
			"/login",
		);
	});
});
