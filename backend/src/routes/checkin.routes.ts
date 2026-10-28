import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { horaGuatemala, hoyGuatemala } from '../lib/fecha';
import { env } from '../config/env';
import { consumirTokenQr } from '../services/checkin-qr.service';

const router = Router();

router.use(authenticate);

// Aforo actual: visible para los 3 roles.
router.get('/aforo', async (_req, res) => {
  const [fila] = await prisma.vAforoActual.findMany();
  res.json({ personasDentro: fila?.personasDentro ?? 0, capacidad: env.AFORO_CAPACIDAD });
});

const DIAS_HORAS_PICO = 7;

// Horas pico: promedio diario de entradas por hora (hora de Guatemala) en la
// última semana. Se recortan las horas vacías de los extremos (gym cerrado).
router.get('/aforo/horas', async (_req, res) => {
  const desde = new Date(Date.now() - DIAS_HORAS_PICO * 24 * 60 * 60 * 1000);
  const entradas = await prisma.asistencia.findMany({
    where: { entrada: { gte: desde } },
    select: { entrada: true },
  });

  const porHora = new Array<number>(24).fill(0);
  for (const { entrada } of entradas) {
    porHora[horaGuatemala(entrada)]++;
  }

  const primera = porHora.findIndex((n) => n > 0);
  const ultima = 23 - [...porHora].reverse().findIndex((n) => n > 0);
  const horas =
    primera === -1
      ? []
      : porHora
          .slice(primera, ultima + 1)
          .map((n, i) => ({ hora: primera + i, promedio: Math.round((n / DIAS_HORAS_PICO) * 10) / 10 }));

  res.json({ dias: DIAS_HORAS_PICO, horas });
});

const checkinSchema = z.union([
  z.object({ qr: z.string().min(1) }),
  z.object({ codigo: z.string().trim().toUpperCase().min(1) }),
]);

// Un solo endpoint funciona como entrada/salida: si el cliente ya tiene una
// visita abierta, este scan la cierra; si no, intenta abrir una nueva
// (validando que tenga una suscripción activa y vigente). El cliente se
// identifica por su código escrito a mano o por el QR dinámico de su app.
router.post('/checkin', requireRole('ENTRENADOR'), async (req, res) => {
  const entrada = checkinSchema.parse(req.body);

  const cliente = await prisma.cliente.findUnique({
    where: 'qr' in entrada ? { id: consumirTokenQr(entrada.qr) } : { codigo: entrada.codigo },
    include: { usuario: true },
  });
  if (!cliente || !cliente.activo) {
    throw new NotFoundError('Cliente');
  }

  const visitaAbierta = await prisma.asistencia.findFirst({
    where: { clienteId: cliente.id, salida: null },
  });

  if (visitaAbierta) {
    const asistencia = await prisma.asistencia.update({
      where: { id: visitaAbierta.id },
      data: { salida: new Date() },
    });
    return res.json({
      accion: 'SALIDA',
      cliente: { nombre: cliente.usuario.nombre, apellido: cliente.usuario.apellido, codigo: cliente.codigo },
      asistencia,
    });
  }

  const suscripcionActiva = await prisma.suscripcion.findFirst({
    where: { clienteId: cliente.id, estado: 'ACTIVA', fechaFin: { gte: hoyGuatemala() } },
    orderBy: { fechaFin: 'desc' },
  });

  if (!suscripcionActiva) {
    throw new AppError(403, 'Suscripción vencida o inexistente. Acceso denegado.');
  }

  const asistencia = await prisma.asistencia.create({
    data: { clienteId: cliente.id, suscripcionId: suscripcionActiva.id, entrada: new Date() },
  });

  res.status(201).json({
    accion: 'ENTRADA',
    cliente: { nombre: cliente.usuario.nombre, apellido: cliente.usuario.apellido, codigo: cliente.codigo },
    asistencia,
  });
});

export default router;
