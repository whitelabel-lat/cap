import { BRAND_COLORS, BRAND_NAME } from "@cap/utils/brand";
import { ZELLIA_ISOTYPE } from "@cap/utils/brand-shapes";

export const LogoSpinner = ({ className }: { className: string }) => {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 40 40"
			role="img"
			aria-label={BRAND_NAME}
		>
			<rect width="40" height="40" fill="#fff" rx="9" />
			<circle cx="20" cy="20" r="16" stroke="#E6EBEF" strokeWidth="2.5" />
			<g className="origin-center [transform-box:fill-box] motion-safe:animate-spin">
				<circle
					cx="20"
					cy="20"
					r="16"
					stroke={BRAND_COLORS.primary}
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeDasharray="28 73"
				/>
			</g>
			<svg
				x="11.95"
				aria-hidden="true"
				y="9.5"
				width="16.1"
				height="21"
				viewBox={ZELLIA_ISOTYPE.viewBox}
				preserveAspectRatio="xMidYMid meet"
			>
				<path
					fill={BRAND_COLORS.ink}
					fillRule="evenodd"
					d={ZELLIA_ISOTYPE.body}
				/>
				<path
					className="motion-safe:animate-pulse"
					fill={ZELLIA_ISOTYPE.dotFill}
					fillRule="evenodd"
					d={ZELLIA_ISOTYPE.dot}
				/>
			</svg>
		</svg>
	);
};
