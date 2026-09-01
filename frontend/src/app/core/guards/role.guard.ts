import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { Rol } from '../models/auth.models';

export function rutaInicioPorRol(rol: Rol): string {
  return rol === 'SUSCRIPTOR' ? '/mi-cuenta' : '/panel/dashboard';
}

export function roleGuard(...rolesPermitidos: Rol[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const usuario = auth.usuario();

    if (!usuario) {
      return router.parseUrl('/login');
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      // Ya está autenticado, solo no tiene permiso para ESTA sección:
      // lo mandamos a su propio inicio, no al login.
      return router.parseUrl(rutaInicioPorRol(usuario.rol));
    }

    return true;
  };
}
