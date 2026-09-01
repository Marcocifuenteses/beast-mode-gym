import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { API_BASE_URL } from '../api-config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const esRutaAuth = req.url.startsWith(`${API_BASE_URL}/auth/`);
  const conToken = auth.accessToken && !esRutaAuth ? req.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken}` } }) : req;

  return next(conToken).pipe(
    catchError((err: unknown) => {
      const es401 = err instanceof HttpErrorResponse && err.status === 401;
      if (!es401 || esRutaAuth) {
        return throwError(() => err);
      }

      // Intenta renovar el access token una sola vez y reintenta la petición original.
      return from(auth.refrescarSesion()).pipe(
        switchMap((renovado) => {
          if (!renovado) {
            return throwError(() => err);
          }
          const reintento = req.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken}` } });
          return next(reintento);
        }),
      );
    }),
  );
};
