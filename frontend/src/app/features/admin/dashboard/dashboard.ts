import { Component, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardService } from '../../../core/services/dashboard.service';
import { CheckinService } from '../../../core/services/checkin.service';
import type { DashboardResumen } from '../../../core/models/gym.models';

interface Tarjeta {
  valor: string;
  etiqueta: string;
  icono: string;
  color: 'accent' | 'cian' | 'verde' | 'amarillo';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  resumen = signal<DashboardResumen | null>(null);
  aforo = signal<number | null>(null);
  cargando = signal(true);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly checkinService: CheckinService,
  ) {}

  ngOnInit(): void {
    this.dashboardService.obtener().subscribe((resumen) => {
      this.resumen.set(resumen);
      this.cargando.set(false);
    });
    this.checkinService.aforo().subscribe((r) => this.aforo.set(r.personasDentro));
  }

  tarjetas(): Tarjeta[] {
    const r = this.resumen();
    if (!r) return [];
    return [
      { valor: String(r.clientesActivos), etiqueta: 'Clientes activos', icono: 'groups', color: 'accent' },
      { valor: String(r.vencenEn7Dias), etiqueta: 'Vencen en 7 días', icono: 'event_busy', color: 'amarillo' },
      { valor: `Q${r.ingresosDelMes}`, etiqueta: 'Ingresos del mes', icono: 'payments', color: 'verde' },
      { valor: String(r.asistenciasHoy), etiqueta: 'Asistencias hoy', icono: 'directions_run', color: 'cian' },
      { valor: String(this.aforo() ?? '—'), etiqueta: 'Aforo actual', icono: 'groups_2', color: 'accent' },
    ];
  }

  alturaBarra(asistencias: number): number {
    const max = Math.max(...(this.resumen()?.grafica30Dias.map((d) => d.asistencias) ?? [1]), 1);
    return Math.round((asistencias / max) * 100);
  }
}
