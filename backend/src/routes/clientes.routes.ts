import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';
import { generarTokenQr, QR_VIGENCIA_SEGUNDOS } from '../services/checkin-qr.service';

const router = Router();

router.use(authenticate);

// --- Panel de clientes (ADMIN, ENTRENADOR) -------------------------------

router.get('/', requireRole('ADMIN', 'ENTRENADOR'), async (req, res) => {
  const estado = typeof req.query.estado === 'string' ? req.query.estado.toUpperCase() : undefined;
  const busqueda = typeof req.query.busqueda === 'string' ? req.query.busqueda.trim() : undefined;

  const [panel, visitasAbiertas] = await Promise.all([
    prisma.vPanelClientes.findMany({
      where: {
        ...(estado ? { semaforo: estado } : {}),
        ...(busqueda
          ? {
              OR: [
                { nombre: { contains: busqueda, mode: 'insensitive' } },
                { apellido: { contains: busqueda, mode: 'insensitive' } },
                { email: { contains: busqueda, mode: 'insensitive' } },
                { codigo: { contains: busqueda, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { diasRestantes: 'asc' },
    }),
    prisma.asistencia.findMany({ where: { salida: null }, select: { clienteId: true } }),
  ]);

  const dentro = new Set(visitasAbiertas.map((v) => v.clienteId));
  res.json(panel.map((c) => ({ ...c, dentro: c.clienteId !== null && dentro.has(c.clienteId) })));
});

// --- Vista propia (SUSCRIPTOR) -------------------------------------------
// Va antes de "/:id" a propósito, aunque Express no las confundiría (distinto
// número de segmentos): mantiene juntas las rutas propias del suscriptor.

router.get('/me/perfil', requireRole('SUSCRIPTOR'), async (req, res) => {
  const cliente = await prisma.cliente.findUnique({ where: { usuarioId: req.user!.id } });
  if (!cliente) throw new AppError(404, 'No tienes un perfil de cliente asociado');

  const [panel, historialAsistencias] = await Promise.all([
    prisma.vPanelClientes.findFirst({ where: { clienteId: cliente.id } }),
    prisma.asistencia.findMany({
      where: { clienteId: cliente.id },
      orderBy: { entrada: 'desc' },
      take: 30,
    }),
  ]);

  res.json({ perfil: panel, historialAsistencias });
});

// QR de acceso del socio: token firmado de vida corta que el entrenador escanea
// en el check-in. Se pide uno nuevo antes de que caduque (ver checkin-qr.service).
router.get('/me/qr', requireRole('SUSCRIPTOR'), async (req, res) => {
  const cliente = await prisma.cliente.findUnique({ where: { usuarioId: req.user!.id } });
  if (!cliente || !cliente.activo) throw new AppError(404, 'No tienes un perfil de cliente asociado');

  const { token, expiraEn } = generarTokenQr(cliente.id);
  res.set('Cache-Control', 'no-store');
  res.json({ token, expiraEn, vigenciaSegundos: QR_VIGENCIA_SEGUNDOS, codigo: cliente.codigo });
});

// --- Detalle / alta / edición / baja (ADMIN, ENTRENADOR) ------------------

router.get('/:id', requireRole('ADMIN', 'ENTRENADOR'), async (req, res) => {
  const cliente = await obtenerClienteCompleto(parseBigIntParam(req.params.id));
  if (!cliente) throw new NotFoundError('Cliente');
  res.json(cliente);
});

const crearClienteSchema = z.object({
  nombre: z.string().min(1).max(60),
  apellido: z.string().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(6).default('cambiar123'),
  telefono: z.string().max(20).optional(),
  dpi: z.string().regex(/^\d{13}$/).optional(),
  fechaNacimiento: z.coerce.date().optional(),
});

router.post('/', requireRole('ADMIN', 'ENTRENADOR'), async (req, res) => {
  const data = crearClienteSchema.parse(req.body);
  const codigo = await generarCodigoCliente();

  const usuario = await prisma.usuario.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, 10),
      rol: 'SUSCRIPTOR',
      cliente: {
        create: {
          codigo,
          telefono: data.telefono,
          dpi: data.dpi,
          fechaNacimiento: data.fechaNacimiento,
        },
      },
    },
    include: { cliente: true },
  });

  res.status(201).json(await obtenerClienteCompleto(usuario.cliente!.id));
});

const actualizarClienteSchema = z.object({
  nombre: z.string().min(1).max(60).optional(),
  apellido: z.string().min(1).max(60).optional(),
  telefono: z.string().max(20).optional(),
  dpi: z.string().regex(/^\d{13}$/).optional(),
  fechaNacimiento: z.coerce.date().optional(),
});

router.put('/:id', requireRole('ADMIN', 'ENTRENADOR'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const data = actualizarClienteSchema.parse(req.body);
  const { nombre, apellido, ...clienteData } = data;

  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) throw new NotFoundError('Cliente');

  await prisma.$transaction([
    prisma.cliente.update({ where: { id }, data: clienteData }),
    ...(nombre || apellido
      ? [prisma.usuario.update({ where: { id: cliente.usuarioId }, data: { nombre, apellido } })]
      : []),
  ]);

  res.json(await obtenerClienteCompleto(id));
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseBigIntParam(req.params.id);
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) throw new NotFoundError('Cliente');

  await prisma.$transaction([
    prisma.cliente.update({ where: { id }, data: { activo: false } }),
    prisma.usuario.update({ where: { id: cliente.usuarioId }, data: { activo: false } }),
  ]);

  res.status(204).send();
});

// --- Helpers ---------------------------------------------------------------

async function obtenerClienteCompleto(clienteId: bigint) {
  const panel = await prisma.vPanelClientes.findFirst({ where: { clienteId } });
  if (!panel) return null;
  const [historialSuscripciones, visitaAbierta] = await Promise.all([
    prisma.suscripcion.findMany({
      where: { clienteId },
      include: { plan: true },
      orderBy: { fechaInicio: 'desc' },
    }),
    prisma.asistencia.findFirst({ where: { clienteId, salida: null }, select: { id: true } }),
  ]);
  return { ...panel, dentro: visitaAbierta !== null, historialSuscripciones };
}

async function generarCodigoCliente(): Promise<string> {
  const total = await prisma.cliente.count();
  return `CLI-${String(total + 1).padStart(4, '0')}`;
}

export default router;
