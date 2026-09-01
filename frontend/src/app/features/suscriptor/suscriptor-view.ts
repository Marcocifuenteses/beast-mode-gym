import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ClientesService } from '../../core/services/clientes.service';
import { CheckinService } from '../../core/services/checkin.service';
import type { PerfilSuscriptor } from '../../core/models/gym.models';

const INTERVALO_AFORO_MS = 30_000;

@Component({
  selector: 'app-suscriptor-view',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatListModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './suscriptor-view.html',
  styleUrl: './suscriptor-view.css',
})
export class SuscriptorView implements OnInit, OnDestroy {
  perfil = signal<PerfilSuscriptor | null>(null);
  aforo = signal<number | null>(null);
  cargando = signal(true);

  private intervaloId?: ReturnType<typeof setInterval>;

  constructor(
    private readonly clientesService: ClientesService,
    private readonly checkinService: CheckinService,
  ) {}

  ngOnInit(): void {
    this.clientesService.miPerfil().subscribe((p) => {
      this.perfil.set(p);
      this.cargando.set(false);
    });

    this.actualizarAforo();
    this.intervaloId = setInterval(() => this.actualizarAforo(), INTERVALO_AFORO_MS);
  }

  ngOnDestroy(): void {
    if (this.intervaloId) clearInterval(this.intervaloId);
  }

  private actualizarAforo(): void {
    this.checkinService.aforo().subscribe((r) => this.aforo.set(r.personasDentro));
  }

  colorEstado(semaforo: string): string {
    switch (semaforo) {
      case 'VIGENTE':
        return 'verde';
      case 'POR_VENCER':
        return 'amarillo';
      case 'VENCIDA':
        return 'rojo';
      default:
        return 'gris';
    }
  }
}
