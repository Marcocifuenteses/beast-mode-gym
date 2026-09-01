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

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}
