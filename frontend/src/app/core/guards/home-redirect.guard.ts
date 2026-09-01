import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rutaInicioPorRol } from './role.guard';

export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const usuario = auth.usuario();

  return router.parseUrl(usuario ? rutaInicioPorRol(usuario.rol) : '/login');
};
