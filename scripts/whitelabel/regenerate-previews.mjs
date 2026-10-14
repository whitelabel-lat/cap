// whitelabel fork: generate the missing thumbnail and animated preview of videos
// that never went through the media-server (imported from the old stack).
//
// Uses the same media-server pipeline as upstream's process-video and
// admin-reprocess workflows (POST /video/process), so the outputs land on the
// keys the app reads:
//   <owner>/<video>/screenshot/screen-capture.jpg
//   <owner>/<video>/preview/animated-preview.gif
// Differences with admin-reprocess, on purpose:
//   - result.mp4 is NOT replaced: the job runs with remuxOnly and its output goes
//     to a scratch key (<owner>/<video>/.whitelabel-regenerate/result.mp4) that is
//     deleted afterwards.
//   - no webhook and no video_uploads row: the database is not touched, so
//     transcription, AI and the video status stay as they are.
//   - an existing thumbnail or preview is never overwritten (pass --force to
//     regenerate them; back them up first).
//
// Run inside the cap-web container (it has every variable it needs):
//   docker exec -i <cap-web> node --input-type=module - <owner>/<video> ... \
//     < scripts/whitelabel/regenerate-previews.mjs
// Env: CAP_AWS_ACCESS_KEY, CAP_AWS_SECRET_KEY, CAP_AWS_BUCKET, CAP_AWS_REGION,
//      S3_INTERNAL_ENDPOINT, MEDIA_SERVER_URL, MEDIA_SERVER_WEBHOOK_SECRET.

import { createHash, createHmac } from "node:crypto";

const env = (name) => {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name}`);
	return value;
};

const accessKey = env("CAP_AWS_ACCESS_KEY");
const secretKey = env("CAP_AWS_SECRET_KEY");
const bucket = env("CAP_AWS_BUCKET");
const region = process.env.CAP_AWS_REGION || "us-east-1";
const s3 = new URL(env("S3_INTERNAL_ENDPOINT"));
const mediaServer = env("MEDIA_SERVER_URL").replace(/\/$/, "");
const mediaSecret = env("MEDIA_SERVER_WEBHOOK_SECRET");

const args = process.argv.slice(2);
const force = args.includes("--force");
const targets = args.filter((arg) => !arg.startsWith("--"));

const rfc3986 = (value) =>
	encodeURIComponent(value).replace(
		/[!'()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
	);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();

// SigV4 query-string presign, path style, only the host header signed.
function presign(method, key, expiresIn = 3 * 60 * 60) {
	const now = new Date();
	const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
	const day = amzDate.slice(0, 8);
	const scope = `${day}/${region}/s3/aws4_request`;
	const path = `/${[bucket, ...key.split("/")].map(rfc3986).join("/")}`;
	const query = Object.entries({
		"X-Amz-Algorithm": "AWS4-HMAC-SHA256",
		"X-Amz-Credential": `${accessKey}/${scope}`,
		"X-Amz-Date": amzDate,
		"X-Amz-Expires": String(expiresIn),
		"X-Amz-SignedHeaders": "host",
	})
		.map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
		.sort()
		.join("&");
	const canonical = [
		method,
		path,
		query,
		`host:${s3.host}\n`,
		"host",
		"UNSIGNED-PAYLOAD",
	].join("\n");
	const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join(
		"\n",
	);
	let signingKey = hmac(`AWS4${secretKey}`, day);
	for (const part of [region, "s3", "aws4_request"])
		signingKey = hmac(signingKey, part);
	const signature = createHmac("sha256", signingKey)
		.update(toSign)
		.digest("hex");
	return `${s3.protocol}//${s3.host}${path}?${query}&X-Amz-Signature=${signature}`;
}

const exists = async (key) =>
	(await fetch(presign("HEAD", key), { method: "HEAD" })).ok;

async function regenerate(target) {
	const [ownerId, videoId] = target.split("/");
	if (!ownerId || !videoId)
		throw new Error(`Expected <owner>/<video>: ${target}`);
	const prefix = `${ownerId}/${videoId}`;
	const resultKey = `${prefix}/result.mp4`;
	const thumbnailKey = `${prefix}/screenshot/screen-capture.jpg`;
	const previewKey = `${prefix}/preview/animated-preview.gif`;
	const scratchKey = `${prefix}/.whitelabel-regenerate/result.mp4`;

	if (!(await exists(resultKey))) return { videoId, status: "no-result-mp4" };
	const needThumbnail = force || !(await exists(thumbnailKey));
	const needPreview = force || !(await exists(previewKey));
	if (!needThumbnail && !needPreview) return { videoId, status: "up-to-date" };

	const response = await fetch(`${mediaServer}/video/process`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-media-server-secret": mediaSecret,
		},
		body: JSON.stringify({
			videoId,
			userId: ownerId,
			videoUrl: presign("GET", resultKey),
			outputPresignedUrl: presign("PUT", scratchKey),
			...(needThumbnail
				? { thumbnailPresignedUrl: presign("PUT", thumbnailKey) }
				: {}),
			...(needPreview
				? { previewGifPresignedUrl: presign("PUT", previewKey) }
				: {}),
			inputExtension: ".mp4",
			priority: "bulk",
			remuxOnly: true,
		}),
	});
	if (!response.ok)
		return {
			videoId,
			status: `start-failed ${response.status} ${await response.text()}`,
		};
	const { jobId } = await response.json();

	let phase = "queued";
	for (let attempt = 0; attempt < 360; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 5000));
		const status = await fetch(`${mediaServer}/video/process/${jobId}/status`);
		if (!status.ok) {
			phase = `status-${status.status}`;
			break;
		}
		const job = await status.json();
		phase = job.phase;
		if (["complete", "error", "cancelled"].includes(phase)) {
			if (phase !== "complete") phase = `${phase}: ${job.error ?? job.message}`;
			break;
		}
	}

	await fetch(presign("DELETE", scratchKey), { method: "DELETE" });
	return {
		videoId,
		status: phase,
		thumbnail: (await exists(thumbnailKey)) ? "present" : "missing",
		preview: (await exists(previewKey)) ? "present" : "missing",
		generated: [needThumbnail && "thumbnail", needPreview && "preview"].filter(
			Boolean,
		),
	};
}

for (const target of targets) {
	try {
		console.log(JSON.stringify(await regenerate(target)));
	} catch (error) {
		console.log(JSON.stringify({ target, status: `failed: ${error.message}` }));
	}
}
