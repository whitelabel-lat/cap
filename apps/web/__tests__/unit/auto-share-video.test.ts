import { autoShareVideoToOrg } from "@cap/database/auto-share";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ CAP_AUTO_SHARE_TO_ORG: false }));
vi.mock("@cap/env", () => ({ serverEnv: () => env }));

function fakeDb(existing: unknown[]) {
	const inserted: Record<string, unknown>[] = [];
	const db = {
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => existing }) }),
		}),
		insert: () => ({
			values: async (v: Record<string, unknown>) => {
				inserted.push(v);
			},
		}),
	};
	return { db: db as never, inserted };
}

const args = {
	videoId: "vid1" as never,
	orgId: "org1" as never,
	ownerId: "user1" as never,
};

describe("autoShareVideoToOrg", () => {
	beforeEach(() => {
		env.CAP_AUTO_SHARE_TO_ORG = false;
	});

	it("is a no-op when CAP_AUTO_SHARE_TO_ORG is off", async () => {
		const { db, inserted } = fakeDb([]);
		expect(await autoShareVideoToOrg(db, args)).toBe(false);
		expect(inserted).toHaveLength(0);
	});

	it("inserts a shared_videos row for the owner's org when on", async () => {
		env.CAP_AUTO_SHARE_TO_ORG = true;
		const { db, inserted } = fakeDb([]);
		expect(await autoShareVideoToOrg(db, args)).toBe(true);
		expect(inserted).toEqual([
			expect.objectContaining({
				videoId: "vid1",
				organizationId: "org1",
				sharedByUserId: "user1",
			}),
		]);
		expect((inserted[0]?.id as string).length).toBe(15);
	});

	it("is idempotent: does not insert when the row already exists", async () => {
		env.CAP_AUTO_SHARE_TO_ORG = true;
		const { db, inserted } = fakeDb([{ id: "x" }]);
		expect(await autoShareVideoToOrg(db, args)).toBe(false);
		expect(inserted).toHaveLength(0);
	});
});
