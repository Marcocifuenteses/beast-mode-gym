# Frontend — Sistema de gimnasio

Angular 22 (standalone + signals) + Angular Material.

## Ejecución

```bash
npm install
npm start   # http://localhost:4200
```

Requiere el backend corriendo en `http://localhost:3000` (ver `../backend/README.md`). La URL base de la API está fija en [src/app/core/api-config.ts](src/app/core/api-config.ts).

## Estructura

```
src/app/
  core/
    api-config.ts
    models/            # tipos compartidos (auth, clientes, planes, etc.)
    services/          # AuthService (signals) + un servicio por recurso de la API
    interceptors/      # adjunta el access token, renueva sesión en un 401
    guards/            # authGuard, roleGuard, guestGuard, homeRedirectGuard
  features/
    auth/login/
    shell/             # toolbar + sidenav, menú según rol
    admin/             # dashboard, clientes (panel + alta + asignar plan), check-in, personal — ADMIN/ENTRENADOR
    suscriptor/        # vista propia con aforo (polling cada 30s) — SUSCRIPTOR
```

## Autenticación

El access token vive solo en memoria (signal de `AuthService`, se pierde al recargar la página); la sesión se restaura al arrancar la app vía la cookie httpOnly de refresh (`APP_INITIALIZER` en `app.config.ts`). El interceptor reintenta una vez la petición original si recibe 401, renovando el token primero.

## Rutas y roles

- `/login` — pública (redirige a la vista del usuario si ya hay sesión).
- `/panel/*` (dashboard, clientes, checkin) — ADMIN, ENTRENADOR.
- `/panel/staff` — solo ADMIN (alta de cuentas ADMIN/ENTRENADOR).
- `/mi-cuenta` — SUSCRIPTOR.

Entrar a una sección sin permiso no manda a `/login` si ya hay sesión: redirige a la vista propia del rol.

## Estado del proyecto

Fases 1-4 completas (ver `../backend/README.md` para el detalle de la API). Pendiente como trabajo futuro: gestión de planes/suscripciones/pagos desde la UI (hoy solo alta de clientes + check-in + panel), y tests automatizados.
