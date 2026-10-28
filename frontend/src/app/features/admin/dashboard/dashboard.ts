import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import { CheckinService } from '../../../core/services/checkin.service';
import type { Aforo, DashboardResumen } from '../../../core/models/gym.models';
import { AforoPanel } from '../../../shared/aforo-panel';

const INTERVALO_AFORO_MS = 30_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AforoPanel],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  resumen = signal<DashboardResumen | null>(null);
  aforo = signal<Aforo | null>(null);
  cargando = signal(true);
  error = signal(false);

  private intervaloId?: ReturnType<typeof setInterval>;

  readonly maxGrafica = computed(() =>
    Math.max(...(this.resumen()?.grafica30Dias.map((d) => d.asistencias) ?? []), 1),
  );

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly checkinService: CheckinService,
  ) {}

  ngOnInit(): void {
    this.dashboardService.obtener().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
    this.actualizarAforo();
    this.intervaloId = setInterval(() => this.actualizarAforo(), INTERVALO_AFORO_MS);
  }

  ngOnDestroy(): void {
    if (this.intervaloId) clearInterval(this.intervaloId);
  }

  private actualizarAforo(): void {
    this.checkinService.aforo().subscribe((a) => this.aforo.set(a));
  }

  formatoQ(valor: string | number): string {
    return `Q${Number(valor).toLocaleString('es-GT', { maximumFractionDigits: 0 })}`;
  }

  /** "2026-10-27" → "27 oct" (la fecha viene como día calendario, sin hora). */
  diaCorto(fecha: string): string {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
  }
}
