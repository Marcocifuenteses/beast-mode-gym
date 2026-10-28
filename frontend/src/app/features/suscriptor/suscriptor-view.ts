import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ClientesService } from '../../core/services/clientes.service';
import type { PerfilSuscriptor } from '../../core/models/gym.models';
import { estadoMembresia, fechaCorta, formatoQ } from '../../shared/estado';

@Component({
  selector: 'app-suscriptor-view',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './suscriptor-view.html',
  styleUrl: './suscriptor-view.css',
})
export class SuscriptorView implements OnInit {
  readonly fechaCorta = fechaCorta;
  readonly formatoQ = formatoQ;

  perfil = signal<PerfilSuscriptor | null>(null);
  cargando = signal(true);
  error = signal(false);

  readonly estado = computed(() => {
    const p = this.perfil()?.perfil;
    return p ? estadoMembresia(p) : null;
  });

  /** Hay una visita abierta si la asistencia más reciente no tiene salida. */
  readonly dentro = computed(() => {
    const ultima = this.perfil()?.historialAsistencias[0];
    return !!ultima && !ultima.salida;
  });

  constructor(private readonly clientesService: ClientesService) {}

  ngOnInit(): void {
    this.clientesService.miPerfil().subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  duracion(entrada: string, salida: string): string {
    const min = Math.round((new Date(salida).getTime() - new Date(entrada).getTime()) / 60000);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  }
}
