import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CheckinService } from '../../core/services/checkin.service';
import type { Aforo, HorasPico } from '../../core/models/gym.models';
import { AforoPanel } from '../../shared/aforo-panel';
import { HorasPicoPanel } from '../../shared/horas-pico';

const INTERVALO_AFORO_MS = 30_000;

/** Pestaña "Aforo" del socio: cuánta gente hay ahora y a qué horas conviene ir. */
@Component({
  selector: 'app-aforo-view',
  standalone: true,
  imports: [AforoPanel, HorasPicoPanel],
  template: `
    <div class="page">
      <app-aforo-panel [aforo]="aforo()" />
      <app-horas-pico [datos]="horas()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 560px;
      margin: 0 auto;
    }
  `,
})
export class AforoView implements OnInit, OnDestroy {
  aforo = signal<Aforo | null>(null);
  horas = signal<HorasPico | null>(null);

  private intervaloId?: ReturnType<typeof setInterval>;

  constructor(private readonly checkinService: CheckinService) {}

  ngOnInit(): void {
    this.actualizarAforo();
    this.intervaloId = setInterval(() => this.actualizarAforo(), INTERVALO_AFORO_MS);
    this.checkinService.horasPico().subscribe((h) => this.horas.set(h));
  }

  ngOnDestroy(): void {
    if (this.intervaloId) clearInterval(this.intervaloId);
  }

  private actualizarAforo(): void {
    this.checkinService.aforo().subscribe((a) => this.aforo.set(a));
  }
}
