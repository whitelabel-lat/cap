import { buildEnv } from "@cap/env";
import { BRAND_NAME } from "@cap/utils/brand";
import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { AppProviders } from "../Layout/AppProviders";
import { DeferredMessengerWidget } from "../Layout/DeferredMessengerWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { default: BRAND_NAME, template: `%s | ${BRAND_NAME}` },
};

export default function Layout(props: PropsWithChildren) {
	return (
		<AppProviders>
			{props.children}
			{buildEnv.NEXT_PUBLIC_IS_CAP === "true" && <DeferredMessengerWidget />}
		</AppProviders>
	);
}
