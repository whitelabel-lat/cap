import { BRAND_SOURCE_CODE_URL } from "@cap/utils/brand";

export default function NotFound() {
	return (
		<div className="wrapper flex flex-col items-center justify-center h-screen text-center">
			<h1 className="text-5xl md:text-6xl font-medium">404</h1>
			<p className="text-3xl md:text-4xl mb-2">
				Oops, we couldn't find this page
			</p>
			<p className="text-gray-400 text-lg md:text-xl">
				If this seems like a mistake, contact your workspace administrator.
			</p>
			<a
				href={BRAND_SOURCE_CODE_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-8 text-xs text-gray-400 hover:underline"
			>
				Código fuente
			</a>
		</div>
	);
}
