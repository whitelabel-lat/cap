-- whitelabel fork: delete rows left behind by deleted videos.
--
-- Upstream VideosRepo.delete did not remove shared_videos, space_videos,
-- comments or notifications of the deleted video. With CAP_AUTO_SHARE_TO_ORG
-- every video has a shared_videos row, so every delete left an orphan. The fork
-- now deletes them in the same transaction; this script cleans what was left
-- before that fix. video_edits and video_viewer_grants have ON DELETE CASCADE
-- foreign keys and never keep orphans.
--
-- Idempotent: only rows whose video no longer exists. A second run deletes 0.
--
-- Usage: mysql -uroot -p planetscale < scripts/whitelabel/clean-orphan-shares.sql

START TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM shared_videos s
     WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = s.videoId)) AS orphan_shared_videos,
  (SELECT COUNT(*) FROM space_videos s
     WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = s.videoId)) AS orphan_space_videos,
  (SELECT COUNT(*) FROM comments c
     WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = c.videoId)) AS orphan_comments,
  (SELECT COUNT(*) FROM notifications n
     WHERE n.videoId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = n.videoId)) AS orphan_notifications;

DELETE s FROM shared_videos s
WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = s.videoId);
SELECT ROW_COUNT() AS deleted_shared_videos;

DELETE s FROM space_videos s
WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = s.videoId);
SELECT ROW_COUNT() AS deleted_space_videos;

DELETE c FROM comments c
WHERE NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = c.videoId);
SELECT ROW_COUNT() AS deleted_comments;

DELETE n FROM notifications n
WHERE n.videoId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM videos v WHERE v.id = n.videoId);
SELECT ROW_COUNT() AS deleted_notifications;

COMMIT;
