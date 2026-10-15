import { BRAND_COLORS, BRAND_NAME } from "@cap/utils/brand";
import { ZELLIA_ISOTYPE, ZELLIA_WORDMARK } from "@cap/utils/brand-shapes";
import type { CSSProperties, ReactNode } from "react";
import { OG_SANS } from "@/lib/og/fonts";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// whitelabel fork: OG cards render the Zellia Clips brand; the upstream Cap desktop mock-ups were removed.
export const OG_INK = "#111111";
export const OG_INK_SOFT = "rgba(17,17,17,0.74)";
export const OG_INK_MUTED = "rgba(17,17,17,0.5)";

const flex = (extra: CSSProperties = {}): CSSProperties => ({
	display: "flex",
	...extra,
});

export const OgCanvas = ({ children }: { children: ReactNode }) => (
	<div
		style={flex({
			width: "100%",
			height: "100%",
			position: "relative",
			fontFamily: OG_SANS,
			color: OG_INK,
			backgroundImage:
				"linear-gradient(135deg, #F5F9FE 0%, #E6EBEF 60%, #AABFD6 140%)",
		})}
	>
		<div
			style={flex({
				position: "absolute",
				top: 0,
				left: 0,
				width: OG_WIDTH,
				height: 10,
				background: BRAND_COLORS.primary,
			})}
		/>
		{children}
	</div>
);

export const Headline = ({
	children,
	size,
	lines = 3,
}: {
	children: string;
	size: number;
	lines?: number;
}) => (
	<span
		style={{
			display: "block",
			fontSize: size,
			fontWeight: 400,
			lineHeight: 1.02,
			letterSpacing: -size * 0.03,
			color: OG_INK,
			lineClamp: lines,
		}}
	>
		{children}
	</span>
);

export const Body = ({
	children,
	size = 27,
	lines = 2,
}: {
	children: string;
	size?: number;
	lines?: number;
}) => (
	<span
		style={{
			display: "block",
			fontFamily: OG_SANS,
			fontSize: size,
			fontWeight: 400,
			lineHeight: 1.38,
			letterSpacing: -size * 0.01,
			color: OG_INK_SOFT,
			lineClamp: lines,
		}}
	>
		{children}
	</span>
);

export const MeshFrame = ({
	width,
	height,
	padding = 12,
	radius = 28,
	children,
}: {
	width: number;
	height: number;
	padding?: number;
	radius?: number;
	children: ReactNode;
}) => (
	<div
		style={flex({
			position: "relative",
			width,
			height,
			padding,
			borderRadius: radius,
			overflow: "hidden",
			boxShadow:
				"0 40px 80px -24px rgba(40,72,130,0.35), 0 0 0 1px rgba(255,255,255,0.55)",
		})}
	>
		<div
			style={flex({
				position: "absolute",
				top: 0,
				left: 0,
				width,
				height,
				backgroundImage: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #23527F 100%)`,
			})}
		/>
		{children}
	</div>
);

export const BrandWordmark = ({ height = 52 }: { height?: number }) => {
	const [, , boxWidth, boxHeight] = ZELLIA_WORDMARK.viewBox.split(" ");
	return (
		<svg
			role="img"
			aria-label={BRAND_NAME}
			width={Math.round((height * Number(boxWidth)) / Number(boxHeight))}
			height={height}
			viewBox={ZELLIA_WORDMARK.viewBox}
		>
			<path fill={BRAND_COLORS.ink} d={ZELLIA_WORDMARK.body} />
			<path fill={ZELLIA_WORDMARK.dotFill} d={ZELLIA_WORDMARK.dot} />
		</svg>
	);
};

export const BrandIsotypeArt = ({
	height,
	light,
}: {
	height: number;
	light?: boolean;
}) => {
	const [, , boxWidth, boxHeight] = ZELLIA_ISOTYPE.viewBox.split(" ");
	return (
		<svg
			role="img"
			aria-label={BRAND_NAME}
			width={Math.round((height * Number(boxWidth)) / Number(boxHeight))}
			height={height}
			viewBox={ZELLIA_ISOTYPE.viewBox}
		>
			<path
				fill={light ? "#ffffff" : BRAND_COLORS.primary}
				d={ZELLIA_ISOTYPE.body}
			/>
			<path fill={BRAND_COLORS.accent} d={ZELLIA_ISOTYPE.dot} />
		</svg>
	);
};

export const titleFontSize = (title: string) => {
	if (title.length <= 22) return 84;
	if (title.length <= 30) return 70;
	if (title.length <= 56) return 60;
	return 50;
};
