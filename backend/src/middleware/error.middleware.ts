import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

// Los 3 índices únicos parciales de la DB (una suscripción ACTIVA por cliente,
// una asistencia abierta por cliente, un recordatorio automático por tipo) no
// están declarados en schema.prisma (Prisma no soporta índices parciales), así
// que sus violaciones no llegan como el P2002 habitual: llegan como el error
// crudo de Postgres (23505) envuelto en un PrismaClientUnknownRequestError.
const MENSAJES_INDICE_PARCIAL: Record<string, string> = {
  uq_suscripcion_activa_por_cliente: 'Este cliente ya tiene una suscripción activa',
  uq_asistencia_abierta_por_cliente: 'Este cliente ya tiene una entrada sin registrar salida',
  uq_recordatorio_automatico: 'Ya se envió un recordatorio automático de este tipo para esta suscripción',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, detalles: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: err.flatten().fieldErrors });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `Ya existe un registro con ese valor (${err.meta?.target})` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Operación inválida: referencia a un registro relacionado inexistente' });
    }
  }

  const mensaje = err instanceof Error ? err.message : '';
  for (const [indice, texto] of Object.entries(MENSAJES_INDICE_PARCIAL)) {
    if (mensaje.includes(indice)) {
      return res.status(409).json({ error: texto });
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
