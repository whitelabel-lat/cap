// whitelabel fork: single-organization mode.
import { serverEnv } from "@cap/env";
import type { Organisation, User } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { nanoId } from "../helpers.ts";
import { organizationMembers, organizations, users } from "../schema.ts";

type Executor = Pick<MySql2Database, "select" | "insert" | "update">;

/**
 * True only when the email's domain (text after the last "@", exact match,
 * case-insensitive) is in the comma-separated list. An unset or empty list
 * matches nobody (fail closed).
 */
export function isDefaultOrgEmailDomain(
	email: string | null | undefined,
	domainList: string | null | undefined,
): boolean {
	if (!email || !domainList) return false;
	const domains = domainList
		.split(",")
		.map((d) => d.trim().toLowerCase())
		.filter(Boolean);
	if (domains.length === 0) return false;
	const at = email.lastIndexOf("@");
	if (at <= 0) return false;
	const domain = email
		.slice(at + 1)
		.trim()
		.toLowerCase();
	return domain.length > 0 && domains.includes(domain);
}

/**
 * If CAP_DEFAULT_ORG_ID is set, that organization exists and the user's email
 * domain is listed in CAP_DEFAULT_ORG_EMAIL_DOMAINS, makes the user a member
 * (role CAP_DEFAULT_ORG_ROLE) and points activeOrganizationId / defaultOrgId at
 * it. Returns the org id, or null when the caller should fall back to upstream
 * behaviour (personal organization). Only for brand-new users: never call it
 * for an existing user who lost their memberships (they were removed on
 * purpose and must not regain access).
 */
export async function joinDefaultOrganization(
	tx: Executor,
	userId: User.UserId,
	email: string | null | undefined,
): Promise<Organisation.OrganisationId | null> {
	const {
		CAP_DEFAULT_ORG_ID,
		CAP_DEFAULT_ORG_ROLE,
		CAP_DEFAULT_ORG_EMAIL_DOMAINS,
	} = serverEnv();
	if (!CAP_DEFAULT_ORG_ID) return null;
	if (!isDefaultOrgEmailDomain(email, CAP_DEFAULT_ORG_EMAIL_DOMAINS))
		return null;

	const [organization] = await tx
		.select({ id: organizations.id, tombstoneAt: organizations.tombstoneAt })
		.from(organizations)
		.where(
			eq(organizations.id, CAP_DEFAULT_ORG_ID as Organisation.OrganisationId),
		)
		.limit(1);
	if (!organization || organization.tombstoneAt) return null;

	await tx.insert(organizationMembers).values({
		id: nanoId(),
		organizationId: organization.id,
		userId,
		role: CAP_DEFAULT_ORG_ROLE,
	});
	await tx
		.update(users)
		.set({
			activeOrganizationId: organization.id,
			defaultOrgId: organization.id,
		})
		.where(eq(users.id, userId));

	return organization.id;
}
