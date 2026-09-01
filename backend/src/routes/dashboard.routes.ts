import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'ENTRENADOR'));

router.get('/', async (_req, res) => {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finHoy = new Date(inicioHoy.getTime() + 24 * 60 * 60 * 1000);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const en7Dias = new Date(inicioHoy.getTime() + 7 * 24 * 60 * 60 * 1000);
  const hace30Dias = new Date(inicioHoy.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [clientesActivos, vencenEn7Dias, ingresosDelMes, asistenciasHoy, asistenciasUltimos30Dias] =
    await Promise.all([
      prisma.suscripcion.count({ where: { estado: 'ACTIVA' } }),
      prisma.suscripcion.count({
        where: { estado: 'ACTIVA', fechaFin: { gte: inicioHoy, lte: en7Dias } },
      }),
      prisma.pago.aggregate({
        _sum: { monto: true },
        where: { fechaPago: { gte: inicioMes } },
      }),
      prisma.asistencia.count({ where: { entrada: { gte: inicioHoy, lt: finHoy } } }),
      prisma.asistencia.findMany({
        where: { entrada: { gte: hace30Dias } },
        select: { entrada: true },
      }),
    ]);

  const porDia = new Map<string, number>();
  for (const { entrada } of asistenciasUltimos30Dias) {
    const clave = entrada.toISOString().slice(0, 10);
    porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
  }
  const grafica30Dias = Array.from({ length: 30 }, (_, i) => {
    const fecha = new Date(hace30Dias.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
    const clave = fecha.toISOString().slice(0, 10);
    return { fecha: clave, asistencias: porDia.get(clave) ?? 0 };
  });

  res.json({
    clientesActivos,
    vencenEn7Dias,
    ingresosDelMes: ingresosDelMes._sum.monto ?? 0,
    asistenciasHoy,
    grafica30Dias,
  });
});

export default router;
