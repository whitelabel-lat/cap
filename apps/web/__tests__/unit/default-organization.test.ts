import { joinDefaultOrganization } from "@cap/database/auth/default-org";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
	CAP_DEFAULT_ORG_ID: undefined as string | undefined,
	CAP_DEFAULT_ORG_ROLE: "member" as "member" | "admin",
	CAP_DEFAULT_ORG_EMAIL_DOMAINS: undefined as string | undefined,
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
		env.CAP_DEFAULT_ORG_EMAIL_DOMAINS = "whitelabel.lat";
	});

	it("does nothing when CAP_DEFAULT_ORG_ID is unset", async () => {
		const { tx, inserted, updated } = fakeTx([
			{ id: "org1", tombstoneAt: null },
		]);
		expect(
			await joinDefaultOrganization(tx, "user1" as never, "ana@whitelabel.lat"),
		).toBeNull();
		expect(inserted).toHaveLength(0);
		expect(updated).toHaveLength(0);
	});

	it("falls back (returns null) when the organization does not exist", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx, inserted } = fakeTx([]);
		expect(
			await joinDefaultOrganization(tx, "user1" as never, "ana@whitelabel.lat"),
		).toBeNull();
		expect(inserted).toHaveLength(0);
	});

	it("falls back when the organization is tombstoned", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx } = fakeTx([{ id: "org1", tombstoneAt: new Date() }]);
		expect(
			await joinDefaultOrganization(tx, "user1" as never, "ana@whitelabel.lat"),
		).toBeNull();
	});

	it("adds the user as member and sets active/default org", async () => {
		env.CAP_DEFAULT_ORG_ID = "org1";
		const { tx, inserted, updated } = fakeTx([
			{ id: "org1", tombstoneAt: null },
		]);
		expect(
			await joinDefaultOrganization(tx, "user1" as never, "ana@whitelabel.lat"),
		).toBe("org1");
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
		await joinDefaultOrganization(tx, "user1" as never, "ana@whitelabel.lat");
		expect(inserted[0]).toEqual(expect.objectContaining({ role: "admin" }));
	});

	describe("CAP_DEFAULT_ORG_EMAIL_DOMAINS", () => {
		const join = (email: string | null | undefined) => {
			env.CAP_DEFAULT_ORG_ID = "org1";
			const fake = fakeTx([{ id: "org1", tombstoneAt: null }]);
			return {
				...fake,
				result: joinDefaultOrganization(fake.tx, "user1" as never, email),
			};
		};

		it("joins when the email domain is in the list", async () => {
			env.CAP_DEFAULT_ORG_EMAIL_DOMAINS = " other.com , whitelabel.lat ";
			const { result, inserted } = join("ana@whitelabel.lat");
			expect(await result).toBe("org1");
			expect(inserted).toHaveLength(1);
		});

		it("matches case-insensitively", async () => {
			env.CAP_DEFAULT_ORG_EMAIL_DOMAINS = "WhiteLabel.LAT";
			const { result, inserted } = join("Ana@WHITELABEL.lat");
			expect(await result).toBe("org1");
			expect(inserted).toHaveLength(1);
		});

		it.each([
			["non-matching domain", "ana@gmail.com"],
			["lookalike suffix", "ana@whitelabel.lat.evil.com"],
			["lookalike prefix", "ana@evilwhitelabel.lat"],
			["subdomain", "ana@mail.whitelabel.lat"],
			["domain only in local part", "whitelabel.lat@evil.com"],
			["no @", "whitelabel.lat"],
			["empty local part", "@whitelabel.lat"],
			["empty string", ""],
			["null", null],
			["undefined", undefined],
		])("does not join on %s", async (_label, email) => {
			const { result, inserted, updated } = join(email);
			expect(await result).toBeNull();
			expect(inserted).toHaveLength(0);
			expect(updated).toHaveLength(0);
		});

		it.each([
			["unset", undefined],
			["empty", ""],
			["only separators", " , ,"],
		])("fails closed when the list is %s", async (_label, domains) => {
			env.CAP_DEFAULT_ORG_EMAIL_DOMAINS = domains;
			const { result, inserted, updated } = join("ana@whitelabel.lat");
			expect(await result).toBeNull();
			expect(inserted).toHaveLength(0);
			expect(updated).toHaveLength(0);
		});
	});
});
