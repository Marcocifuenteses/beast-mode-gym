import { Component, computed, input } from '@angular/core';
import type { HorasPico } from '../core/models/gym.models';

/** Barras con el promedio de llegadas por hora de la última semana. */
@Component({
  selector: 'app-horas-pico',
  standalone: true,
  template: `
    <section class="panel">
      <h2>Horas más concurridas</h2>
      @if (filas().length === 0) {
        <p class="note">Todavía no hay suficientes visitas registradas para calcular las horas pico.</p>
      } @else {
        <p class="note">
          Promedio de llegadas por hora en los últimos {{ datos()?.dias }} días.
          @if (tranquila(); as t) {
            Las {{ t }} suele ser la hora más tranquila.
          }
        </p>
        <div class="barras">
          @for (f of filas(); track f.hora) {
            <div class="fila">
              <span class="num">{{ f.etiqueta }}</span>
              <div class="meter"><i [style.width.%]="f.pct" [style.background]="f.color"></i></div>
              <span class="num val">{{ f.promedio }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .barras {
      display: grid;
      gap: 7px;
    }
    .fila {
      display: grid;
      grid-template-columns: 44px 1fr 38px;
      gap: 8px;
      align-items: center;
      font-size: 13px;
    }
    .meter {
      height: 10px;
    }
    .val {
      text-align: right;
    }
  `,
})
export class HorasPicoPanel {
  readonly datos = input<HorasPico | null>(null);

  readonly filas = computed(() => {
    const horas = this.datos()?.horas ?? [];
    const max = Math.max(...horas.map((h) => h.promedio), 0);
    return horas.map((h) => {
      const pct = max > 0 ? Math.round((h.promedio / max) * 100) : 0;
      return {
        hora: h.hora,
        etiqueta: `${String(h.hora).padStart(2, '0')}:00`,
        promedio: h.promedio,
        pct,
        color: pct >= 80 ? 'var(--bad)' : pct >= 50 ? 'var(--warn)' : 'var(--ok)',
      };
    });
  });

  /** Hora con menos llegadas (entre las que tienen alguna), para sugerirla. */
  readonly tranquila = computed(() => {
    const conVisitas = this.filas().filter((f) => f.promedio > 0);
    if (conVisitas.length < 3) return null;
    return conVisitas.reduce((a, b) => (b.promedio < a.promedio ? b : a)).etiqueta;
  });
}
