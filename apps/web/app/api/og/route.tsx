import { BRAND_DESCRIPTION, BRAND_NAME } from "@cap/utils/brand";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadOgFonts } from "@/lib/og/fonts";
import { verifyOgSignature } from "@/lib/og/signature";
import {
	Body,
	BrandIsotypeArt,
	BrandWordmark,
	Headline,
	OG_HEIGHT,
	OG_WIDTH,
	OgCanvas,
	titleFontSize,
} from "@/lib/og/template";

const DEFAULT_TITLE = BRAND_DESCRIPTION;
const DEFAULT_DESCRIPTION = BRAND_NAME;

// Strip control characters and collapse whitespace so arbitrary query input
// can't distort the layout.
const clean = (value: string | null, maxLength: number) =>
	value
		?.replace(/\p{Cc}/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength) || undefined;

export async function GET(req: NextRequest) {
	const params = req.nextUrl.searchParams;

	// Only text our own server-side metadata helpers signed gets rendered;
	// anything else (or no params at all) serves the default brand image.
	const rawTitle = params.get("title");
	const isSigned =
		rawTitle !== null &&
		verifyOgSignature(
			{
				title: rawTitle,
				tag: params.get("tag") ?? undefined,
				description: params.get("description") ?? undefined,
			},
			params.get("s"),
		);

	const title = (isSigned && clean(rawTitle, 110)) || DEFAULT_TITLE;
	const description = isSigned
		? clean(params.get("description"), title.length > 72 ? 0 : 150)
		: undefined;
	const isDefault = !isSigned;

	const fonts = await loadOgFonts();
	const body = description ?? (isDefault ? DEFAULT_DESCRIPTION : undefined);

	return new ImageResponse(
		<OgCanvas>
			<div
				style={{ display: "flex", position: "absolute", left: 800, top: 70 }}
			>
				<BrandIsotypeArt height={490} />
			</div>
			<div
				style={{
					display: "flex",
					position: "absolute",
					top: 0,
					left: 0,
					width: 700,
					height: "100%",
					padding: "58px 0 54px 64px",
					flexDirection: "column",
					justifyContent: "space-between",
				}}
			>
				<BrandWordmark />
				<div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
					<Headline size={titleFontSize(title)} lines={4}>
						{title}
					</Headline>
					{body && (
						<Body size={25} lines={title.length > 30 ? 2 : 3}>
							{body}
						</Body>
					)}
				</div>
				<div style={{ display: "flex", height: 52 }} />
			</div>
		</OgCanvas>,
		{
			width: OG_WIDTH,
			height: OG_HEIGHT,
			fonts,
			headers: {
				// The image is a pure function of the URL, so it can be cached
				// forever — changed copy produces a different URL.
				"Cache-Control":
					"public, max-age=31536000, s-maxage=31536000, immutable",
				"X-Robots-Tag": "noindex",
			},
		},
	);
}
