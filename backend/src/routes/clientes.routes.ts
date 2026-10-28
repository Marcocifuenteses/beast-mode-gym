import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { AppError, NotFoundError } from '../lib/errors';
import { parseBigIntParam } from '../lib/params';
import { generarTokenQr, QR_VIGENCIA_SEGUNDOS } from '../services/checkin-qr.service';
import { enviarCorreoBienvenida } from '../services/email.service';

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
  email: z.string().trim().toLowerCase().email(),
  // Opcional: si no se da, se genera una temporal y se le envía al socio.
  password: z.string().min(6).optional(),
  telefono: z.string().max(20).optional(),
  dpi: z.string().regex(/^\d{13}$/).optional(),
  fechaNacimiento: z.coerce.date().optional(),
});

router.post('/', requireRole('ADMIN', 'ENTRENADOR'), async (req, res) => {
  const data = crearClienteSchema.parse(req.body);
  const passwordTemporal = data.password ? null : generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(data.password ?? passwordTemporal!, 10);

  // El código se calcula a partir del último; si dos altas simultáneas obtienen
  // el mismo, el índice único lo rechaza y se reintenta con el siguiente.
  let usuario;
  for (let intento = 1; ; intento++) {
    try {
      usuario = await prisma.usuario.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          passwordHash,
          rol: 'SUSCRIPTOR',
          cliente: {
            create: {
              codigo: await generarCodigoCliente(),
              telefono: data.telefono,
              dpi: data.dpi,
              fechaNacimiento: data.fechaNacimiento,
            },
          },
        },
        include: { cliente: true },
      });
      break;
    } catch (err) {
      const chocoCodigo =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        String(err.meta?.target).includes('codigo');
      if (!chocoCodigo || intento >= 3) throw err;
    }
  }

  const cliente = await obtenerClienteCompleto(usuario.cliente!.id);
  // La contraseña temporal se devuelve una sola vez, para que recepción se la dé al socio.
  res.status(201).json({ ...cliente, passwordTemporal });

  // El correo de bienvenida no debe poder tumbar un alta que ya fue exitosa.
  enviarCorreoBienvenida(usuario.email, {
    nombre: `${usuario.nombre} ${usuario.apellido}`,
    email: usuario.email,
    codigo: usuario.cliente!.codigo,
    passwordTemporal: passwordTemporal ?? '(la que te indicaron en recepción)',
  }).catch((err) => console.error('[clientes] no se pudo enviar el correo de bienvenida:', err));
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
  const ultimo = await prisma.cliente.findFirst({
    where: { codigo: { startsWith: 'CLI-' } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });
  const siguiente = (ultimo ? Number(ultimo.codigo.slice(4)) || 0 : 0) + 1;
  return `CLI-${String(siguiente).padStart(4, '0')}`;
}

/** Contraseña temporal fácil de dictar: sin caracteres que se confunden (0/O, 1/l/I). */
function generarPasswordTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const elegir = (alfabeto: string, n: number) =>
    Array.from({ length: n }, () => alfabeto[randomInt(alfabeto.length)]).join('');
  return `Gym-${elegir('23456789', 4)}-${elegir(letras, 3)}`;
}

export default router;
