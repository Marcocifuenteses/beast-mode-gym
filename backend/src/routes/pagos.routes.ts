import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'ENTRENADOR'));

router.get('/', async (req, res) => {
  const suscripcionId =
    typeof req.query.suscripcionId === 'string' ? parseBigIntParam(req.query.suscripcionId) : undefined;

  const pagos = await prisma.pago.findMany({
    where: suscripcionId ? { suscripcionId } : undefined,
    orderBy: { fechaPago: 'desc' },
  });
  res.json(pagos);
});

const crearPagoSchema = z.object({
  suscripcionId: z.coerce.bigint(),
  monto: z.number().positive(),
  metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA']).default('EFECTIVO'),
  referencia: z.string().max(80).optional(),
});

router.post('/', async (req, res) => {
  const data = crearPagoSchema.parse(req.body);

  const suscripcion = await prisma.suscripcion.findUnique({ where: { id: data.suscripcionId } });
  if (!suscripcion) throw new NotFoundError('Suscripción');

  const pago = await prisma.pago.create({ data });
  res.status(201).json(pago);
});

export default router;
