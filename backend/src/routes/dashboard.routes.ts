import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { diaGuatemala, hoyGuatemala, inicioDiaGuatemala, inicioMesGuatemala, sumarDias } from '../lib/fecha';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'ENTRENADOR'));

const DIAS_GRAFICA = 30;

// Todos los cortes ("hoy", "este mes", "por día") son en hora de Guatemala: el
// servidor en la nube corre en UTC, y sin esto lo que pasa después de las 6pm
// se contaría como del día siguiente.
router.get('/', async (_req, res) => {
  const hoy = hoyGuatemala(); // fecha calendario, para comparar con columnas DATE
  const inicioHoy = inicioDiaGuatemala(0);
  const inicioManana = inicioDiaGuatemala(1);
  const inicioGrafica = inicioDiaGuatemala(-(DIAS_GRAFICA - 1));

  const [clientesActivos, vencenEn7Dias, ingresosDelMes, asistenciasHoy, asistenciasGrafica] = await Promise.all([
    // Vigentes de verdad: ACTIVA y sin vencer (el cron puede no haber corrido aún).
    prisma.suscripcion.count({ where: { estado: 'ACTIVA', fechaFin: { gte: hoy }, cliente: { activo: true } } }),
    prisma.suscripcion.count({
      where: { estado: 'ACTIVA', fechaFin: { gte: hoy, lte: sumarDias(hoy, 7) }, cliente: { activo: true } },
    }),
    prisma.pago.aggregate({
      _sum: { monto: true },
      where: { fechaPago: { gte: inicioMesGuatemala() } },
    }),
    prisma.asistencia.count({ where: { entrada: { gte: inicioHoy, lt: inicioManana } } }),
    prisma.asistencia.findMany({
      where: { entrada: { gte: inicioGrafica } },
      select: { entrada: true },
    }),
  ]);

  const porDia = new Map<string, number>();
  for (const { entrada } of asistenciasGrafica) {
    const clave = diaGuatemala(entrada);
    porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
  }
  // Los últimos 30 días, terminando hoy.
  const grafica30Dias = Array.from({ length: DIAS_GRAFICA }, (_, i) => {
    const clave = sumarDias(hoy, i - (DIAS_GRAFICA - 1)).toISOString().slice(0, 10);
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
