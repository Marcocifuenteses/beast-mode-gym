import { Router } from 'express';
import { z } from 'zod';
import type { MetodoPago, Plan } from '@prisma/client';
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

  const { id, fechaFin } = await crearSuscripcionConPago(cliente.id, plan, data.metodoPago, data.referencia);

  res.status(201).json(await obtenerSuscripcion(id));
  notificarPago(cliente.usuario, plan, data.metodoPago, fechaFin);
});

const renovarSchema = z.object({
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA']).default('EFECTIVO'),
  referencia: z.string().max(80).optional(),
});

// Renueva con el mismo plan. Si la suscripción sigue vigente, se alarga desde
// su fecha de vencimiento (no se pierden los días que le quedaban); si ya
// venció, se crea una suscripción nueva que empieza hoy.
router.post('/:id/renovar', async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const data = renovarSchema.parse(req.body ?? {});

  const actual = await prisma.suscripcion.findUnique({
    where: { id },
    include: { plan: true, cliente: { include: { usuario: true } } },
  });
  if (!actual) throw new NotFoundError('Suscripción');
  if (actual.estado === 'CANCELADA') {
    throw new AppError(409, 'No se puede renovar una suscripción cancelada');
  }
  if (!actual.plan.activo) {
    throw new AppError(409, 'Este plan ya no está disponible; asigna otro plan al cliente');
  }

  const { plan } = actual;
  let resultado: { id: bigint; fechaFin: Date };

  if (actual.estado === 'ACTIVA' && actual.fechaFin >= hoyGuatemala()) {
    const fechaFin = sumarDias(actual.fechaFin, plan.duracionDias);
    await prisma.$transaction([
      prisma.suscripcion.update({
        where: { id },
        data: { fechaFin, precioPagado: { increment: plan.precio } },
      }),
      prisma.pago.create({
        data: { suscripcionId: id, monto: plan.precio, metodo: data.metodoPago, referencia: data.referencia },
      }),
      // Los avisos automáticos se deduplican por (suscripción, tipo); al
      // cambiar la fecha de vencimiento hay que liberarlos para que el
      // cliente vuelva a recibir el "por vencer" de su nuevo vencimiento.
      prisma.recordatorio.deleteMany({ where: { suscripcionId: id, enviadoPor: null } }),
    ]);
    resultado = { id, fechaFin };
  } else {
    resultado = await crearSuscripcionConPago(actual.clienteId, plan, data.metodoPago, data.referencia);
  }

  res.status(201).json(await obtenerSuscripcion(resultado.id));
  notificarPago(actual.cliente.usuario, plan, data.metodoPago, resultado.fechaFin);
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

// --- Helpers ---------------------------------------------------------------

async function crearSuscripcionConPago(
  clienteId: bigint,
  plan: Plan,
  metodoPago: MetodoPago,
  referencia: string | undefined,
): Promise<{ id: bigint; fechaFin: Date }> {
  const fechaInicio = hoyGuatemala();
  const fechaFin = sumarDias(fechaInicio, plan.duracionDias);

  const nueva = await prisma.$transaction(async (tx) => {
    // Una suscripción puede seguir ACTIVA aunque ya venció si el cron de las
    // 8am aún no corrió; se marca VENCIDA aquí, o chocaría con el índice de
    // una ACTIVA por cliente. Si tiene una ACTIVA vigente, el índice sí debe
    // rechazar la creación (para eso está "Renovar").
    await tx.suscripcion.updateMany({
      where: { clienteId, estado: 'ACTIVA', fechaFin: { lt: fechaInicio } },
      data: { estado: 'VENCIDA' },
    });
    const creada = await tx.suscripcion.create({
      data: { clienteId, planId: plan.id, fechaInicio, fechaFin, precioPagado: plan.precio, estado: 'ACTIVA' },
    });
    await tx.pago.create({
      data: { suscripcionId: creada.id, monto: plan.precio, metodo: metodoPago, referencia },
    });
    return creada;
  });

  return { id: nueva.id, fechaFin };
}

function obtenerSuscripcion(id: bigint) {
  return prisma.suscripcion.findUnique({ where: { id }, include: { plan: true, pagos: true } });
}

// El correo de confirmación no debe poder tumbar una operación que ya fue
// exitosa: se envía después de responder, y cualquier falla solo se loguea.
function notificarPago(
  usuario: { email: string; nombre: string; apellido: string },
  plan: Plan,
  metodoPago: MetodoPago,
  fechaFin: Date,
): void {
  enviarCorreoPagoConfirmado(usuario.email, {
    nombre: `${usuario.nombre} ${usuario.apellido}`,
    plan: plan.nombre,
    monto: Number(plan.precio),
    metodo: metodoPago,
    fechaFin: fechaFin.toISOString().slice(0, 10),
  }).catch((err) => console.error('[suscripciones] no se pudo enviar el correo de confirmación de pago:', err));
}

export default router;
