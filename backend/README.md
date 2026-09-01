# Backend — Sistema de gimnasio

Node.js + Express + TypeScript + PostgreSQL (Prisma) + JWT con refresh token.

## Requisitos

- Node.js 20+
- PostgreSQL con la base `gym` ya creada y accesible

## Instalación

```bash
npm install
cp .env.example .env   # y completa DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

Genera secretos aleatorios para los JWT:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Base de datos

El esquema ya existe en Postgres (7 tablas + triggers + índices parciales + vistas) y está versionado con Prisma Migrate en `prisma/migrations/`. Para aplicar migraciones pendientes en un entorno nuevo:

```bash
npx prisma migrate deploy
```

Para poblar datos de ejemplo (idempotente, seguro de correr varias veces):

```bash
npm run db:seed
```

Crea/actualiza:
- 1 admin: `admin@gym.com` / `admin123`
- 2 entrenadores: `entrenador1@gym.com`, `entrenador2@gym.com` / `entrenador123`
- 4 planes (Visita, Mensual, Trimestral, Anual)
- 20 suscriptores (`seedNN@seed.gym.local` / `cliente123`) con suscripciones activas, por vencer y vencidas, más asistencias de ejemplo (3 con visita abierta).

## Ejecución

```bash
npm run dev     # desarrollo, recarga automática
npm run build   # compila a dist/
npm start       # producción, requiere build previo
```

Servidor en `http://localhost:3000` (configurable con `PORT`).

## Autenticación

- `POST /api/auth/login` — `{ email, password }` → `{ accessToken, user }`. El refresh token se setea como cookie httpOnly (`path=/api/auth`).
- `POST /api/auth/refresh` — rota el refresh token (requiere la cookie). Si se reutiliza un token ya rotado, se revocan todas las sesiones del usuario.
- `POST /api/auth/logout` — revoca la sesión actual.
- `GET /api/auth/me` — requiere `Authorization: Bearer <accessToken>`.

El access token dura 15 minutos, el refresh 7 días (configurable en `.env`).

## API de negocio (Fase 2)

Todos los endpoints requieren `Authorization: Bearer <accessToken>`.

- `GET /api/planes` (cualquier rol) · `POST` `PUT /:id` `DELETE /:id` (ADMIN, baja lógica).
- `GET /api/clientes` (ADMIN, ENTRENADOR) — panel con plan/días restantes/semáforo (`ACTIVA`/`POR_VENCER`/`VENCIDA`/`SIN_PLAN`), filtros `?estado=` y `?busqueda=`.
- `GET /api/clientes/:id` (ADMIN, ENTRENADOR) · `POST` `PUT /:id` (ADMIN, ENTRENADOR) · `DELETE /:id` (ADMIN, baja lógica de cliente+usuario).
- `GET /api/clientes/me/perfil` (SUSCRIPTOR) — su propio plan, días restantes e historial de asistencias.
- `GET /api/suscripciones?clienteId=` (ADMIN, ENTRENADOR) · `POST` (crea suscripción + pago inicial, ADMIN/ENTRENADOR) · `PUT /:id/cancelar` (ADMIN).
- `GET /api/pagos?suscripcionId=` · `POST` (ADMIN, ENTRENADOR).
- `GET /api/dashboard` (ADMIN, ENTRENADOR) — clientes activos, vencen en 7 días, ingresos del mes, asistencias de hoy, gráfica de últimos 30 días.

Errores centralizados en `src/middleware/error.middleware.ts`: valida body con Zod, traduce errores conocidos de Prisma (P2002/P2025/P2003) y las violaciones de los 3 índices únicos parciales (una suscripción activa por cliente, una asistencia abierta por cliente, un recordatorio automático por tipo) a respuestas 4xx legibles.

## Check-in, aforo y recordatorios (Fase 3)

- `GET /api/aforo` (cualquier rol) — personas dentro ahora mismo (`v_aforo_actual`).
- `POST /api/checkin` `{ codigo }` (ADMIN, ENTRENADOR) — un solo endpoint para entrada/salida: si el cliente tiene una visita abierta la cierra (`SALIDA`); si no, valida que tenga una suscripción `ACTIVA` con `fecha_fin` vigente y abre una nueva (`ENTRADA`). Si la suscripción está vencida, `403`.
- `GET /api/recordatorios?suscripcionId=` (ADMIN, ENTRENADOR).
- `POST /api/recordatorios/enviar` `{ suscripcionId, tipo }` (ADMIN, ENTRENADOR) — botón manual del panel, puede repetirse.
- `POST /api/recordatorios/procesar-ahora` (ADMIN) — dispara la corrida completa del día bajo demanda (misma lógica que el cron).
- Cron diario a las **8:00 AM hora Guatemala** (`src/jobs/recordatorios.cron.ts`): marca `VENCIDA` las suscripciones cuya `fecha_fin` ya pasó, envía "por vencer" a las que vencen en exactamente 5 días y "vencida" a las vencidas — omitiendo siempre las que ya tengan el aviso automático registrado (índice único parcial `uq_recordatorio_automatico`).
- Sin `RESEND_API_KEY` configurada, el servicio de correo (`src/services/email.service.ts`) loguea el correo en consola en vez de enviarlo — útil para desarrollo sin cuenta de Resend real. Con la key puesta, envía de verdad usando las plantillas HTML de `email.service.ts`.

## Gestión de personal

- `GET /api/usuarios` (ADMIN) — lista cuentas ADMIN/ENTRENADOR (`?incluirInactivos=true` para ver también las desactivadas).
- `POST /api/usuarios` `{ nombre, apellido, email, password, rol }` (ADMIN) — crea una cuenta ADMIN o ENTRENADOR (las cuentas SUSCRIPTOR se crean vía `/api/clientes`, siempre ligadas a un registro `Cliente`).
- `DELETE /api/usuarios/:id` (ADMIN) — baja lógica; no se puede desactivar la propia cuenta.

## Estado del proyecto

- ✅ Fase 1: schema Prisma, migraciones, seeds, autenticación con roles (ADMIN/ENTRENADOR/SUSCRIPTOR) y middleware de autorización reutilizable.
- ✅ Fase 2: API de clientes, planes, suscripciones, pagos + dashboard.
- ✅ Fase 3: check-in, aforo, recordatorios por correo (Resend) y cron.
- ⏳ Fase 4: frontend Angular.
