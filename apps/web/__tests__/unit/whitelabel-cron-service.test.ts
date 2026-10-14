import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// whitelabel fork: on Vercel, apps/web/vercel.json schedules the /api/cron/*
// routes. Self-hosted nobody calls them, so the fork runs a small cron service
// (scripts/whitelabel/cron) that calls cap-web over the internal network with
// CRON_SECRET. These tests keep that crontab in sync with vercel.json after
// every upstream merge: a new upstream cron must be scheduled or explicitly
// skipped here with the reason.

const repoRoot = join(__dirname, "..", "..", "..", "..");
const cronDir = join(repoRoot, "scripts", "whitelabel", "cron");

const vercelCrons = (
	JSON.parse(
		readFileSync(join(__dirname, "..", "..", "vercel.json"), "utf8"),
	) as { crons: Array<{ path: string; schedule: string }> }
).crons;

const crontabEntries = readFileSync(join(cronDir, "crontab"), "utf8")
	.split("\n")
	.map((line) => line.trim())
	.filter((line) => line && !line.startsWith("#"))
	.map((line) => {
		const fields = line.split(/\s+/);
		return {
			schedule: fields.slice(0, 5).join(" "),
			command: fields.slice(5),
		};
	});

const SKIPPED: Record<string, string> = {
	"/api/cron/sync-loops":
		"Loops.so marketing contact sync of Cap cloud; needs LOOPS_* keys we do not use",
};

describe("whitelabel cron service", () => {
	it("schedules every vercel.json cron that is not explicitly skipped", () => {
		for (const cron of vercelCrons) {
			if (SKIPPED[cron.path]) continue;
			expect(crontabEntries).toContainEqual({
				schedule: cron.schedule,
				command: ["cap-cron", cron.path],
			});
		}
	});

	it("only calls /api/cron routes through the cap-cron wrapper", () => {
		expect(crontabEntries.length).toBeGreaterThan(0);
		for (const entry of crontabEntries) {
			expect(entry.command).toHaveLength(2);
			expect(entry.command[0]).toBe("cap-cron");
			expect(entry.command[1]).toMatch(/^\/api\/cron\/[a-z0-9-]+$/);
			expect(SKIPPED[entry.command[1] ?? ""]).toBeUndefined();
		}
	});

	it("sends CRON_SECRET as a Bearer token without putting it on the command line", () => {
		const wrapper = readFileSync(join(cronDir, "cap-cron.sh"), "utf8");
		expect(wrapper).toContain("Authorization: Bearer");
		expect(wrapper).toMatch(/curl[^\n]*(-K|--config) -/);
		expect(wrapper).not.toMatch(/curl[^\n]*-H[^\n]*CRON_SECRET/);
	});

	it("runs supercronic as a non-root user", () => {
		const dockerfile = readFileSync(join(cronDir, "Dockerfile"), "utf8");
		expect(dockerfile).toMatch(/^USER (?!root)\S+/m);
		expect(dockerfile).toMatch(/supercronic/);
	});

	it("starts supercronic by absolute path (as PID 1 its reaper re-execs argv[0])", () => {
		const dockerfile = readFileSync(join(cronDir, "Dockerfile"), "utf8");
		expect(dockerfile).toMatch(/^CMD \["\/usr\/bin\/supercronic"/m);
	});
});
