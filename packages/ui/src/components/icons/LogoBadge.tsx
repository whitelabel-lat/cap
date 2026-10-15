import { BRAND_COLORS, BRAND_NAME } from "@cap/utils/brand";
import { ZELLIA_ISOTYPE } from "@cap/utils/brand-shapes";

export const LogoBadge = ({ className }: { className: string }) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			fill="none"
			viewBox="0 0 40 40"
			preserveAspectRatio="xMidYMid meet"
			style={{
				aspectRatio: "1 / 1",
			}}
			role="img"
			aria-label={BRAND_NAME}
		>
			<rect width="40" height="40" fill={BRAND_COLORS.primary} rx="9" />
			<svg
				x="7.7"
				aria-hidden="true"
				y="4"
				width="24.6"
				height="32"
				viewBox={ZELLIA_ISOTYPE.viewBox}
				preserveAspectRatio="xMidYMid meet"
			>
				<path fill="#fff" fillRule="evenodd" d={ZELLIA_ISOTYPE.body} />
				<path
					fill={ZELLIA_ISOTYPE.dotFill}
					fillRule="evenodd"
					d={ZELLIA_ISOTYPE.dot}
				/>
			</svg>
		</svg>
	);
};
