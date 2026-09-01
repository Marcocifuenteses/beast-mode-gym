import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rutaInicioPorRol } from './role.guard';

/** Bloquea /login si ya hay una sesión activa, mandando al usuario a su propia vista. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const usuario = auth.usuario();

  return usuario ? router.parseUrl(rutaInicioPorRol(usuario.rol)) : true;
};
