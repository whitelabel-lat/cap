import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { VideoThumbnailPlaceholder } from "../../components/VideoThumbnailPlaceholder";
import { renderVideoOg, type VideoOgVariant } from "../../lib/og/video-og";

const outDir = process.env.OG_PREVIEW_DIR;
const frame = outDir
	? `data:image/png;base64,${readFileSync(
			process.env.OG_PREVIEW_FRAME ?? join(outDir, "sample-frame-zellia.png"),
		).toString("base64")}`
	: "";

const long =
	"Revisión trimestral de producto: roadmap, métricas de adopción, deuda técnica y plan de lanzamiento para el segundo semestre con todo el equipo";

const variants: Record<string, VideoOgVariant> = {
	"video-thumb": {
		kind: "video",
		video: {
			title: "Demo del nuevo onboarding",
			ownerName: "Pedro",
			duration: 204,
			screenshotUrl: frame,
		},
	},
	"video-thumb-long": {
		kind: "video",
		video: {
			title: long.slice(0, 120),
			ownerName: "Valentina Gómez",
			duration: 3671,
			screenshotUrl: frame,
		},
	},
	"video-thumb-short": {
		kind: "video",
		video: { title: "Hola", duration: 12, screenshotUrl: frame },
	},
	"video-thumb-es": {
		kind: "video",
		video: {
			title: "Cómo configurar la integración con el año fiscal ñandú",
			ownerName: "Ángela Muñoz",
			duration: 95,
			screenshotUrl: frame,
		},
	},
	"video-nothumb": {
		kind: "video",
		video: {
			title: "Demo del nuevo onboarding",
			ownerName: "Pedro",
			duration: 204,
		},
	},
	"video-nothumb-long": {
		kind: "video",
		video: { title: long.slice(0, 120), ownerName: "Valentina Gómez" },
	},
	"video-nothumb-short": { kind: "video", video: { title: "Hola" } },
	"video-nothumb-es": {
		kind: "video",
		video: {
			title: "Cómo configurar la integración con el año fiscal ñandú",
			ownerName: "Ángela Muñoz",
			duration: 95,
		},
	},
	locked: { kind: "locked" },
	password: { kind: "password" },
	"not-found": { kind: "not-found" },
};

describe.skipIf(!outDir)("og preview harness", () => {
	it("writes one PNG per variant", async () => {
		mkdirSync(outDir as string, { recursive: true });
		for (const [name, variant] of Object.entries(variants)) {
			const res = await renderVideoOg(variant);
			writeFileSync(
				join(outDir as string, `og-${name}.png`),
				Buffer.from(await res.arrayBuffer()),
			);
		}
	}, 60000);

	it("writes the thumbnail placeholder snapshot page", () => {
		mkdirSync(outDir as string, { recursive: true });
		const card = (width: number) =>
			`<div style="width:${width}px;aspect-ratio:16/9" class="relative overflow-hidden rounded-xl">${renderToStaticMarkup(createElement(VideoThumbnailPlaceholder)).replaceAll("&amp;", "&")}</div>`;
		const row = (theme: string, background: string) =>
			`<section class="${theme}" style="display:flex;gap:24px;align-items:flex-start;padding:24px;background:${background}">${[320, 240, 160].map(card).join("")}</section>`;
		writeFileSync(
			join(outDir as string, "placeholder.html"),
			`<!doctype html><html><head><link rel="stylesheet" href="placeholder.css"></head><body style="margin:0">${row("light", "#ffffff")}${row("dark", "#0f1115")}</body></html>`,
		);
	});
});
