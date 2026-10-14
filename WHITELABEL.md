# Cap Whitelabel: fork y despliegue

Estado al 2026-10-13 (fase 1: código y pruebas locales; el despliegue es la fase 2).

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
| Los usuarios nuevos entran a una organización existente en vez de crearse una propia | `packages/database/auth/default-org.ts` (usado en `auth/drizzle-adapter.ts` `createUser` y en el alta de organización por defecto de `app/api/desktop/[...route]/video.ts`) | `CAP_DEFAULT_ORG_ID`, `CAP_DEFAULT_ORG_ROLE` |
| Cada video nuevo se comparte con su organización (fila en `shared_videos`) | `packages/database/auto-share.ts`, llamado tras cada inserción en `videos` | `CAP_AUTO_SHARE_TO_ORG=true` |
| Videos privados por defecto | sin código nuestro: `CAP_VIDEOS_DEFAULT_PUBLIC=false` (y `organizations.defaultVideoVisibility='private'`, lo fija el script de fusión) | variable de entorno |
| Script que fusiona las organizaciones personales ya existentes | `scripts/whitelabel/merge-orgs.sql` | manual, una vez (ver abajo) |

Detalles:

- `joinDefaultOrganization` inserta en `organization_members` (id de 15 caracteres, mismo alfabeto que `nanoId`) y fija `users.activeOrganizationId` y `defaultOrgId`. Si la variable no está o la organización no existe (o está en `tombstoneAt`) devuelve `null` y se aplica el comportamiento de upstream (organización personal).
- No se toca: usuarios invitados (`pendingInvite`) ni SSO, que siguen su flujo; la creación manual de organizaciones por un usuario; `provisionOrganizationInvitee`.
- `autoShareVideoToOrg` es idempotente (consulta antes de insertar) y usa la misma transacción cuando existe. Sitios cubiertos: grabación desktop (`/api/desktop/video/create`), `createInstantRecording` y duplicados (`VideosRepo.create`), subida web (`actions/video/upload.ts`, `create-for-processing.ts`), importación Loom (`actions/loom.ts`, v1 y mobile), subida vía API v1 y duplicado de operaciones de agente. Al añadir un sitio nuevo que haga `insert(videos)` en un merge de upstream, hay que llamar al helper.
- La app de escritorio guarda el `orgId` viejo y lo sigue mandando. `/api/desktop/video/create` ya lo ignora si no existe (cae a la organización por defecto del usuario), verificado en local tras borrar las organizaciones viejas.
- El onboarding no renombra la organización compartida: solo el owner puede editarla.
- Tests nuevos: `apps/web/__tests__/unit/default-organization.test.ts`, `auto-share-video.test.ts`. `recording-storage-lifecycle.test.ts` mockea `@cap/database/auto-share` (su `serverEnv()` no está disponible en ese test).

## Variables de entorno

Nuevas (todas opcionales):

| Variable | Valor en producción | Efecto |
|---|---|---|
| `CAP_DEFAULT_ORG_ID` | `p1m68fg1fs7n0a9` | Organización a la que entra todo usuario nuevo |
| `CAP_DEFAULT_ORG_ROLE` | `admin` | Rol del usuario nuevo (`member` o `admin`; por defecto `member`) |
| `CAP_AUTO_SHARE_TO_ORG` | `true` | Comparte cada video nuevo con su organización |
| `CAP_VIDEOS_DEFAULT_PUBLIC` | `false` | Videos nuevos privados (upstream: `true`) |

Las existentes que necesita producción están en la sección "Despliegue".

## Fusionar organizaciones existentes (una vez)

`scripts/whitelabel/merge-orgs.sql`:

1. Orgs destino y origen van en las variables `@wl_target` y `@wl_old` al inicio del script.
2. Hace todo en una transacción (procedimiento temporal) y es idempotente: todos los usuarios pasan a miembros de la organización destino (el owner conserva su rol, el resto `admin`), `activeOrganizationId`/`defaultOrgId` apuntan a ella, los videos de las organizaciones viejas se mueven y se comparten con la nueva (conservan id y `public`), folders/spaces/notificaciones/buckets/importados se reasignan, se borran invitaciones/SSO/BAA de las viejas, la nueva queda con `defaultVideoVisibility='private'` y por último se borran miembros y organizaciones viejas. Antes de borrar comprueba en `information_schema` que ninguna tabla con `organizationId`/`orgId`/`activeOrganizationId`/`defaultOrgId` siga apuntando a una vieja; si queda alguna, aborta con rollback.
3. **Ejecutar solo después de que la imagen nueva haya aplicado las migraciones 0011-0049** (arranca sola al iniciar cap-web).
4. Uso: `mysql -uroot -p planetscale < scripts/whitelabel/merge-orgs.sql`. Salida esperada con los datos actuales: 1 organización, 4 miembros, 14 videos, 14 shared_videos, 4 usuarios.

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

## Despliegue y rollback (completar en la fase 2)

- Imagen: construida desde este repo (`apps/web/Dockerfile`). Pendiente: workflow de GitHub Actions o build en Dokploy y registro de imágenes. TODO fase 2.
- Servicios en el compose de Dokploy `pedro-capso-r3y2en` (server `vanguardistas`): cap-web, ps-mysql, minio. Añadir media-server (`apps/media-server/Dockerfile.standalone`, puerto 3456, ffmpeg incluido). TODO fase 2.
- Respaldos antes de desplegar: `mysqldump` de `planetscale` y tar del volumen `pedro-capso-r3y2en_minio-data`. TODO fase 2: ruta y nombre.
- Rollback: volver a `ghcr.io/capsoftware/cap-web:latest` NO sirve tras migrar (el esquema ya es el nuevo): restaurar el dump previo. TODO fase 2.

