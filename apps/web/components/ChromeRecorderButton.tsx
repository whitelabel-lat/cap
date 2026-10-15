"use client";

import { buildEnv } from "@cap/env";
import type { ButtonProps } from "@cap/ui";
import { useCapChromeExtension } from "hooks/useCapChromeExtension";
import type React from "react";
import { ChromeExtensionButton } from "@/components/ChromeExtensionButton";

type ChromeRecorderButtonProps = {
	className?: string;
	size?: ButtonProps["size"];
	variant?: ButtonProps["variant"];
};

export function ChromeRecorderButton({
	className,
	size = "sm",
	variant = "white",
}: ChromeRecorderButtonProps) {
	const { isChromeBrowser, isInstalled, openRecorder } =
		useCapChromeExtension();

	const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
		if (!isInstalled) return;

		event.preventDefault();
		openRecorder();
	};

	// whitelabel fork: the Chrome extension talks to the upstream cloud, not to a self-hosted server.
	if (!buildEnv.NEXT_PUBLIC_IS_CAP) return null;
	if (!isChromeBrowser && !isInstalled) return null;

	return (
		<ChromeExtensionButton
			href={isInstalled ? null : undefined}
			label={isInstalled ? "Record with Chrome" : "Add to Chrome"}
			size={size}
			variant={variant}
			className={className}
			onClick={handleClick}
		/>
	);
}
