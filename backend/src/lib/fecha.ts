const TIMEZONE = 'America/Guatemala';

/**
 * "Hoy" según la zona horaria de Guatemala, como medianoche UTC — misma
 * representación que usa Postgres para columnas DATE, para poder comparar
 * directamente con fechaFin sin desfases de huso horario.
 */
export function hoyGuatemala(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return new Date(Date.UTC(obtener('year'), obtener('month') - 1, obtener('day')));
}

/** Hora del día (0-23) de un instante, según la zona horaria de Guatemala. */
export function horaGuatemala(fecha: Date): number {
  const hora = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', hourCycle: 'h23' }).format(fecha);
  return Number(hora);
}

// Guatemala está en UTC-6 todo el año (no usa horario de verano desde 2006).
const DESFASE_GUATEMALA_MS = 6 * 60 * 60 * 1000;

/** Instante en que empieza (medianoche en Guatemala) el día `hoy + dias`. */
export function inicioDiaGuatemala(dias = 0): Date {
  return new Date(sumarDias(hoyGuatemala(), dias).getTime() + DESFASE_GUATEMALA_MS);
}

/** Instante en que empieza el mes en curso, en hora de Guatemala. */
export function inicioMesGuatemala(): Date {
  const hoy = hoyGuatemala();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1) + DESFASE_GUATEMALA_MS);
}

/** Día calendario ("2026-10-27") de un instante, según la hora de Guatemala. */
export function diaGuatemala(instante: Date): string {
  return new Date(instante.getTime() - DESFASE_GUATEMALA_MS).toISOString().slice(0, 10);
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}
