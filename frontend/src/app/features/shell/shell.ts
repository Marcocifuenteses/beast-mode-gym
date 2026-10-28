import { Component, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import type { Rol } from '../../core/models/auth.models';

interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: string;
  /** Activa solo con coincidencia exacta (para rutas padre como /mi-cuenta). */
  exacta?: boolean;
}

const PESTANAS: Record<Rol, Pestana[]> = {
  ADMIN: [
    { ruta: '/panel/dashboard', etiqueta: 'Inicio', icono: 'home' },
    { ruta: '/panel/clientes', etiqueta: 'Socios', icono: 'groups' },
    { ruta: '/panel/staff', etiqueta: 'Personal', icono: 'badge' },
  ],
  ENTRENADOR: [
    { ruta: '/panel/dashboard', etiqueta: 'Inicio', icono: 'home' },
    { ruta: '/panel/clientes', etiqueta: 'Socios', icono: 'groups' },
    { ruta: '/panel/checkin', etiqueta: 'Check-in', icono: 'qr_code_scanner' },
  ],
  SUSCRIPTOR: [
    { ruta: '/mi-cuenta', etiqueta: 'Membresía', icono: 'credit_card', exacta: true },
    { ruta: '/mi-cuenta/acceso', etiqueta: 'Acceso', icono: 'qr_code_2' },
    { ruta: '/mi-cuenta/aforo', etiqueta: 'Aforo', icono: 'speed' },
  ],
};

const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  ENTRENADOR: 'Entrenador',
  SUSCRIPTOR: 'Socio',
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  readonly pestanas = computed(() => {
    const usuario = this.auth.usuario();
    return usuario ? PESTANAS[usuario.rol] : [];
  });

  readonly nombreRol = computed(() => {
    const usuario = this.auth.usuario();
    return usuario ? NOMBRE_ROL[usuario.rol] : '';
  });

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async salir(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
