import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// whitelabel fork: the self-hosted image runs Workflow DevKit with the local
// world, which keeps its state in `<cwd>/.workflow-data` (cwd = /app). /app is
// owned by root and the server runs as `nextjs`, so the directory must exist in
// the image with the right owner or every `start()` fails with EACCES and no
// workflow (transcription, AI, processing, edits) ever runs.
const dockerfile = readFileSync(
	join(__dirname, "..", "..", "Dockerfile"),
	"utf8",
);
const runnerStage = dockerfile.slice(dockerfile.indexOf("AS runner"));

describe("apps/web/Dockerfile workflow data directory", () => {
	it("creates /app/.workflow-data owned by nextjs in the runner stage", () => {
		expect(runnerStage).toMatch(
			/mkdir -p \/app\/\.workflow-data[^\n]*&&[^\n]*chown nextjs:nodejs \/app\/\.workflow-data/,
		);
	});

	it("creates it before switching to the nextjs user", () => {
		const mkdirAt = runnerStage.indexOf("/app/.workflow-data");
		const userAt = runnerStage.indexOf("USER nextjs");
		expect(mkdirAt).toBeGreaterThan(-1);
		expect(mkdirAt).toBeLessThan(userAt);
	});
});
