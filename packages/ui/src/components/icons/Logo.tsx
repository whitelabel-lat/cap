import { BRAND_COLORS, BRAND_NAME } from "@cap/utils/brand";
import {
	ZELLIA_ISOTYPE,
	ZELLIA_WORDMARK,
	ZELLIA_WORDMARK_WHITE,
} from "@cap/utils/brand-shapes";

export const Logo = ({
	className,
	showVersion,
	showBeta,
	white,
	staticInk,
	hideLogoName,
	style,
}: {
	className?: string;
	showVersion?: boolean;
	showBeta?: boolean;
	white?: boolean;
	staticInk?: boolean;
	hideLogoName?: boolean;
	style?: React.CSSProperties;
	squaredMark?: boolean;
	viewBoxDimensions?: `${string} ${string} ${string} ${string}`;
}) => {
	const shape = hideLogoName
		? ZELLIA_ISOTYPE
		: white
			? ZELLIA_WORDMARK_WHITE
			: ZELLIA_WORDMARK;
	const bodyFill = white ? "#ffffff" : BRAND_COLORS.ink;

	return (
		<div className="flex items-center">
			<svg
				viewBox={shape.viewBox}
				xmlns="http://www.w3.org/2000/svg"
				preserveAspectRatio="xMidYMid meet"
				fill="none"
				style={style}
				role="img"
				aria-label={`${BRAND_NAME} logo`}
				className={className}
			>
				<path
					className={
						white ? "fill-white" : staticInk ? undefined : "fill-gray-12"
					}
					fill={bodyFill}
					fillRule="evenodd"
					d={shape.body}
				/>
				<path fill={shape.dotFill} fillRule="evenodd" d={shape.dot} />
			</svg>
			{showVersion && (
				<span
					className={`text-[10px] font-medium ${
						white ? "text-white" : "text-gray-1"
					}`}
				>
					v{process.env.appVersion}
				</span>
			)}
			{showBeta && (
				<span
					className={`text-[10px] font-medium min-w-[52px] ${
						white ? "text-white" : "text-gray-1"
					}`}
				>
					Beta v{process.env.appVersion}
				</span>
			)}
		</div>
	);
};
