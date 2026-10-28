import type { ClientePanel } from '../core/models/gym.models';

export interface EstadoVisual {
  texto: string;
  clase: 'ok' | 'warn' | 'bad' | '';
}

/** Texto y color de la etiqueta de estado de una membresía (semáforo de la vista). */
export function estadoMembresia(c: Pick<ClientePanel, 'semaforo' | 'diasRestantes'>): EstadoVisual {
  switch (c.semaforo) {
    case 'VIGENTE':
      return { texto: 'Activa', clase: 'ok' };
    case 'POR_VENCER': {
      const d = c.diasRestantes ?? 0;
      return { texto: d === 0 ? 'Vence hoy' : `Vence en ${d} d`, clase: 'warn' };
    }
    case 'VENCIDA':
      return { texto: 'Vencida', clase: 'bad' };
    default:
      return { texto: 'Sin plan', clase: '' };
  }
}

/**
 * Formatea una fecha de calendario del backend ("2026-10-27T00:00:00.000Z").
 * Se lee en UTC porque las columnas DATE llegan como medianoche UTC: en hora
 * local de Guatemala se mostrarían como el día anterior.
 */
export function fechaCorta(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatoQ(valor: string | number): string {
  return `Q${Number(valor).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function iniciales(nombre: string, apellido = ''): string {
  return `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`.toUpperCase();
}
