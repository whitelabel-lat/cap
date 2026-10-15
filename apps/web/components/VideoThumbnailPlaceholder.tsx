import { BRAND_COLORS } from "@cap/utils/brand";
import { ZELLIA_ISOTYPE } from "@cap/utils/brand-shapes";
import clsx from "clsx";

const PLAY_PATH =
	"M7 3.8c0-.8.9-1.3 1.6-.9l12 7.6c.6.4.6 1.3 0 1.7l-12 7.6c-.7.4-1.6-.1-1.6-.9Z";

export const VideoThumbnailPlaceholder = ({
	className,
}: {
	className?: string;
}) => (
	<div
		data-video-thumbnail-placeholder
		className={clsx(
			"flex absolute inset-0 justify-center items-center w-full h-full bg-gradient-to-br from-[#F5F9FE] via-[#E6EBEF] to-[#AABFD6] [.dark_&]:from-[#002041] [.dark_&]:via-[#023562] [.dark_&]:to-[#23527F]",
			className,
		)}
	>
		<svg
			viewBox={ZELLIA_ISOTYPE.viewBox}
			aria-hidden="true"
			className="w-auto h-[56%]"
			fill="none"
		>
			<path
				className="fill-[#023562] [.dark_&]:fill-[#E6EBEF]"
				fillRule="evenodd"
				d={ZELLIA_ISOTYPE.body}
			/>
			<path
				fill={BRAND_COLORS.accent}
				fillRule="evenodd"
				d={ZELLIA_ISOTYPE.dot}
			/>
		</svg>
		<span
			aria-hidden="true"
			className="flex absolute right-3 bottom-3 justify-center items-center rounded-full shadow-lg size-9 bg-[#023562] [.dark_&]:bg-[#E6EBEF]"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true" className="ml-0.5 size-3.5">
				<path d={PLAY_PATH} className="fill-white [.dark_&]:fill-[#023562]" />
			</svg>
		</span>
	</div>
);
