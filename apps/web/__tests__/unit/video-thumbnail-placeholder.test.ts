import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VideoThumbnailPlaceholder } from "../../components/VideoThumbnailPlaceholder";

describe("VideoThumbnailPlaceholder", () => {
	const markup = renderToStaticMarkup(createElement(VideoThumbnailPlaceholder));

	it("renders the Zellia isotype with the orange dot on a light gradient", () => {
		expect(markup).toContain("from-[#F5F9FE]");
		expect(markup).toContain("#FC4501");
	});

	it("has a dark variant driven by the .dark class, not the OS media query", () => {
		expect(markup).toContain("[.dark_&amp;]:from-[#002041]");
		expect(markup).not.toMatch(/(^|\s)dark:/);
	});

	it("replaces the flat navy fallback in VideoThumbnail", () => {
		const source = readFileSync(
			join(__dirname, "..", "..", "components", "VideoThumbnail.tsx"),
			"utf8",
		);
		expect(source).toContain("VideoThumbnailPlaceholder");
		expect(source).not.toContain("from-[#023562] to-[#23527F]");
	});
});
