-- whitelabel fork: fusiona las organizaciones personales en una sola.
--
-- Decisiones:
--   * Organizacion unica = Whitelabel (p1m68fg1fs7n0a9); Pedro sigue de owner.
--   * Todos los demas usuarios pasan a `admin` de esa organizacion.
--   * Todos los videos de las organizaciones viejas pasan a la nueva y se comparten
--     con ella (shared_videos). Conservan id y flag `public`.
--   * La organizacion nueva queda con defaultVideoVisibility = 'private'.
--   * Las organizaciones viejas (y sus miembros/invitaciones) se borran al final.
--
-- Requisitos: ejecutar DESPUES de que la imagen nueva haya aplicado las migraciones
-- (0011-0049). Idempotente: una segunda ejecucion no cambia nada. Todo corre en una
-- transaccion dentro de un procedimiento temporal; ante cualquier error hace ROLLBACK.
--
-- Uso:
--   mysql -uroot -p planetscale < scripts/whitelabel/merge-orgs.sql
-- Para otros ids, cambiar las dos variables @wl_* de abajo.

SET @wl_target = 'p1m68fg1fs7n0a9';
-- Organizaciones a absorber (lista separada por comas, sin espacios).
SET @wl_old = '93g7s7e2k54rrqd,bpz3pzhg4k7r1z4,kr10dfc3hzd6rw3';
SET @wl_role = 'admin';

DROP PROCEDURE IF EXISTS wl_merge_orgs;

DELIMITER //
CREATE PROCEDURE wl_merge_orgs()
BEGIN
	DECLARE v_done INT DEFAULT 0;
	DECLARE v_tbl VARCHAR(128);
	DECLARE v_col VARCHAR(128);
	DECLARE v_pending BIGINT DEFAULT 0;
	DECLARE v_msg VARCHAR(255);
	DECLARE cur CURSOR FOR
		SELECT TABLE_NAME, COLUMN_NAME
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
			AND COLUMN_NAME IN ('organizationId', 'orgId', 'activeOrganizationId', 'defaultOrgId')
			AND TABLE_NAME <> 'organizations';
	DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
	DECLARE EXIT HANDLER FOR SQLEXCEPTION
	BEGIN
		ROLLBACK;
		RESIGNAL;
	END;

	START TRANSACTION;

	-- 0. La organizacion destino debe existir y estar viva.
	IF NOT EXISTS (
		SELECT 1 FROM organizations WHERE id = @wl_target AND tombstoneAt IS NULL
	) THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'wl: la organizacion destino no existe';
	END IF;

	-- 1. Todos los usuarios son miembros del destino (el owner conserva su rol).
	INSERT INTO organization_members (id, userId, organizationId, role, hasProSeat)
	SELECT SUBSTRING(LOWER(HEX(RANDOM_BYTES(8))), 1, 15), u.id, @wl_target, @wl_role, 0
	FROM users u
	WHERE NOT EXISTS (
		SELECT 1 FROM organization_members m
		WHERE m.userId = u.id AND m.organizationId = @wl_target
	);

	UPDATE organization_members m
	JOIN organizations o ON o.id = m.organizationId
	SET m.role = @wl_role
	WHERE m.organizationId = @wl_target
		AND m.userId <> o.ownerId
		AND m.role = 'member';

	-- 2. Organizacion activa / por defecto de todos los usuarios.
	UPDATE users
	SET activeOrganizationId = @wl_target, defaultOrgId = @wl_target
	WHERE activeOrganizationId IS NULL
		OR activeOrganizationId <> @wl_target
		OR defaultOrgId IS NULL
		OR defaultOrgId <> @wl_target;

	-- 3. Videos a la organizacion nueva.
	UPDATE videos SET orgId = @wl_target WHERE FIND_IN_SET(orgId, @wl_old);

	-- 4. Compartir todos los videos con la organizacion (idempotente).
	INSERT INTO shared_videos (id, videoId, organizationId, sharedByUserId)
	SELECT SUBSTRING(LOWER(HEX(RANDOM_BYTES(8))), 1, 15), v.id, @wl_target, v.ownerId
	FROM videos v
	WHERE v.orgId = @wl_target
		AND NOT EXISTS (
			SELECT 1 FROM shared_videos s
			WHERE s.videoId = v.id AND s.organizationId = @wl_target
		);
	DELETE FROM shared_videos WHERE FIND_IN_SET(organizationId, @wl_old);

	-- 5. Resto de tablas con referencia a la organizacion.
	UPDATE folders SET organizationId = @wl_target WHERE FIND_IN_SET(organizationId, @wl_old);
	UPDATE spaces SET organizationId = @wl_target WHERE FIND_IN_SET(organizationId, @wl_old);
	UPDATE notifications SET orgId = @wl_target WHERE FIND_IN_SET(orgId, @wl_old);
	UPDATE imported_videos SET orgId = @wl_target WHERE FIND_IN_SET(orgId, @wl_old);
	UPDATE s3_buckets SET organizationId = @wl_target WHERE FIND_IN_SET(organizationId, @wl_old);
	UPDATE storage_integrations SET organizationId = @wl_target WHERE FIND_IN_SET(organizationId, @wl_old);
	UPDATE integration_installations SET organizationId = @wl_target WHERE FIND_IN_SET(organizationId, @wl_old);
	DELETE FROM organization_invites WHERE FIND_IN_SET(organizationId, @wl_old);
	DELETE FROM organization_sso WHERE FIND_IN_SET(organizationId, @wl_old);
	DELETE FROM signed_baas WHERE FIND_IN_SET(organizationId, @wl_old);

	-- 6. Videos privados por defecto en la organizacion unica.
	UPDATE organizations SET defaultVideoVisibility = 'private' WHERE id = @wl_target;

	-- 7. Miembros de las organizaciones viejas.
	DELETE FROM organization_members WHERE FIND_IN_SET(organizationId, @wl_old);

	-- 8. Red de seguridad: ninguna tabla puede seguir apuntando a una organizacion vieja.
	OPEN cur;
	chk: LOOP
		FETCH cur INTO v_tbl, v_col;
		IF v_done = 1 THEN LEAVE chk; END IF;
		SET @wl_sql = CONCAT(
			'SELECT COUNT(*) INTO @wl_cnt FROM `', v_tbl, '` WHERE FIND_IN_SET(`', v_col, '`, @wl_old)'
		);
		PREPARE wl_stmt FROM @wl_sql;
		EXECUTE wl_stmt;
		DEALLOCATE PREPARE wl_stmt;
		IF @wl_cnt > 0 THEN
			SET v_pending = v_pending + @wl_cnt;
			SET v_msg = CONCAT('wl: ', v_tbl, '.', v_col, ' aun referencia organizaciones viejas');
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
		END IF;
	END LOOP;
	CLOSE cur;

	-- 9. Borrar las organizaciones viejas.
	DELETE FROM organizations WHERE FIND_IN_SET(id, @wl_old);

	COMMIT;
END//
DELIMITER ;

CALL wl_merge_orgs();
DROP PROCEDURE wl_merge_orgs;

-- Resumen (debe dar: orgs 1, members 4, videos 14, shared_videos 14 en el caso actual).
SELECT
	(SELECT COUNT(*) FROM organizations) AS organizations,
	(SELECT COUNT(*) FROM organization_members) AS organization_members,
	(SELECT COUNT(*) FROM videos) AS videos,
	(SELECT COUNT(*) FROM shared_videos) AS shared_videos,
	(SELECT COUNT(*) FROM users) AS users;
