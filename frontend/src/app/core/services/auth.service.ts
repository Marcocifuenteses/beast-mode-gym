import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import type { LoginResponse, Usuario } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessTokenSig = signal<string | null>(null);
  private readonly usuarioSig = signal<Usuario | null>(null);

  readonly usuario = this.usuarioSig.asReadonly();
  readonly estaAutenticado = computed(() => this.usuarioSig() !== null);

  constructor(private readonly http: HttpClient) {}

  get accessToken(): string | null {
    return this.accessTokenSig();
  }

  async login(email: string, password: string): Promise<Usuario> {
    const respuesta = await firstValueFrom(
      this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { email, password }, { withCredentials: true }),
    );
    this.accessTokenSig.set(respuesta.accessToken);
    this.usuarioSig.set(respuesta.user);
    return respuesta.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true }));
    } finally {
      this.accessTokenSig.set(null);
      this.usuarioSig.set(null);
    }
  }

  private refrescoEnCurso: Promise<boolean> | null = null;

  /**
   * Renueva el access token usando la cookie de refresh. Usado por el interceptor y al arrancar la app.
   * Si varias peticiones fallan a la vez (p. ej. el dashboard carga varias cosas), todas esperan la
   * misma renovación en vez de lanzar una cada una con la misma cookie.
   */
  refrescarSesion(): Promise<boolean> {
    this.refrescoEnCurso ??= this.pedirRefresco().finally(() => (this.refrescoEnCurso = null));
    return this.refrescoEnCurso;
  }

  private async pedirRefresco(): Promise<boolean> {
    try {
      const respuesta = await firstValueFrom(
        this.http.post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true }),
      );
      this.accessTokenSig.set(respuesta.accessToken);

      if (!this.usuarioSig()) {
        const usuario = await firstValueFrom(
          this.http.get<Usuario>(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${respuesta.accessToken}` },
          }),
        );
        this.usuarioSig.set(usuario);
      }
      return true;
    } catch {
      this.accessTokenSig.set(null);
      this.usuarioSig.set(null);
      return false;
    }
  }

  /** Se llama una vez al arrancar la app: intenta restaurar sesión desde la cookie httpOnly. */
  async intentarRestaurarSesion(): Promise<void> {
    await this.refrescarSesion();
  }

  setAccessToken(token: string): void {
    this.accessTokenSig.set(token);
  }
}
