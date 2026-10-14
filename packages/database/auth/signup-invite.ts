// whitelabel fork: with CAP_ALLOWED_SIGNUP_DOMAINS set, only people invited by
// an allowlisted user may get an account from another domain.
import { serverEnv } from "@cap/env";
import type { User } from "@cap/web-domain";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { organizationInvites, users, videoViewerGrants } from "../schema.ts";
import { isEmailAllowedForSignup } from "./domain-utils.ts";

type Executor = Pick<MySql2Database, "select">;

// Invites and grants per email are few; this only bounds a pathological case.
const MAX_INVITES_CHECKED = 50;

export class SignupNotAllowedError extends Error {
	constructor(email: string) {
		super(`Signup is not allowed for ${email}`);
		this.name = "SignupNotAllowedError";
	}
}

function isAllowlisted(email: string | null | undefined, allowed?: string) {
	return !!email && isEmailAllowedForSignup(email, allowed);
}

/**
 * True when the email holds a pending, unexpired organization invite or an
 * active (not revoked) video viewer grant whose inviter's email is in
 * `allowedDomains`. Invite and grant emails are stored trimmed and lowercased
 * and the column collation is case-insensitive, so a plain equality uses the
 * index. With no allowlist every invite counts.
 */
export async function hasPendingSignupInvite(
	db: Executor,
	email: string | null | undefined,
	allowedDomains: string | undefined,
): Promise<boolean> {
	const normalized = email?.trim().toLowerCase();
	if (!normalized || normalized.lastIndexOf("@") <= 0) return false;

	const invites = await db
		.select({ inviterEmail: users.email })
		.from(organizationInvites)
		.innerJoin(users, eq(users.id, organizationInvites.invitedByUserId))
		.where(
			and(
				eq(organizationInvites.invitedEmail, normalized),
				eq(organizationInvites.status, "pending"),
				or(
					isNull(organizationInvites.expiresAt),
					gt(organizationInvites.expiresAt, new Date()),
				),
			),
		)
		.limit(MAX_INVITES_CHECKED);
	if (invites.some((row) => isAllowlisted(row.inviterEmail, allowedDomains)))
		return true;

	const grants = await db
		.select({ inviterEmail: users.email })
		.from(videoViewerGrants)
		.innerJoin(users, eq(users.id, videoViewerGrants.invitedByUserId))
		.where(
			and(
				eq(videoViewerGrants.email, normalized),
				isNull(videoViewerGrants.revokedAt),
			),
		)
		.limit(MAX_INVITES_CHECKED);
	return grants.some((row) => isAllowlisted(row.inviterEmail, allowedDomains));
}

/**
 * Guard for every path that creates a users row on someone else's behalf
 * (organization provisioning, Loom import). With CAP_ALLOWED_SIGNUP_DOMAINS
 * set, an email outside the allowlist may only be provisioned by an actor
 * whose own email is allowlisted. Throws SignupNotAllowedError otherwise.
 */
export async function assertMayProvisionUser(
	db: Executor,
	{ email, actorUserId }: { email: string; actorUserId: User.UserId },
	allowedDomains: string | undefined = serverEnv().CAP_ALLOWED_SIGNUP_DOMAINS,
): Promise<void> {
	if (!allowedDomains?.trim()) return;
	if (isAllowlisted(email.trim().toLowerCase(), allowedDomains)) return;

	const [actor] = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, actorUserId))
		.limit(1);
	if (!isAllowlisted(actor?.email, allowedDomains)) {
		throw new SignupNotAllowedError(email);
	}
}
