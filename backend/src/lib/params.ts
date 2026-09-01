import { AppError } from './errors';

export function parseBigIntParam(value: string | string[]): bigint {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) {
    throw new AppError(400, 'ID inválido');
  }
  return BigInt(raw);
}
