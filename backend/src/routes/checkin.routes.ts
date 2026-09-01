import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { hoyGuatemala } from '../lib/fecha';

const router = Router();

router.use(authenticate);

// Aforo actual: visible para los 3 roles.
router.get('/aforo', async (_req, res) => {
  const [fila] = await prisma.vAforoActual.findMany();
  res.json({ personasDentro: fila?.personasDentro ?? 0 });
});

const checkinSchema = z.object({ codigo: z.string().min(1) });

// Un solo endpoint funciona como entrada/salida: si el cliente ya tiene una
// visita abierta, este scan la cierra; si no, intenta abrir una nueva
// (validando que tenga una suscripción activa y vigente).
router.post('/checkin', requireRole('ENTRENADOR'), async (req, res) => {
  const { codigo } = checkinSchema.parse(req.body);

  const cliente = await prisma.cliente.findUnique({
    where: { codigo },
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
