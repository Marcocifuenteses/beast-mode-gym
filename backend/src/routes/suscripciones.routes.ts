import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';
import { enviarCorreoPagoConfirmado } from '../services/email.service';
import { hoyGuatemala, sumarDias } from '../lib/fecha';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'ENTRENADOR'));

router.get('/', async (req, res) => {
  const clienteId = typeof req.query.clienteId === 'string' ? parseBigIntParam(req.query.clienteId) : undefined;

  const suscripciones = await prisma.suscripcion.findMany({
    where: clienteId ? { clienteId } : undefined,
    include: { plan: true, pagos: true },
    orderBy: { fechaInicio: 'desc' },
  });

  res.json(suscripciones);
});

const crearSuscripcionSchema = z.object({
  clienteId: z.coerce.bigint(),
  planId: z.coerce.bigint(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).default('EFECTIVO'),
  referencia: z.string().max(80).optional(),
});

router.post('/', async (req, res) => {
  const data = crearSuscripcionSchema.parse(req.body);

  const [cliente, plan] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: data.clienteId }, include: { usuario: true } }),
    prisma.plan.findUnique({ where: { id: data.planId } }),
  ]);
  if (!cliente) throw new NotFoundError('Cliente');
  if (!plan) throw new NotFoundError('Plan');

  const fechaInicio = new Date();
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + plan.duracionDias);

  const suscripcion = await prisma.$transaction(async (tx) => {
    const nueva = await tx.suscripcion.create({
      data: {
        clienteId: data.clienteId,
        planId: data.planId,
        fechaInicio,
        fechaFin,
        precioPagado: plan.precio,
        estado: 'ACTIVA',
      },
    });
    await tx.pago.create({
      data: {
        suscripcionId: nueva.id,
        monto: plan.precio,
        metodo: data.metodoPago,
        referencia: data.referencia,
      },
    });
    return nueva;
  });

  const completa = await prisma.suscripcion.findUnique({
    where: { id: suscripcion.id },
    include: { plan: true, pagos: true },
  });
  res.status(201).json(completa);

  // El correo de confirmación no debe poder tumbar una creación que ya fue
  // exitosa: se envía después de responder, y cualquier falla solo se loguea.
  enviarCorreoPagoConfirmado(cliente.usuario.email, {
    nombre: `${cliente.usuario.nombre} ${cliente.usuario.apellido}`,
    plan: plan.nombre,
    monto: Number(plan.precio),
    metodo: data.metodoPago,
    fechaFin: fechaFin.toISOString().slice(0, 10),
  }).catch((err) => console.error('[suscripciones] no se pudo enviar el correo de confirmación de pago:', err));
});

const editarDiasSchema = z.object({
  dias: z.coerce.number().int(),
});

// Permite al ADMIN adelantar o alargar el vencimiento de una suscripción
// (p. ej. "le quedan 15 días, bájalo a 4" o "dale 10 días más"). Recibe el
// nuevo total de días restantes desde hoy, no un delta.
router.put('/:id/dias', requireRole('ADMIN'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const { dias } = editarDiasSchema.parse(req.body);

  const existente = await prisma.suscripcion.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Suscripción');
  if (existente.estado === 'CANCELADA') {
    throw new AppError(409, 'No se puede modificar una suscripción cancelada');
  }

  const hoy = hoyGuatemala();
  const nuevaFechaFin = sumarDias(hoy, dias);
  const nuevoEstado = nuevaFechaFin >= hoy ? 'ACTIVA' : 'VENCIDA';

  const suscripcion = await prisma.suscripcion.update({
    where: { id },
    data: { fechaFin: nuevaFechaFin, estado: nuevoEstado },
    include: { plan: true, pagos: true },
  });

  res.json(suscripcion);
});

router.put('/:id/cancelar', requireRole('ADMIN'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const existente = await prisma.suscripcion.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Suscripción');

  const suscripcion = await prisma.suscripcion.update({
    where: { id },
    data: { estado: 'CANCELADA' },
  });
  res.json(suscripcion);
});

export default router;
