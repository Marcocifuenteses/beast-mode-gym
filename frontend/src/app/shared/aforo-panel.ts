import { Component, computed, input } from '@angular/core';
import type { Aforo } from '../core/models/gym.models';

/** Medidor de aforo: personas dentro vs. capacidad, con nivel Tranquilo/Moderado/Lleno. */
@Component({
  selector: 'app-aforo-panel',
  standalone: true,
  template: `
    <section class="panel">
      <div class="top">
        <div>
          <div class="label">Aforo actual</div>
          @if (aforo(); as a) {
            <b class="num">{{ a.personasDentro }}</b>
            <span class="note de">/ {{ a.capacidad }} personas</span>
          } @else {
            <b class="num">—</b>
          }
        </div>
        @if (aforo()) {
          <span class="pill" [class]="nivel().clase">{{ nivel().texto }}</span>
        }
      </div>
      <div
        class="meter"
        role="meter"
        aria-label="Aforo"
        [attr.aria-valuenow]="aforo()?.personasDentro ?? 0"
        aria-valuemin="0"
        [attr.aria-valuemax]="aforo()?.capacidad ?? 0"
      >
        <i [style.width.%]="porcentaje()"></i>
      </div>
      <p class="note">{{ porcentaje() }}% de la capacidad. Se actualiza con cada entrada y salida.</p>
    </section>
  `,
  styles: `
    .top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .top b {
      font-family: var(--display);
      font-size: 40px;
      line-height: 1;
    }
    .de {
      display: inline;
    }
  `,
})
export class AforoPanel {
  readonly aforo = input<Aforo | null>(null);

  readonly porcentaje = computed(() => {
    const a = this.aforo();
    if (!a || a.capacidad <= 0) return 0;
    return Math.min(100, Math.round((a.personasDentro / a.capacidad) * 100));
  });

  readonly nivel = computed(() => {
    const p = this.porcentaje();
    if (p < 50) return { texto: 'Tranquilo', clase: 'ok' };
    if (p < 80) return { texto: 'Moderado', clase: 'warn' };
    return { texto: 'Lleno', clase: 'bad' };
  });
}
