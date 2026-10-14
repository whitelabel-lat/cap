-- whitelabel fork: clear finished uploads left behind by old Cap versions.
--
-- Old web uploads kept their `video_uploads` row after the upload ended
-- (uploaded = total, phase 'uploading', mode NULL). Current Cap treats any row
-- as an upload in progress, so the share page, get-status and transcribeVideo
-- never start transcription/AI for those videos. The player already treats
-- them as finished (ProgressCircle: uploaded >= total).
--
-- Same effect as the desktop progress route when it receives uploaded = total.
-- Idempotent. Only touches rows untouched for more than a day.
-- Check first that each video has its result.mp4 in the bucket.
--
-- Usage: mysql -uroot -p planetscale < scripts/whitelabel/clear-stale-uploads.sql

START TRANSACTION;

SELECT video_id, uploaded, total, updated_at
FROM video_uploads
WHERE phase = 'uploading'
  AND mode IS NULL
  AND raw_file_key IS NULL
  AND total > 0
  AND uploaded >= total
  AND updated_at < NOW() - INTERVAL 1 DAY;

DELETE FROM video_uploads
WHERE phase = 'uploading'
  AND mode IS NULL
  AND raw_file_key IS NULL
  AND total > 0
  AND uploaded >= total
  AND updated_at < NOW() - INTERVAL 1 DAY;

SELECT ROW_COUNT() AS deleted;

COMMIT;
