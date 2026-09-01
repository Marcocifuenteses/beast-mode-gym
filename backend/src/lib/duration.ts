const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Convierte strings tipo "15m", "7d", "30s" a milisegundos. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Formato de duración inválido: "${value}" (usar algo como "15m" o "7d")`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNITS[unit];
}
