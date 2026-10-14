import { joinDefaultOrganization } from "@cap/database/auth/default-org";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
	CAP_DEFAULT_ORG_ID: undefined as string | undefined,
	CAP_DEFAULT_ORG_ROLE: "member" as "member" | "admin",
}));

vi.mock("@cap/env", () => ({ serverEnv: () => env }));

function fakeTx(orgRows: unknown[]) {
	const inserted: unknown[] = [];
	const updated: unknown[] = [];
	const tx = {
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => orgRows }) }),
		}),
		insert: () => ({
			values: async (v: unknown) => {
				inserted.push(v);
			},
		}),
		update: () => ({
			set: (v: unknown) => ({
				where: async () => {
					updated.push(v);
				},
			}),
		}),
	};
	return { tx: tx as never, inserted, updated };
}

describe("joinDefaultOrganization", () => {
	beforeEach(() => {
		env.CAP_DEFAULT_ORG_ID = undefined;
		env.CAP_DEFAULT_ORG_ROLE = "member";
	});

	it("does nothing when CAP_DEFAULT_ORG_ID is unset", async () => {
		const { tx, inserted, updated } = fakeTx([
			{ id: "org1", tombstoneAt: null },
		]);
		expect(await joinDefaultOrganization(tx, "user1" as never)).toBeNull();
		expect(inserted).toHaveLength(0);
		expect(updated).toHaveLength(0);
	});

	it("falls back (returns null) when the organization does not exist", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx, inserted } = fakeTx([]);
		expect(await joinDefaultOrganization(tx, "user1" as never)).toBeNull();
		expect(inserted).toHaveLength(0);
	});

	it("falls back when the organization is tombstoned", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx } = fakeTx([{ id: "org1", tombstoneAt: new Date() }]);
		expect(await joinDefaultOrganization(tx, "user1" as never)).toBeNull();
	});

	it("adds the user as member and sets active/default org", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx, inserted, updated } = fakeTx([
			{ id: "org1", tombstoneAt: null },
		]);
		expect(await joinDefaultOrganization(tx, "user1" as never)).toBe("org1");
		expect(inserted).toEqual([
			expect.objectContaining({
				organizationId: "org1",
				userId: "user1",
				role: "member",
			}),
		]);
		expect((inserted[0] as { id: string }).id).toHaveLength(15);
		expect(updated).toEqual([
			{ activeOrganizationId: "org1", defaultOrgId: "org1" },
		]);
	});

	it("honours CAP_DEFAULT_ORG_ROLE", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		env.CAP_DEFAULT_ORG_ROLE = "admin";
		const { tx, inserted } = fakeTx([{ id: "org1", tombstoneAt: null }]);
		await joinDefaultOrganization(tx, "user1" as never);
		expect(inserted[0]).toEqual(expect.objectContaining({ role: "admin" }));
	});
});
