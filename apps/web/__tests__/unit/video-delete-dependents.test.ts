import * as Db from "@cap/database/schema";
import { Video } from "@cap/web-domain";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

// whitelabel fork: upstream VideosRepo.delete only removed the video, its
// upload row, its imported row and its processing job, leaving shared_videos
// (every video has one with CAP_AUTO_SHARE_TO_ORG), space_videos, comments,
// notifications and video_edits behind. These tests pin the same cleanup set
// that upstream already applies in the agent delete operation and in the
// API v1 rejected-upload delete.

const mocks = vi.hoisted(() => ({ database: vi.fn() }));

vi.mock("@cap/database", () => ({ db: mocks.database }));
vi.mock("@cap/database/auto-share", () => ({
	autoShareVideoToOrg: async () => false,
}));

import { VideosRepo } from "@cap/web-backend/src/Videos/VideosRepo";

const videoId = Video.VideoId.make("video-to-delete");

type Deletion = { table: unknown; id: unknown; inTransaction: boolean };

function databaseFixture() {
	const deletions: Deletion[] = [];
	const idFrom = (condition: SQL) =>
		new MySqlDialect().sqlToQuery(condition).params[0];
	const handle = (inTransaction: boolean) => ({
		select: () => ({
			from: () => ({
				where: () => ({ for: async () => [{ ownerId: "owner" }] }),
			}),
		}),
		delete: (table: unknown) => ({
			where: async (condition: SQL) => {
				deletions.push({ table, id: idFrom(condition), inTransaction });
				return [{ affectedRows: 1 }];
			},
		}),
	});
	const client = {
		...handle(false),
		transaction: async (
			operation: (tx: ReturnType<typeof handle>) => Promise<unknown>,
		) => operation(handle(true)),
	};
	mocks.database.mockReturnValue(client);
	return { deletions };
}

const runDelete = () =>
	Effect.runPromise(
		Effect.flatMap(VideosRepo, (repo) => repo.delete(videoId)).pipe(
			Effect.provide(VideosRepo.Default),
		),
	);

describe("VideosRepo.delete dependent rows (whitelabel fork)", () => {
	beforeEach(() => {
		mocks.database.mockReset();
	});

	it.each([
		["shared_videos", Db.sharedVideos],
		["space_videos", Db.spaceVideos],
		["comments", Db.comments],
		["notifications", Db.notifications],
		["video_edits", Db.videoEdits],
	])(
		"deletes %s rows of the video inside the transaction",
		async (_name, table) => {
			const { deletions } = databaseFixture();

			await runDelete();

			expect(deletions).toContainEqual({
				table,
				id: videoId,
				inTransaction: true,
			});
		},
	);

	it("still deletes the video, its upload, import and processing job", async () => {
		const { deletions } = databaseFixture();

		await runDelete();

		const tables = deletions.map((deletion) => deletion.table);
		for (const table of [
			Db.videos,
			Db.videoUploads,
			Db.importedVideos,
			Db.videoProcessingJobs,
		]) {
			expect(tables).toContain(table);
		}
		expect(deletions.every((deletion) => deletion.inTransaction)).toBe(true);
	});
});
