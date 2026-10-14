// whitelabel fork: auto-share new videos with their organization.
import { serverEnv } from "@cap/env";
import type { Organisation, User, Video } from "@cap/web-domain";
import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { nanoId } from "./helpers.ts";
import { sharedVideos } from "./schema.ts";

type Executor = Pick<MySql2Database, "select" | "insert">;

/**
 * When CAP_AUTO_SHARE_TO_ORG=true, makes sure a shared_videos row exists for
 * (videoId, orgId). Idempotent. Call right after inserting a video row, with
 * the same transaction when there is one. Returns true if a row was inserted.
 */
export async function autoShareVideoToOrg(
	db: Executor,
	args: {
		videoId: Video.VideoId;
		orgId: Organisation.OrganisationId;
		ownerId: User.UserId;
	},
): Promise<boolean> {
	if (!serverEnv().CAP_AUTO_SHARE_TO_ORG) return false;

	const [existing] = await db
		.select({ id: sharedVideos.id })
		.from(sharedVideos)
		.where(
			and(
				eq(sharedVideos.videoId, args.videoId),
				eq(sharedVideos.organizationId, args.orgId),
			),
		)
		.limit(1);
	if (existing) return false;

	await db.insert(sharedVideos).values({
		id: nanoId(),
		videoId: args.videoId,
		organizationId: args.orgId,
		sharedByUserId: args.ownerId,
	});
	return true;
}
