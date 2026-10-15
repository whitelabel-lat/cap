import { readFile } from "node:fs/promises";
import path from "node:path";

export type OgFont = {
	name: string;
	data: ArrayBuffer;
	weight: 300 | 400 | 500;
	style: "normal";
};

export const OG_SANS = "Inter";
export const OG_MONO = "DM Mono";

let fontsPromise: Promise<OgFont[]> | null = null;

const loadFont = async (
	name: string,
	file: string,
	weight: OgFont["weight"],
): Promise<OgFont> => {
	const data = await readFile(
		path.join(process.cwd(), "lib", "og", "fonts", file),
	);
	return {
		name,
		data: data.buffer.slice(
			data.byteOffset,
			data.byteOffset + data.byteLength,
		) as ArrayBuffer,
		weight,
		style: "normal",
	};
};

export const loadOgFonts = () => {
	fontsPromise ??= Promise.all([
		loadFont(OG_SANS, "Inter-Regular.ttf", 400),
		loadFont(OG_SANS, "Inter-Medium.ttf", 500),
		loadFont(OG_MONO, "DMMono-Regular.ttf", 400),
		loadFont(OG_MONO, "DMMono-Medium.ttf", 500),
	]).catch((error) => {
		fontsPromise = null;
		throw error;
	});
	return fontsPromise;
};