Variables que necesita cap-web en producción (nombres; "copiar" = mismo valor que el contenedor actual):

- Copiar: `DATABASE_URL`, `NEXTAUTH_SECRET`, `DATABASE_ENCRYPTION_KEY`, `WEB_URL`, `NEXTAUTH_URL`, `CAP_AWS_BUCKET`, `CAP_AWS_REGION`, `CAP_AWS_ACCESS_KEY`, `CAP_AWS_SECRET_KEY`, `S3_PUBLIC_ENDPOINT`, `S3_INTERNAL_ENDPOINT`, `RESEND_API_KEY`, `RESEND_FROM_DOMAIN`, `OPENAI_API_KEY`.
- Añadir `S3_PATH_STYLE=true` si no se hereda (el valor por defecto ya es `true`).
- Nuevas del fork: las cuatro de la tabla de arriba.
- Media server: `MEDIA_SERVER_URL=http://<servicio>:3456`, `MEDIA_SERVER_WEBHOOK_URL=http://<cap-web>:3000` (URL interna a la que el media-server llama de vuelta), `MEDIA_SERVER_WEBHOOK_SECRET` (el mismo valor en cap-web y en el media-server; si falta, el media-server rechaza todo).
- Transcripción: `ASSEMBLY_API_KEY` (**`DEEPGRAM_API_KEY` ya no se lee**: upstream lo sustituyó por AssemblyAI).
- `DEEPGRAM_API_KEY` se puede quitar.

## Matriz de funciones

Leyenda: OK = funciona con el entorno actual; MS = necesita el media-server; env = necesita esa variable; X = no posible autoalojado tal cual. "Verificado" = probado en local en la fase 1; el resto está deducido del código y sin probar de punta a punta.

| Función | Estado | Requiere |
|---|---|---|
| Login por código de correo, Google | OK (verificado el código por email en logs) | `RESEND_API_KEY` + `RESEND_FROM_DOMAIN` para enviar el código; `GOOGLE_CLIENT_ID/SECRET` si se quiere Google |
| Organización única, auto-compartir, privado por defecto | OK (verificado) | variables del fork |
| Reproducción, página `/s/<id>`, embed | OK (verificado con un video real y uno sintético) | S3 accesible desde el navegador (`S3_PUBLIC_ENDPOINT`) |
| Grabación instantánea desde la app de escritorio (MP4) | OK (API verificada: crear video, subir por URL prefirmada) | nada extra |
| Grabación por segmentos (modo "studio"/HLS), verificación y unión de segmentos | MS | `MEDIA_SERVER_URL`, `MEDIA_SERVER_WEBHOOK_SECRET`, `MEDIA_SERVER_WEBHOOK_URL`. Sin media-server la fuente se conserva pero la salida queda diferida (`media-server-unconfigured`) |
| Subida web de MP4 / grabador del navegador | MS | igual; `process-video` falla con `MEDIA_SERVER_URL is not configured` |
| Edición y recorte de video (save-edits, edit-video), miniaturas, previsualizaciones, conversión | MS | igual (rutas `/video/edit`, `/video/thumbnail`, `/video/convert`) |
| Importar desde Loom | MS | igual |
| Mejora de audio | MS + Replicate | `REPLICATE_API_TOKEN` (de pago); opcional |
| Transcripción y subtítulos | env | `ASSEMBLY_API_KEY` (AssemblyAI). `DEEPGRAM_API_KEY` ya no se usa. La extracción de audio usa el media-server si existe y, si no, ffmpeg-static local |
| Transcripción en vivo (live-transcribe) | env | `ASSEMBLY_API_KEY` y grabación por segmentos (MS) |
| Resumen, capítulos y título con IA | env | `OPENAI_API_KEY` (se detecta solo; modelo `gpt-4o-mini`) o Groq/Anthropic/`AI_BASE_URL`; necesita la transcripción, es decir también `ASSEMBLY_API_KEY` |
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
| Workflows en segundo plano (`workflow` 4.6: transcribir, procesar, editar, etc.) | OK | corren dentro del propio cap-web con el "world" local; sin servicio extra. Un reinicio del contenedor a mitad de un trabajo puede dejarlo a medias (hay recuperación en `video-pipeline-recovery`) |

## Trampas conocidas

- **Collation de MySQL**: las migraciones nuevas crean tablas con la collation por defecto de la base; si el servidor no usa la misma que las tablas existentes (`utf8mb4_0900_ai_ci`), las FK fallan con `errno 3780`. En producción coincide (se verificó en el servidor). Al reintentar tras un fallo parcial, el segundo intento falla con `ER_FK_DUP_NAME` (DDL no transaccional): hay que restaurar el dump, no reintentar.
- `instrumentation.node.ts` corre las migraciones al arrancar solo si `NEXT_PUBLIC_DOCKER_BUILD=true` (la imagen de Docker lo trae) y además crea el bucket y le pone una política de lectura pública sobre `/*`. Las URLs de los videos son prefirmadas; la política pública existe igualmente en el bucket.
- Un video (`0trhw7zz3p76n8k`) existe en la base pero no tiene objeto en MinIO (ya ocurría en producción): su página da 404 en el reproductor.
- `NEXT_PUBLIC_WEB_URL` se hornea en el build como `http://localhost:3000`, pero en servidor `WEB_URL` tiene prioridad (`packages/env/build.ts`); no hace falta build arg.
- El código de login sin Resend solo aparece en los logs; con `RESEND_API_KEY` se envía por correo real.
- Sin `TINYBIRD_*` las vistas/analíticas están desactivadas (no es un error).
