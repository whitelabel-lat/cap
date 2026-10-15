# Cap Whitelabel: fork y despliegue

Estado al 2026-10-14 (fase 2 hecha: desplegado en Dokploy `vanguardistas`, ver "Producción"; workflows, transcripción e IA funcionando; crons de recuperación activos, miniaturas y GIF de los videos viejos generados, borrado de videos sin filas huérfanas).

## Qué es este repo

- Fork de `CapSoftware/Cap` en `github.com/whitelabel-lat/cap`.
- Remotos: `origin` = el fork, `upstream` = `CapSoftware/Cap`.
- Rama de despliegue: `main`. Base: upstream `main` en `f6164c19b9` (merge de #2531) + nuestros commits.
- Es el Cap autoalojado (cap-web + media-server + MySQL + S3). La app de escritorio apunta a nuestro servidor (Settings > Cap Server URL).
- **AGPLv3**: si ofrecemos el servicio por red a otros usuarios, debemos ofrecerles el código fuente de la versión que corremos, incluidos nuestros cambios. Este fork público en GitHub cumple esa obligación: mantener `main` publicado y al día con lo desplegado, y no quitar los avisos de licencia ni el enlace al código. No hay que hacer nada más mientras el fork sea público.
- Marcamos nuestros cambios con el comentario `// whitelabel fork:` para localizarlos en cada merge (`git grep "whitelabel fork"`).

## Qué cambiamos sobre upstream

Objetivo: una sola organización para todo el equipo, todos los videos visibles para todos, nada público por defecto.

| Cambio | Dónde | Cómo se activa |
|---|---|---|
| Los usuarios nuevos con correo de un dominio permitido entran a una organización existente en vez de crearse una propia | `packages/database/auth/default-org.ts` (usado solo en `auth/drizzle-adapter.ts` `createUser`) | `CAP_DEFAULT_ORG_ID`, `CAP_DEFAULT_ORG_ROLE`, `CAP_DEFAULT_ORG_EMAIL_DOMAINS` |
| Cada video nuevo se comparte con su organización (fila en `shared_videos`) | `packages/database/auto-share.ts`, llamado tras cada inserción en `videos` | `CAP_AUTO_SHARE_TO_ORG=true` |
| Videos privados por defecto | sin código nuestro: `CAP_VIDEOS_DEFAULT_PUBLIC=false` (y `organizations.defaultVideoVisibility='private'`, lo fija el script de fusión) | variable de entorno |
| Script que fusiona las organizaciones personales ya existentes | `scripts/whitelabel/merge-orgs.sql` | manual, una vez (ver abajo) |
| Directorio de datos de Workflow DevKit escribible en la imagen (`/app/.workflow-data`, dueño `nextjs`) | `apps/web/Dockerfile` (test `__tests__/unit/dockerfile-workflow-data.test.ts`) | siempre; en producción además va en un volumen |
| Script que borra filas viejas de `video_uploads` de subidas ya terminadas | `scripts/whitelabel/clear-stale-uploads.sql` | manual, una vez (ver trampas) |
| Servicio de crons: llama a `/api/cron/*` de cap-web con `CRON_SECRET` en el horario de `vercel.json` (en Vercel lo hace la plataforma) | `scripts/whitelabel/cron/` (`Dockerfile` alpine + supercronic, `crontab`, `cap-cron.sh`); test `__tests__/unit/whitelabel-cron-service.test.ts` | servicio `loom-cron-tyvzw2` en Dokploy (ver "Crons") |
| Borrar un video borra también sus filas en `shared_videos`, `space_videos`, `comments`, `notifications` y `video_edits` (upstream solo borraba video, subida, importado y job) | `packages/web-backend/src/Videos/VideosRepo.ts` (`delete_`); test `__tests__/unit/video-delete-dependents.test.ts` | siempre |
| Script que borra filas huérfanas de videos ya borrados | `scripts/whitelabel/clean-orphan-shares.sql` | manual, idempotente |
| Script que genera la miniatura y el GIF de videos que nunca pasaron por el media-server, sin tocar `result.mp4` ni la base | `scripts/whitelabel/regenerate-previews.mjs` | manual (ver "Miniaturas y GIF de videos viejos") |
| Marca Zellia Clips (nombre, logos, favicons, OG, emails, colores, tipografía) | Ver "Marca (Zellia Clips)" | siempre |

Detalles:

- `joinDefaultOrganization(tx, userId, email)` inserta en `organization_members` (id de 15 caracteres, mismo alfabeto que `nanoId`) y fija `users.activeOrganizationId` y `defaultOrgId`. Solo lo hace si el dominio del correo (lo que va tras la última `@`, sin distinguir mayúsculas, coincidencia exacta: `mail.whitelabel.lat`, `whitelabel.lat.evil.com` o `evilwhitelabel.lat` no valen) está en `CAP_DEFAULT_ORG_EMAIL_DOMAINS`. Si esa lista está vacía o sin definir no entra nadie (falla cerrado). Si `CAP_DEFAULT_ORG_ID` no está, la organización no existe (o está en `tombstoneAt`) o el dominio no está en la lista, devuelve `null` y se aplica el comportamiento de upstream (organización personal "My Organization").
- Solo se llama al crear un usuario nuevo. La ruta de escritorio `/api/desktop/video/create`, cuando el usuario no tiene ninguna organización, crea una organización personal como upstream y **no** vuelve a unirlo a la compartida.
- No se toca: usuarios invitados (`pendingInvite`) ni SSO, que siguen su flujo; la creación manual de organizaciones por un usuario; `provisionOrganizationInvitee`.
- `autoShareVideoToOrg` es idempotente (consulta antes de insertar) y usa la misma transacción cuando existe. Sitios cubiertos: grabación desktop (`/api/desktop/video/create`), `createInstantRecording` y duplicados (`VideosRepo.create`), subida web (`actions/video/upload.ts`, `create-for-processing.ts`), importación Loom (`actions/loom.ts`, v1 y mobile), subida vía API v1 y duplicado de operaciones de agente. Al añadir un sitio nuevo que haga `insert(videos)` en un merge de upstream, hay que llamar al helper.
- La app de escritorio guarda el `orgId` viejo y lo sigue mandando. `/api/desktop/video/create` ya lo ignora si no existe (cae a la organización por defecto del usuario), verificado en local tras borrar las organizaciones viejas.
- El onboarding no renombra la organización compartida: solo el owner puede editarla.
- Borrado de videos: todas las rutas de la UI, escritorio, extensión y RPC pasan por `Videos.delete` → `VideosRepo.delete`, que ahora borra el mismo conjunto de filas que upstream ya borra en la operación de agente (`deleteCapDatabase` en `workflows/agent-cap-operation.ts`) y en la API v1. El borrado de organizaciones (`Organisations/index.ts`) ya limpiaba `shared_videos`. No hay borrado de usuarios en la web. `video_edits` y `video_viewer_grants` tienen FK `ON DELETE CASCADE` en la base.
- Tests nuevos: `apps/web/__tests__/unit/default-organization.test.ts`, `auto-share-video.test.ts`. `recording-storage-lifecycle.test.ts` mockea `@cap/database/auto-share` (su `serverEnv()` no está disponible en ese test).

## Marca (Zellia Clips)

El producto se muestra como **Zellia Clips** (marca Zellia). Todo el cambio de marca está centralizado; no hay capa i18n en `apps/web`, así que solo se tocaron las superficies visibles para el usuario (video, embed, colecciones, dashboard, login, emails). Quedaron con "Cap" a propósito: apps de escritorio/móvil/extensión/CLI (siguen siendo "Cap"), páginas de marketing `(site)`, `(docs)` y blog, textos legales/BAA/HIPAA y los remitentes de Cap cloud (`NEXT_PUBLIC_IS_CAP`).

| Qué | Dónde |
|---|---|
| Nombre, descripción, colores, rutas de logos, URL del código fuente (AGPL) | `packages/utils/src/brand.ts` (`@cap/utils/brand`); `brandAssetUrl()` arma URLs absolutas |
| Trazos SVG del logo (generado, no editar a mano) | `packages/utils/src/brand-shapes.ts` |
| Componentes de logo (mantienen props: `white`, `hideLogoName`) | `packages/ui/src/components/icons/Logo.tsx`, `LogoBadge.tsx`, `LogoSpinner.tsx` (el spinner anima el anillo y respeta `prefers-reduced-motion`; los usos ya no llevan `animate-spin`) |
| Favicons (isotipo sobre baldosa blanca redondeada, legible en pestañas oscuras), PWA, apple-touch, mstile, safari-pinned-tab, `og.png`, `logos/zellia/*`, `site.webmanifest`, `browserconfig.xml` | `apps/web/public/` |
| Metadata (título con plantilla `%s \| Zellia Clips`, descripción en español, `metadataBase` desde `NEXT_PUBLIC_WEB_URL`/`WEB_URL`) y tipografía Inter (`public/fonts/Inter-Variable-latin.woff2`) | `apps/web/app/layout.tsx` |
| Imágenes OG dinámicas (`/api/og`, tarjeta por video) y miniatura sin imagen (isotipo sobre azul Zellia) | `apps/web/lib/og/`, `components/VideoThumbnail.tsx`; fuente Inter TTF en `lib/og/fonts/` |
| Emails (logo PNG absoluto desde `WEB_URL`, textos) | `packages/database/emails/` (`emailLogoUrl()` en `brand.ts`) |
| Tokens | `apps/web/app/globals.css` (`--primary` #023562, `--secondary` #5799BA, `--blue-1..12` claro y oscuro derivados de la escala primaria de Zellia; HSL de shadcn `--primary`/`--ring`) y `packages/ui/style/tailwind.config.js` (`blue-50..950` y escala `accent` #FC4501; `accent` sin número sigue siendo el fondo de hover de shadcn) |
| Enlace "Código fuente" (obligación AGPL) | pie de la barra lateral (`Navbar/Items.tsx`) |
| Test guardián | `apps/web/__tests__/unit/zellia-brand.test.ts` (falla si reaparece "cap.so", "Powered by Cap" o el azul viejo en los archivos clave) |

Los assets públicos (logos, iconos, manifest, fuentes) deben pasar el redirect a `/login` del proxy: la lista está en `apps/web/lib/public-static-assets.ts` (test `proxy-public-assets.test.ts`); un archivo nuevo en `public/` que deba verse sin sesión (por ejemplo desde un correo) hay que añadirlo ahí. `metadataBase` sale de `WEB_URL` en tiempo de petición; las rutas estáticas lo fijan en el build (con la URL que tenga el build), y el título con plantilla `| Zellia Clips` solo aplica a las rutas de `(org)`.

Regenerar los assets (requiere `google-chrome` y `ffmpeg`): `node scripts/whitelabel/brand/build-brand.mjs`. Las fuentes son los SVG originales de Zellia copiados en `scripts/whitelabel/brand/src/` (viewBox recortado al dibujo). El script reescribe los SVG, los PNG/ICO, `brand-shapes.ts` y `og.png`.

Contraste (AA): botón `blue-9` + texto blanco, 13:1 (claro) y 6,6:1 (oscuro, `#2B5F94`); texto `blue-11` sobre blanco 8:1 y sobre `blue-3` 7:1 (claro), `#8FB4DE` sobre fondo oscuro 8:1.
Al hacer merge de upstream: buscar `git grep "whitelabel fork"` y revisar `globals.css`, `layout.tsx`, los tres componentes de logo y `lib/og/template.tsx` (ahí upstream puede reintroducir las maquetas de Cap).

## Variables de entorno

Nuevas (todas opcionales):

| Variable | Valor en producción | Efecto |
|---|---|---|
| `CAP_DEFAULT_ORG_ID` | `p1m68fg1fs7n0a9` | Organización a la que entra todo usuario nuevo de un dominio de `CAP_DEFAULT_ORG_EMAIL_DOMAINS` |
| `CAP_DEFAULT_ORG_ROLE` | `admin` | Rol del usuario nuevo (`member` o `admin`; por defecto `member`) |
| `CAP_DEFAULT_ORG_EMAIL_DOMAINS` | `whitelabel.lat` | Dominios de correo (separados por comas) que entran solos a `CAP_DEFAULT_ORG_ID`. Vacía o sin definir = nadie entra solo |
| `CAP_AUTO_SHARE_TO_ORG` | `true` | Comparte cada video nuevo con su organización |
| `CAP_VIDEOS_DEFAULT_PUBLIC` | `false` | Videos nuevos privados (upstream: `true`) |
| `CAP_ALLOWED_SIGNUP_DOMAINS` | `whitelabel.lat` | Solo estos dominios pueden crear una cuenta nueva. Excepción: un correo externo puede registrarse si tiene una invitación pendiente a una organización (`organization_invites`, `status='pending'`, sin vencer) o una invitación de espectador de video activa (`video_viewer_grants`, sin revocar), **y solo si quien invitó (`invitedByUserId`) tiene un correo de un dominio permitido**: una invitación hecha por un externo no cuenta. Igual para crear cuentas por otros (`provisionOrganizationInvitee`: invitaciones sin correo, importación CSV de Loom, owner de importación Loom en la API v1): un correo fuera de la lista solo se crea si quien actúa es de un dominio permitido. Los usuarios existentes siempre pueden entrar y `CAP_BLOCKED_SIGNUP_DOMAINS` sigue ganando. Un externo invitado no entra a la organización por defecto (solo `CAP_DEFAULT_ORG_EMAIL_DOMAINS`): entra a la que lo invitó. Lógica en `packages/database/auth/signup-invite.ts`, usada en el callback `signIn` y en la ruta móvil. Sin definir = registro abierto |
| `CAP_SIGNUP_REQUEST_NOTIFY_EMAIL` | `hola@whitelabel.lat` | Correo del equipo que recibe "Solicitud de acceso a Zellia Clips: <correo>" cuando `CAP_ALLOWED_SIGNUP_DOMAINS` rechaza a una persona nueva (sin invitación). Sin definir = no se avisa al equipo (la persona igual recibe su confirmación). El correo incluye quién (correo y nombre si el proveedor lo da), cuándo (hora de Bogotá), método (Google / código por email / Apple / app móvil) y un botón a `/dashboard/settings/organization/members`. A la persona se le envía "Recibimos tu solicitud de acceso" (sin enlaces). En la web el callback `signIn` redirige a `/login?error=SignupRequestReceived` (mensaje en español en la página de login); en la ruta móvil responde 403 con `code: "SignupRequestReceived"` y mensaje. **No** aplica a `CAP_BLOCKED_SIGNUP_DOMAINS` (siguen en silencio). Anti-abuso (con código por email el callback corre antes de probar que el correo es suyo): máximo **un par de correos por dirección cada 24 h** y **20 pares por hora** en total; pasado el tope solo `console.warn`. El control está **en memoria** (`packages/database/auth/signup-request.ts`): válido porque hay una sola instancia web; un reinicio lo reinicia. Envío sin esperar (fire-and-forget): un fallo de Resend se registra y nunca cambia el rechazo. Hay que aprobar a alguien invitándolo desde Miembros |

`CRON_SECRET` no es nueva (la leen las rutas `/api/cron/*` de upstream), pero autoalojado hay que ponerla a mano: ver "Crons".

Las existentes que necesita producción están en la sección "Despliegue".

## Fusionar organizaciones existentes (una vez)

`scripts/whitelabel/merge-orgs.sql`:

1. Orgs destino y origen van en las variables `@wl_target` y `@wl_old` al inicio del script.
2. Hace todo en una transacción (procedimiento temporal) y es idempotente: todos los usuarios pasan a miembros de la organización destino (el owner conserva su rol, el resto `admin`), `activeOrganizationId`/`defaultOrgId` apuntan a ella, los videos de las organizaciones viejas se mueven y se comparten con la nueva (conservan id y `public`), folders/spaces/notificaciones/buckets/importados se reasignan, se borran invitaciones/SSO/BAA de las viejas, la nueva queda con `defaultVideoVisibility='private'` y por último se borran miembros y organizaciones viejas. Antes de borrar comprueba en `information_schema` que ninguna tabla con `organizationId`/`orgId`/`activeOrganizationId`/`defaultOrgId` siga apuntando a una vieja; si queda alguna, aborta con rollback.
3. **Ejecutar solo después de que la imagen nueva haya aplicado las migraciones 0011-0049** (arranca sola al iniciar cap-web).
4. Uso: `mysql -uroot -p planetscale < scripts/whitelabel/merge-orgs.sql`. Salida esperada con los datos actuales: 1 organización, 4 miembros, 14 videos, 14 shared_videos, 4 usuarios.

## Crons

En Vercel, `apps/web/vercel.json` llama a las rutas `/api/cron/*` con `Authorization: Bearer $CRON_SECRET` (la propia ruta lo comprueba; sin `CRON_SECRET` responden 500, con otro valor 401). Autoalojado lo hace el servicio `loom-cron-tyvzw2` (alpine + supercronic, usuario sin privilegios, UTC). `cap-cron.sh` pasa la cabecera a curl por stdin para que el secreto no salga en la lista de procesos y escribe en el log el JSON de respuesta y `HTTP <código>`.

| Ruta | Horario (UTC) | Qué hace | Programado |
|---|---|---|---|
| `/api/cron/recover-failed-video-processing` | `7,22,37,52 * * * *` | Reintenta procesados web/Loom fallidos por errores recuperables (servidor ocupado, workflow actualizado) y reinicia procesado, transcripción e IA atascados (>1 h, videos de <48 h). Borra reservas de presupuesto de procesado caducadas | Sí |
| `/api/cron/finalize-stale-desktop-segments` | `*/15 * * * *` | Finaliza grabaciones de escritorio por segmentos que quedaron a medias (>1 h) y revisa la salud de los trabajos de grabación; 503 si hay algo atascado | Sí |
| `/api/cron/cleanup-agent-api` | `17 3 * * *` | Borra códigos de autorización, claves y operaciones caducadas de la API de agentes y de MCP | Sí |
| `/api/cron/sync-loops` | `* * * * *` | Sincroniza contactos con Loops.so (marketing de Cap cloud) | No: no usamos Loops |
| `/api/cron/developer-storage` | (no está en `vercel.json`) | Cobra créditos diarios de almacenamiento de apps de desarrollador | No: facturación de Cap cloud |

Cambiar un horario o añadir una ruta: editar `scripts/whitelabel/cron/crontab`; el push redespliega el servicio. El test `whitelabel-cron-service.test.ts` falla si upstream añade una ruta a `vercel.json` que no esté programada ni excluida a propósito en el test.

Comprobar a mano (desde el servidor): `docker exec $(docker ps -q -f name=loom-cron-tyvzw2) cap-cron /api/cron/cleanup-agent-api`. Logs: `docker logs $(docker ps -q -f name=loom-cron-tyvzw2)`.

## Miniaturas y GIF de videos viejos

Los videos que vienen del stack viejo no pasaron por el media-server: no tenían `preview/animated-preview.gif` y algunos tampoco `screenshot/screen-capture.jpg`. Upstream los regenera con el panel de admin `/admin/reprocess-video` (workflow `admin-reprocess-video`), que aquí no sirve: solo existe en Cap cloud (`NEXT_PUBLIC_IS_CAP`, `MESSENGER_ADMIN_EMAIL`) y además re-codifica y reemplaza `result.mp4`.

`scripts/whitelabel/regenerate-previews.mjs` llama al mismo endpoint del media-server (`POST /video/process`) con las mismas claves de salida, pero con `remuxOnly`, la salida de video a una clave temporal que borra al final, sin webhook (no toca la base: ni estado, ni transcripción, ni IA) y sin sobrescribir una miniatura o un GIF que ya existan (salvo `--force`; respaldar antes). Se ejecuta dentro del contenedor de cap-web, que ya tiene las variables:

```bash
ssh vanguardistas 'C=$(docker ps -q -f name=loom-capweb-qcmdip); docker exec -i $C node --input-type=module - <ownerId>/<videoId> ...' < scripts/whitelabel/regenerate-previews.mjs
```

Escribe una línea JSON por video (`status: complete`, `thumbnail`/`preview: present`). Ejecutado el 2026-10-14 sobre los 13 videos con `result.mp4` (8 miniaturas y 13 GIF nuevos; `result.mp4` sin cambios). `0trhw7zz3p76n8k` no tiene objeto y no se puede regenerar.

## Actualizar desde upstream

```bash
git fetch upstream main
git merge upstream/main        # merge commit, nunca rebase de main (ya está publicado)
git grep "whitelabel fork"     # revisar que nuestros cambios sigan
```

1. Revisar migraciones nuevas: `git diff --name-status <base> upstream/main -- packages/database/migrations`. Son irreversibles en producción (MySQL no tiene DDL transaccional: una migración que falla a mitad deja el esquema a medias; ver trampas).
2. Revisar los `insert(videos)` nuevos (`git grep -nE "insert\((Db\.)?videos\)"`) y añadir `autoShareVideoToOrg`.
3. `cd apps/web && npx vitest run` (3.4k tests, ~45 s; requiere `bun install` en la raíz).
4. Construir y probar la imagen con una copia de los datos reales (abajo), respaldo, push.

## Probar antes de subir

1. `docker build -f apps/web/Dockerfile -t cap-web:wl-test .` (contexto = raíz del repo; sin build args; ~3 min en local con caché de bun).
2. Copia de los datos reales a `/tmp` (nunca commitear ni subir): `mysqldump --single-transaction --routines --triggers planetscale` y el directorio del volumen de MinIO. Secretos solo por variables de shell o `/dev/shm`.
3. MySQL local **con los mismos ajustes que producción** (`mysql:8.0`, collation por defecto `utf8mb4_0900_ai_ci`). Con `--collation-server=utf8mb4_unicode_ci` la migración 0011+ falla (FK `videos.storageIntegrationId` incompatible).
4. Sin `RESEND_API_KEY` el código de acceso sale en los logs del contenedor (`🔢 Code:`); no se envían correos.
5. No poner claves de IA/transcripción en pruebas locales.

## Producción

| Dato | Valor |
|---|---|
| URL | https://loom.lab.whitelabel.lat (videos: `/s/<id>`, mismos enlaces que antes) |
| S3 público | https://s3.loom.lab.whitelabel.lat (MinIO, bucket `capso`) |
| Servidor | `ssh vanguardistas` (177.7.42.143), Dokploy v0.30.8 |
| Dokploy | org `W Lab` → proyecto `Loom` → env `production` |
| cap-web | application `loom-capweb-qcmdip`: git `https://github.com/whitelabel-lat/cap.git` rama `main`, Dockerfile `apps/web/Dockerfile`, contexto `.`, puerto 3000. Corre las migraciones al arrancar. Volumen `loom-capweb-qcmdip-workflow` → `/app/.workflow-data` (estado de los workflows) |
| media-server | application `loom-mediaserver-wtljt9`: mismo repo, Dockerfile `apps/media-server/Dockerfile.standalone`, contexto `apps/media-server`, puerto 3456, sin dominio (solo red interna). watchPaths `apps/media-server/**` |
| cron | application `loom-cron-tyvzw2`: mismo repo, Dockerfile `scripts/whitelabel/cron/Dockerfile`, contexto `scripts/whitelabel/cron`, sin puerto ni dominio. watchPaths `scripts/whitelabel/cron/**`, webhook propio de GitHub. Llama a `http://loom-capweb-qcmdip:3000/api/cron/*` por la red interna (ver "Crons") |
| MinIO | application `loom-minio-7q612h`: imagen `pgsty/minio:RELEASE.2026-08-04T00-00-00Z@sha256:b6bf…` (la misma que usa el `docker-compose.yml` de upstream; `quay.io/minio/minio` ya no se puede descargar), args `server /data --address :3902 --console-address :3903`, volumen `loom-minio-7q612h-data` → `/data` |
| MySQL | servicio mysql nativo `loom-mysql-okdbu1` (`mysql:8.0`, collation por defecto `utf8mb4_0900_ai_ci`, `--max_connections=1000`), base `planetscale`, usuario `root`, volumen `loom-mysql-okdbu1-data` → `/var/lib/mysql` |
| Auto-deploy | Sí: webhooks de GitHub (push) del repo a `https://deploy.vanguardistas.co/api/deploy/<refreshToken>` para cap-web, media-server y cron (los dos últimos solo si el push toca sus watchPaths). **Push a `main` = despliegue a producción** (cap-web ~5 min de build en el servidor). MinIO y MySQL no se redespliegan solos |
| Traefik | `/etc/dokploy/traefik/dynamic/loom-capweb-qcmdip.yml` y `loom-minio-7q612h.yml` (escritos a mano en la migración con el formato de Dokploy; si se edita el dominio en la UI, Dokploy los regenera) |
| Stack viejo | compose `pedro-capso-r3y2en` (W Lab → Pedro, imagen oficial `ghcr.io/capsoftware/cap-web:latest`): **detenido**, contenedores con `restart=no`, `autoDeploy=false`, sin dominios; volúmenes `pedro-capso-r3y2en_ps-mysql` y `pedro-capso-r3y2en_minio-data` intactos. Borrarlo cuando todo esté confirmado |

Notas de la migración (2026-10-14):

- El servicio MySQL se creó por SQL y se arrancó con `docker service create` replicando la especificación que usa Dokploy (mismo nombre, volumen, red `dokploy-network`, `dnsrr`); pulsar Deploy en la UI lo actualiza en el sitio sin perder datos.
- Corte: ~44 s sin servicio. Volcado final del MySQL viejo importado en el nuevo, copia del volumen de MinIO (incluye `.minio.sys`: la clave `CAP_AWS_ACCESS_KEY` es una cuenta de servicio de MinIO, no el root), migraciones 0011→0049 aplicadas (`__drizzle_migrations` = 50) y `merge-orgs.sql` ejecutado: 1 organización, 4 miembros (1 owner + 3 admin), 14 videos, 14 shared_videos, 4 usuarios, 4 comentarios.

## Respaldos (en el servidor, `/root/backups/cap/`, solo root)

| Archivo | Momento |
|---|---|
| `planetscale-20261014-0217-pre.sql` + `minio-data-20261014-0217-pre.tgz` | antes de todo (stack viejo, esquema 0000-0010) |
| `planetscale-20261014-0230-cutover.sql` | volcado final del stack viejo en el corte (el que se importó) |
| `planetscale-20261014-post-merge.sql` | base nueva tras migraciones y fusión de organizaciones |
| `planetscale-20261014-0253-pre-workflows.sql` | antes de arreglar los workflows y borrar las filas viejas de `video_uploads` |
| `rollback-old-domains.sql` | filas `domain` originales del compose viejo |
| `planetscale-20261014-1414-pre-maintenance.sql` | antes de los crons, la limpieza de huérfanas y las miniaturas/GIF |

Respaldo nuevo antes de cada push que traiga migraciones:

```bash
ssh vanguardistas 'TS=$(date +%Y%m%d-%H%M); M=$(docker ps -q -f name=loom-mysql-okdbu1); docker exec $M sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF --databases planetscale" > /root/backups/cap/planetscale-$TS.sql; tail -1 /root/backups/cap/planetscale-$TS.sql'
```

## Rollback

1. Código: revertir el commit en `main` y hacer push (redespliega). Si hubo migraciones, además restaurar el último volcado (MySQL no tiene DDL transaccional: no reintentar una migración a medias).
2. Emergencia, volver al stack viejo (imagen oficial, esquema viejo): borrar las filas `domain` de `loom-capweb-qcmdip` y `loom-minio-7q612h` y los dos archivos de Traefik; escalar a 0 `loom-capweb-qcmdip`; `docker start pedro-capso-r3y2en-ps-mysql-1 pedro-capso-r3y2en-minio-1 pedro-capso-r3y2en-cap-web-1` (sus labels de Traefik vuelven a reclamar los hosts) y restaurar las filas con `rollback-old-domains.sql`. Los datos creados en el stack nuevo después del corte se pierden en el viejo.

## Variables en producción (pestaña Environment de cada servicio en Dokploy; solo nombres)

- **cap-web**: `NODE_ENV`, `WEB_URL`, `NEXTAUTH_URL` (`https://loom.lab.whitelabel.lat`), `DATABASE_URL` (`mysql://root:…@loom-mysql-okdbu1:3306/planetscale?ssl={"rejectUnauthorized":false}`), `DATABASE_ENCRYPTION_KEY` y `NEXTAUTH_SECRET` (**idénticos a los del stack viejo**: si cambian, los datos cifrados y las sesiones se rompen), `CAP_AWS_ACCESS_KEY`, `CAP_AWS_SECRET_KEY`, `CAP_AWS_BUCKET` (`capso`), `CAP_AWS_REGION`, `S3_PUBLIC_ENDPOINT` (`https://s3.loom.lab.whitelabel.lat`), `S3_INTERNAL_ENDPOINT` (`http://loom-minio-7q612h:3902`), `S3_PATH_STYLE=true`, `RESEND_API_KEY`, `RESEND_FROM_DOMAIN`, `OPENAI_API_KEY`, `ASSEMBLY_API_KEY`, `MEDIA_SERVER_URL` (`http://loom-mediaserver-wtljt9:3456`), `MEDIA_SERVER_WEBHOOK_URL` (`http://loom-capweb-qcmdip:3000`), `MEDIA_SERVER_WEBHOOK_SECRET`, `PORT=3000` y `WORKFLOW_LOCAL_DATA_DIR=/app/.workflow-data` (runtime de workflows, ver trampas), `CRON_SECRET` (mismo valor que en el servicio cron), y las cinco del fork (tabla de arriba).
- **cron**: `CAP_WEB_URL=http://loom-capweb-qcmdip:3000`, `CRON_SECRET` (aleatorio de 64 hex, `openssl rand -hex 32`; idéntico al de cap-web, si difiere todas las llamadas dan 401).
- **media-server**: `PORT=3456`, `MEDIA_SERVER_WEBHOOK_SECRET` (mismo valor que en cap-web; si falta o difiere, el media-server rechaza todo), `MEDIA_SERVER_WEB_ORIGIN=https://loom.lab.whitelabel.lat`.
- **minio**: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (copiadas del stack viejo).
- `DEEPGRAM_API_KEY` ya no se lee (upstream pasó a AssemblyAI) y no se configuró.

## Matriz de funciones

Leyenda: OK = funciona con el entorno actual; MS = necesita el media-server; env = necesita esa variable; X = no posible autoalojado tal cual. "Verificado" = probado en local en la fase 1; el resto está deducido del código y sin probar de punta a punta.

| Función | Estado | Requiere |
|---|---|---|
| Login por código de correo, Google | OK (verificado el código por email en logs) | `RESEND_API_KEY` + `RESEND_FROM_DOMAIN` para enviar el código; `GOOGLE_CLIENT_ID/SECRET` si se quiere Google |
| Organización única, auto-compartir, privado por defecto | OK (verificado) | variables del fork |
| Reproducción, página `/s/<id>`, embed | OK (verificado con un video real y uno sintético) | S3 accesible desde el navegador (`S3_PUBLIC_ENDPOINT`) |
| Grabación instantánea desde la app de escritorio (MP4) | OK (API verificada: crear video, subir por URL prefirmada) | nada extra |
| Grabación por segmentos (modo "studio"/HLS), verificación y unión de segmentos | MS | `MEDIA_SERVER_URL`, `MEDIA_SERVER_WEBHOOK_SECRET`, `MEDIA_SERVER_WEBHOOK_URL`. Sin media-server la fuente se conserva pero la salida queda diferida (`media-server-unconfigured`) |
| Subida web de MP4 / grabador del navegador | OK en producción (2026-10-14: subida `raw-upload.mp4` → process-video → `result.mp4`, miniatura, GIF y transcripción) | igual; `process-video` falla con `MEDIA_SERVER_URL is not configured` |
| Edición y recorte de video (save-edits, edit-video), miniaturas, previsualizaciones, conversión | OK en producción (2026-10-14: recorte 8 s → 5,26 s con un video sintético, `source/original.mp4` + `result.mp4` nuevo) | igual (rutas `/video/edit`, `/video/thumbnail`, `/video/convert`) |
| Importar desde Loom | MS | igual |
| Mejora de audio | MS + Replicate | `REPLICATE_API_TOKEN` (de pago); opcional |
| Transcripción y subtítulos | OK en producción (2026-10-14: los 13 videos COMPLETE, `transcription.vtt` en MinIO) | `ASSEMBLY_API_KEY` (AssemblyAI). `DEEPGRAM_API_KEY` ya no se usa. La extracción de audio usa el media-server si existe y, si no, ffmpeg-static local |
| Transcripción en vivo (live-transcribe) | env | `ASSEMBLY_API_KEY` y grabación por segmentos (MS) |
| Resumen, capítulos y título con IA | OK en producción (`metadata.aiTitle`, `summary`, `chapters`; los videos cortos pueden quedar con 0 capítulos) | `OPENAI_API_KEY` (se detecta solo; modelo `gpt-4o-mini`) o Groq/Anthropic/`AI_BASE_URL`; necesita la transcripción, es decir también `ASSEMBLY_API_KEY` |
| Chat IA, Ask AI de la documentación | env | `ANTHROPIC_API_KEY` u `OPENAI_API_KEY` |
| Comentarios y reacciones | OK (4 comentarios migrados) | nada extra |
| Notificaciones por correo (invitaciones, comentarios) | env | `RESEND_API_KEY`; sin él no se envían, solo hay notificaciones en la app |
| Espacios y carpetas | OK | nada extra |
| Protección con contraseña | OK | nada extra |
| Dominio personalizado por organización | X | usa la API de Vercel (`VERCEL_AUTH_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`); en Dokploy se resuelve con Traefik a mano, no desde la UI |
| Analíticas de vistas | env (servicio externo) | `TINYBIRD_HOST`, `TINYBIRD_TOKEN` y los datasources de `scripts/analytics`; sin ellos, contadores en 0 y sin error |
| Enlaces cortos (Dub) | env, no necesario | `DUB_API_KEY`; solo se usa en la API pública |
| Facturación, planes Pro | no aplica | autoalojado ya es Pro sin límites (`userIsPro`, `/api/desktop/plan` devuelve `upgraded: true`, verificado) |
| SSO SAML/WorkOS | env | `WORKOS_*`; no necesario |
| Workflows en segundo plano (`workflow` 4.6: transcribir, IA, procesar, editar, etc.) | OK (verificado en producción 2026-10-14) | corren dentro del propio cap-web con el "world" local (es lo que hace upstream: su `docker-compose.yml` no define nada). Necesita `/app/.workflow-data` escribible (Dockerfile del fork) y, para no perder trabajos en un redeploy, el volumen montado ahí. El world local reencola al arrancar las ejecuciones pendientes que encuentra en ese directorio |
| Crons de recuperación (`/api/cron/*`) | OK en producción (2026-10-14, servicio `loom-cron-tyvzw2`) | `CRON_SECRET` en cap-web y en el servicio cron. `sync-loops` no se programa (Loops.so, solo Cap cloud). Ver "Crons" |
| Miniatura y GIF animado de las tarjetas (`/api/video/preview`) | OK (los 13 videos con objeto en MinIO los tienen desde 2026-10-14) | media-server; los videos nuevos los generan en `process-video` |
| Panel de admin "Reprocess video" (`/admin/reprocess-video`) | X | solo existe con `NEXT_PUBLIC_IS_CAP=true` y para `MESSENGER_ADMIN_EMAIL`; además re-codifica `result.mp4`. Usar `scripts/whitelabel/regenerate-previews.mjs` |

## Trampas conocidas

- **Workflows y permisos**: Workflow DevKit (world local) guarda su estado en `<cwd>/.workflow-data` (`/app`). En la imagen de upstream `/app` es de root y el servidor corre como `nextjs`: `start()` fallaba con EACCES y ningún workflow arrancaba (transcripción, IA, procesado, ediciones). Lo arregla el `Dockerfile` del fork. Si se cambia el volumen, el directorio de la imagen debe existir con dueño `nextjs` antes de montar uno vacío (Docker copia el dueño). El volumen crece con cada ejecución (`runs/`, `steps/`, `events/`); revisar su tamaño de vez en cuando.
- **Filas viejas en `video_uploads`**: las subidas web de la versión vieja dejaban la fila al terminar (`phase='uploading'`, `uploaded=total`, `mode` NULL). La versión actual considera cualquier fila como subida en curso, y la página `/s/<id>`, `getVideoStatus` y `transcribeVideo` no arrancan la transcripción. Se borraron las 13 con `scripts/whitelabel/clear-stale-uploads.sql` el 2026-10-14. Si se importa otra base vieja, correr ese script.
- **Errores `S3Error ... 404` en los logs de cap-web**: eran `HEAD .../preview/animated-preview.gif` (la ruta `/api/video/preview`, al pasar el ratón por las tarjetas) de los videos viejos, que nunca pasaron por el media-server y no tenían GIF (8 tampoco miniatura). Resuelto el 2026-10-14 con `regenerate-previews.mjs`. Si vuelven a salir, ver de qué video son: un video importado de otra base o uno cuyo GIF falló (el media-server solo registra un aviso si falla el GIF). Durante una edición aparecen unos pocos mientras se crea `source/original.mp4`; eso es normal.
- **Borrar un video dejaba su fila en `shared_videos`** (`VideosRepo.delete` de upstream no la borraba; con el auto-compartido del fork todos los videos tienen una). Arreglado en el fork; `clean-orphan-shares.sql` limpia las que hubiera (el 2026-10-14 había 0). En cada merge de upstream revisar que `VideosRepo.delete` siga borrando esas tablas (el test lo detecta).
- **Crons**: `recover-failed-video-processing` solo mira videos creados en las últimas 48 h (y atascados más de 1 h); no toca los viejos. `finalize-stale-desktop-segments` responde **503** (no es un fallo del cron) cuando `getDesktopRecordingHealth` ve trabajos de grabación de escritorio atascados: el log del servicio cron mostrará `HTTP 503` con el detalle en JSON. Para rotar `CRON_SECRET` hay que cambiarlo en los dos servicios y redesplegar ambos.
- **watchPaths de Dokploy miran solo el último commit del push** (verificado 2026-10-14: un push de 4 commits cuyo último solo tocaba `WHITELABEL.md` no redesplegó el servicio cron aunque otro commit tocaba `scripts/whitelabel/cron/`). Si un push cambia el media-server o el cron y el último commit no los toca, pulsar Deploy en la UI.
- **supercronic como PID 1** re-ejecuta su propio `argv[0]` para recoger procesos zombis: con `CMD ["supercronic", ...]` muere con `Failed to fork exec: no such file or directory`. Por eso el `Dockerfile` usa la ruta absoluta.

- **Acceso a la organización compartida**: solo entran solos los usuarios nuevos con un dominio de `CAP_DEFAULT_ORG_EMAIL_DOMAINS` (con rol `CAP_DEFAULT_ORG_ROLE`, en producción `admin`: ven todos los videos). Cualquier otra persona (por ejemplo una cuenta de gmail) necesita una invitación de la organización: `provisionOrganizationInvitee` crea el usuario y su membresía al invitar, así que al iniciar sesión `createUser` ya lo encuentra y no pasa por `joinDefaultOrganization`. El registro es abierto: quien no tenga dominio permitido ni invitación se crea su propia organización personal y no ve nada nuestro. Para cerrar el registro, usar además `CAP_ALLOWED_SIGNUP_DOMAINS` (solo se aplica a correos sin usuario creado; los invitados de otros dominios ya existen al invitarlos y pueden entrar igual).
- **Los miembros quitados no vuelven a entrar solos**: si un admin quita a alguien de la organización compartida, ni el login ni la app de escritorio lo vuelven a añadir (la app de escritorio le crea una organización personal vacía). Para devolverle acceso hay que invitarlo de nuevo.
- **Collation de MySQL**: las migraciones nuevas crean tablas con la collation por defecto de la base; si el servidor no usa la misma que las tablas existentes (`utf8mb4_0900_ai_ci`), las FK fallan con `errno 3780`. En producción coincide (se verificó en el servidor). Al reintentar tras un fallo parcial, el segundo intento falla con `ER_FK_DUP_NAME` (DDL no transaccional): hay que restaurar el dump, no reintentar.
- `instrumentation.node.ts` corre las migraciones al arrancar solo si `NEXT_PUBLIC_DOCKER_BUILD=true` (la imagen de Docker lo trae) y además crea el bucket y le pone una política de lectura pública sobre `/*`. Las URLs de los videos son prefirmadas; la política pública existe igualmente en el bucket.
- Un video (`0trhw7zz3p76n8k`) existe en la base pero no tiene objeto en MinIO (ya ocurría en producción): su página da 404 en el reproductor.
- `NEXT_PUBLIC_WEB_URL` se hornea en el build como `http://localhost:3000`, pero en servidor `WEB_URL` tiene prioridad (`packages/env/build.ts`); no hace falta build arg.
- El código de login sin Resend solo aparece en los logs; con `RESEND_API_KEY` se envía por correo real.
- Sin `TINYBIRD_*` las vistas/analíticas están desactivadas (no es un error).
