import { SignupNotAllowedError } from "@cap/database/auth/signup-invite";
import { organizationInvites, users } from "@cap/database/schema";
import type { Organisation, User } from "@cap/web-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { provisionOrganizationInvitee } from "@/lib/organization-provisioning";

const state = vi.hoisted(() => ({
	env: {} as { CAP_ALLOWED_SIGNUP_DOMAINS?: string },
	selects: [] as unknown[][],
	inserts: [] as { table: unknown; values: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@cap/env", () => ({
	serverEnv: () => state.env,
	buildEnv: {},
}));
vi.mock("@cap/database/loops/queue", () => ({
	enqueueLoopsSync: vi.fn(async () => undefined),
}));
vi.mock("@/utils/organization", () => ({
	calculateProSeats: () => ({ proSeatsRemaining: 0 }),
	hasActiveDirectSubscription: () => false,
}));
vi.mock("@cap/database", () => {
	const chain = {
		from: () => chain,
		innerJoin: () => chain,
		where: () => chain,
		limit: async () => state.selects.shift() ?? [],
	};
	const tx = {
		select: () => chain,
		insert: (table: unknown) => ({
			values: async (values: unknown) => {
				state.inserts.push({ table, values });
			},
		}),
		update: () => ({ set: () => ({ where: async () => undefined }) }),
	};
	return {
		db: () => ({
			transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
		}),
	};
});

const provision = (email: string) =>
	provisionOrganizationInvitee({
		organizationId: "org1" as Organisation.OrganisationId,
		email,
		invitedByUserId: "actor" as User.UserId,
		role: "member",
	});

const insertedInto = (table: unknown) =>
	state.inserts.filter((insert) => insert.table === table);

describe("provisionOrganizationInvitee signup allowlist", () => {
	beforeEach(() => {
		state.env = { CAP_ALLOWED_SIGNUP_DOMAINS: "whitelabel.lat" };
		state.selects = [];
		state.inserts = [];
	});

	it("refuses an outsider provisioned by an external owner", async () => {
		// existing user lookup, then the actor's email
		state.selects = [[], [{ email: "owner@gmail.com" }]];
		await expect(provision("ext@gmail.com")).rejects.toBeInstanceOf(
			SignupNotAllowedError,
		);
		expect(insertedInto(users)).toHaveLength(0);
		expect(insertedInto(organizationInvites)).toHaveLength(0);
	});

	it("provisions an outsider when a whitelabel admin asks", async () => {
		state.selects = [[], [{ email: "admin@whitelabel.lat" }]];
		const result = await provision("Ext@Gmail.com");
		expect(result.userCreated).toBe(true);
		expect(insertedInto(users)).toEqual([
			{
				table: users,
				values: expect.objectContaining({ email: "ext@gmail.com" }),
			},
		]);
	});

	it("provisions an allowlisted email for any actor", async () => {
		state.selects = [[]];
		const result = await provision("new@whitelabel.lat");
		expect(result.userCreated).toBe(true);
	});

	it("still adds an existing outsider to the org (no new user row)", async () => {
		state.selects = [[{ id: "u1", email: "ext@gmail.com", name: "Ext" }]];
		const result = await provision("ext@gmail.com");
		expect(result.userCreated).toBe(false);
		expect(insertedInto(users)).toHaveLength(0);
	});

	it("keeps upstream behaviour when the allowlist is unset", async () => {
		state.env = {};
		state.selects = [[]];
		const result = await provision("ext@gmail.com");
		expect(result.userCreated).toBe(true);
		expect(insertedInto(users)).toHaveLength(1);
	});
});
