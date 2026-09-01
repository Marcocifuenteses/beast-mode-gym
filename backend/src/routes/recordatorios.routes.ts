import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { parseBigIntParam } from '../lib/params';
import { enviarRecordatorioManual, ejecutarRecordatoriosDiarios } from '../services/recordatorios.service';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'ENTRENADOR'));

router.get('/', async (req, res) => {
  const suscripcionId =
    typeof req.query.suscripcionId === 'string' ? parseBigIntParam(req.query.suscripcionId) : undefined;

  const recordatorios = await prisma.recordatorio.findMany({
    where: suscripcionId ? { suscripcionId } : undefined,
    orderBy: { fechaEnvio: 'desc' },
  });
  res.json(recordatorios);
});

const enviarManualSchema = z.object({
  suscripcionId: z.coerce.bigint(),
  tipo: z.enum(['POR_VENCER', 'VENCIDA']),
});

// Botón "Enviar recordatorio" del panel de clientes.
router.post('/enviar', async (req, res) => {
  const data = enviarManualSchema.parse(req.body);
  await enviarRecordatorioManual(data.suscripcionId, data.tipo, req.user!.id);
  res.status(201).json({ ok: true });
});

// Dispara manualmente la corrida completa del día (misma lógica que el cron
// de las 8am). Útil para pruebas y para forzar una corrida fuera de horario.
router.post('/procesar-ahora', requireRole('ADMIN'), async (_req, res) => {
  const resultado = await ejecutarRecordatoriosDiarios();
  res.json(resultado);
});

export default router;
