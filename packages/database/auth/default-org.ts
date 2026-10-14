// whitelabel fork: single-organization mode.
import { serverEnv } from "@cap/env";
import type { Organisation, User } from "@cap/web-domain";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { nanoId } from "../helpers.ts";
import { organizationMembers, organizations, users } from "../schema.ts";

type Executor = Pick<MySql2Database, "select" | "insert" | "update">;

/**
 * If CAP_DEFAULT_ORG_ID is set and that organization exists, makes the user a
 * member (role CAP_DEFAULT_ORG_ROLE) and points activeOrganizationId /
 * defaultOrgId at it. Returns the org id, or null when the caller should fall
 * back to upstream behaviour (personal organization).
 */
export async function joinDefaultOrganization(
	tx: Executor,
	userId: User.UserId,
): Promise<Organisation.OrganisationId | null> {
	const { CAP_DEFAULT_ORG_ID, CAP_DEFAULT_ORG_ROLE } = serverEnv();
	if (!CAP_DEFAULT_ORG_ID) return null;

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
