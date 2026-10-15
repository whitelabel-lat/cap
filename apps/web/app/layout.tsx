import "@/app/globals.css";
import { buildEnv, serverEnv } from "@cap/env";
import { BRAND_COLORS, BRAND_DESCRIPTION, BRAND_NAME } from "@cap/utils/brand";
import { OpenPanelComponent } from "@openpanel/nextjs";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { PropsWithChildren } from "react";

// whitelabel fork: Zellia Clips branding (name, colors, metadata and font) lives in @cap/utils/brand and public/logos/zellia.
const defaultFont = localFont({
	src: [
		{
			path: "../public/fonts/Inter-Variable-latin.woff2",
			weight: "100 900",
			style: "normal",
		},
	],
	preload: false,
});

const resolveWebUrl = () => {
	const candidates = [
		() => serverEnv().WEB_URL,
		() => buildEnv.NEXT_PUBLIC_WEB_URL,
	];
	for (const candidate of candidates) {
		try {
			return new URL(candidate());
		} catch {}
	}
	return undefined;
};

export const generateMetadata = (): Metadata => {
	const metadataBase = resolveWebUrl();
	const webUrl = metadataBase?.origin;
	return {
		metadataBase,
		title: BRAND_NAME,
		description: BRAND_DESCRIPTION,
		applicationName: BRAND_NAME,
		openGraph: {
			title: BRAND_NAME,
			description: BRAND_DESCRIPTION,
			type: "website",
			url: webUrl,
			siteName: BRAND_NAME,
			images: [
				{
					url: "/api/og",
					width: 1200,
					height: 630,
					alt: BRAND_NAME,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: BRAND_NAME,
			description: BRAND_DESCRIPTION,
			images: ["/api/og"],
		},
	};
};

export default function RootLayout({ children }: PropsWithChildren) {
	return (
		// suppressHydrationWarning: the Cap Chrome extension stamps
		// data-cap-chrome-extension-installed on <html> at document_idle,
		// which can land before hydration finishes.
		<html className={defaultFont.className} lang="en" suppressHydrationWarning>
			<head>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
				<link rel="manifest" href="/site.webmanifest" />
				<link
					rel="mask-icon"
					href="/safari-pinned-tab.svg"
					color={BRAND_COLORS.primary}
				/>
				<link rel="shortcut icon" href="/favicon.ico" />
				<meta name="msapplication-TileColor" content={BRAND_COLORS.primary} />
				<meta name="theme-color" content={BRAND_COLORS.primary} />
			</head>
			<body suppressHydrationWarning>
				<Script src="/theme-script.js" strategy="beforeInteractive" />
				{buildEnv.NEXT_PUBLIC_OPENPANEL_CLIENT_ID ? (
					<OpenPanelComponent
						apiUrl="/api/op"
						clientId={buildEnv.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
						scriptUrl="/api/op/op1.js"
						trackOutgoingLinks
						trackScreenViews
					/>
				) : null}
				<main className="w-full">{children}</main>
			</body>
		</html>
	);
}
