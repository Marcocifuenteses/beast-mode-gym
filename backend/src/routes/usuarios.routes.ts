import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';

const router = Router();

// Gestión de cuentas de personal (ADMIN, ENTRENADOR) — separado de /clientes,
// que gestiona las cuentas SUSCRIPTOR (siempre ligadas a un registro Cliente).
router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === 'true';
  const staff = await prisma.usuario.findMany({
    where: { rol: { in: ['ADMIN', 'ENTRENADOR'] }, ...(incluirInactivos ? {} : { activo: true }) },
    select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true, creadoEn: true },
    orderBy: { creadoEn: 'desc' },
  });
  res.json(staff);
});

const crearStaffSchema = z.object({
  nombre: z.string().min(1).max(60),
  apellido: z.string().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(['ADMIN', 'ENTRENADOR']),
});

router.post('/', async (req, res) => {
  const data = crearStaffSchema.parse(req.body);

  const usuario = await prisma.usuario.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, 10),
      rol: data.rol,
    },
    select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true, creadoEn: true },
  });

  res.status(201).json(usuario);
});

router.delete('/:id', async (req, res) => {
  const id = parseBigIntParam(req.params.id);

  if (req.user!.id === id) {
    throw new AppError(400, 'No puedes desactivar tu propia cuenta');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !['ADMIN', 'ENTRENADOR'].includes(usuario.rol)) {
    throw new NotFoundError('Usuario de staff');
  }

  await prisma.usuario.update({ where: { id }, data: { activo: false } });
  res.status(204).send();
});

export default router;
