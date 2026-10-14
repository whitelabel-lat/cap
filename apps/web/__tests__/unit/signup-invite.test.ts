import {
	assertMayProvisionUser,
	hasPendingSignupInvite,
	SignupNotAllowedError,
} from "@cap/database/auth/signup-invite";
import type { User } from "@cap/web-domain";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("@cap/env", () => ({
	serverEnv: () => ({}),
}));

const ALLOWED = "whitelabel.lat";

type Query = { sql: string; params: unknown[] };

/**
 * Minimal drizzle stand-in: every `select(...)...limit()` chain resolves to the
 * next entry of `results`, and the `where` condition is recorded.
 */
function fakeDb(results: unknown[][]) {
	const queries: Query[] = [];
	let call = 0;
	const chain = {
		from: () => chain,
		innerJoin: () => chain,
		where: (condition: SQL) => {
			queries.push(new MySqlDialect().sqlToQuery(condition));
			return chain;
		},
		limit: async () => results[call++] ?? [],
	};
	const db = { select: () => chain };
	return { db: db as never, queries };
}

describe("hasPendingSignupInvite", () => {
	it("is false without any invite or grant", async () => {
		const { db } = fakeDb([[], []]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			false,
		);
	});

	it("counts an organization invite made by an allowlisted user", async () => {
		const { db } = fakeDb([[{ inviterEmail: "ana@whitelabel.lat" }]]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			true,
		);
	});

	it("ignores an organization invite made by an external user", async () => {
		const { db } = fakeDb([[{ inviterEmail: "other@gmail.com" }], []]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			false,
		);
	});

	it("counts a viewer grant made by an allowlisted user", async () => {
		const { db } = fakeDb([[], [{ inviterEmail: "Ana@Whitelabel.lat" }]]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			true,
		);
	});

	it("ignores a viewer grant made by an external user", async () => {
		const { db } = fakeDb([[], [{ inviterEmail: "other@gmail.com" }]]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			false,
		);
	});

	it("is true when any of several invites comes from an allowlisted user", async () => {
		const { db } = fakeDb([
			[
				{ inviterEmail: "other@gmail.com" },
				{ inviterEmail: "ana@whitelabel.lat" },
			],
		]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED)).toBe(
			true,
		);
	});

	it("counts any invite when the allowlist is unset", async () => {
		const { db } = fakeDb([[{ inviterEmail: "other@gmail.com" }]]);
		expect(await hasPendingSignupInvite(db, "ext@gmail.com", undefined)).toBe(
			true,
		);
	});

	it("is false for a malformed email without querying", async () => {
		const { db, queries } = fakeDb([[{ inviterEmail: "ana@whitelabel.lat" }]]);
		expect(await hasPendingSignupInvite(db, "not-an-email", ALLOWED)).toBe(
			false,
		);
		expect(queries).toHaveLength(0);
	});

	it("looks up the trimmed, lowercased email", async () => {
		const { db, queries } = fakeDb([[], []]);
		await hasPendingSignupInvite(db, "  Ext@Gmail.COM ", ALLOWED);
		expect(queries).toHaveLength(2);
		for (const query of queries) {
			expect(query.params).toContain("ext@gmail.com");
		}
	});

	it("filters invites on the pending status, expiry and grants on revocation", async () => {
		const { db, queries } = fakeDb([[], []]);
		await hasPendingSignupInvite(db, "ext@gmail.com", ALLOWED);
		expect(queries[0]?.params).toContain("pending");
		expect(queries[0]?.sql).toContain("expiresAt");
		expect(queries[1]?.sql).toContain("revokedAt");
	});
});

describe("assertMayProvisionUser", () => {
	const target = (email: string) => ({
		email,
		actorUserId: "actor" as User.UserId,
	});

	it("allows anything when the allowlist is unset, without querying", async () => {
		const { db, queries } = fakeDb([[{ email: "other@gmail.com" }]]);
		await expect(
			assertMayProvisionUser(db, target("ext@gmail.com"), undefined),
		).resolves.toBeUndefined();
		expect(queries).toHaveLength(0);
	});

	it("allows an allowlisted target without looking up the actor", async () => {
		const { db, queries } = fakeDb([[{ email: "other@gmail.com" }]]);
		await expect(
			assertMayProvisionUser(db, target("New@Whitelabel.lat"), ALLOWED),
		).resolves.toBeUndefined();
		expect(queries).toHaveLength(0);
	});

	it("lets an allowlisted actor provision an outsider", async () => {
		const { db } = fakeDb([[{ email: "admin@whitelabel.lat" }]]);
		await expect(
			assertMayProvisionUser(db, target("ext@gmail.com"), ALLOWED),
		).resolves.toBeUndefined();
	});

	it("refuses an external actor provisioning an outsider", async () => {
		const { db } = fakeDb([[{ email: "owner@gmail.com" }]]);
		await expect(
			assertMayProvisionUser(db, target("ext@gmail.com"), ALLOWED),
		).rejects.toBeInstanceOf(SignupNotAllowedError);
	});

	it("refuses when the actor cannot be found", async () => {
		const { db } = fakeDb([[]]);
		await expect(
			assertMayProvisionUser(db, target("ext@gmail.com"), ALLOWED),
		).rejects.toBeInstanceOf(SignupNotAllowedError);
	});
});
