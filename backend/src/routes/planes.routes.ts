import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === 'true';
  const planes = await prisma.plan.findMany({
    where: incluirInactivos ? undefined : { activo: true },
    orderBy: { precio: 'asc' },
  });
  res.json(planes);
});

const planSchema = z.object({
  nombre: z.string().min(1).max(60),
  descripcion: z.string().optional(),
  precio: z.number().nonnegative(),
  duracionDias: z.number().int().positive(),
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const data = planSchema.parse(req.body);
  const plan = await prisma.plan.create({ data });
  res.status(201).json(plan);
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const data = planSchema.partial().parse(req.body);
  const plan = await prisma.plan.update({ where: { id }, data });
  res.json(plan);
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const existente = await prisma.plan.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Plan');
  const plan = await prisma.plan.update({ where: { id }, data: { activo: false } });
  res.json(plan);
});

export default router;
