import { prisma } from '../lib/prisma';
import { hoyGuatemala, sumarDias } from '../lib/fecha';
import { NotFoundError } from '../lib/errors';
import { enviarCorreoPorVencer, enviarCorreoVencida } from './email.service';
import type { TipoRecordatorio } from '@prisma/client';

const DIAS_AVISO_POR_VENCER = 5;

/** Transiciona a VENCIDA las suscripciones ACTIVA cuya fecha_fin ya pasó. */
export async function marcarSuscripcionesVencidas(): Promise<number> {
  const hoy = hoyGuatemala();
  const { count } = await prisma.suscripcion.updateMany({
    where: { estado: 'ACTIVA', fechaFin: { lt: hoy } },
    data: { estado: 'VENCIDA' },
  });
  return count;
}

/**
 * Envía "por vencer" a las suscripciones que vencen en los próximos 5 días y aún
 * no tienen el aviso automático. Es una ventana y no "exactamente en 5 días"
 * porque en un hosting gratis el servidor puede estar dormido justo ese día.
 */
export async function procesarRecordatoriosPorVencer(): Promise<number> {
  const hoy = hoyGuatemala();

  const candidatas = await prisma.suscripcion.findMany({
    where: {
      estado: 'ACTIVA',
      fechaFin: { gte: hoy, lte: sumarDias(hoy, DIAS_AVISO_POR_VENCER) },
      recordatorios: { none: { tipo: 'POR_VENCER', enviadoPor: null } },
      cliente: { activo: true },
    },
    include: { cliente: { include: { usuario: true } }, plan: true },
  });

  return enviarLote(candidatas, 'POR_VENCER', (s) =>
    enviarCorreoPorVencer(s.cliente.usuario.email, {
      nombre: `${s.cliente.usuario.nombre} ${s.cliente.usuario.apellido}`,
      plan: s.plan.nombre,
      diasRestantes: diasHasta(s.fechaFin),
      monto: Number(s.plan.precio),
    }),
  );
}

/**
 * Envía "vencida" a las suscripciones VENCIDA que aún no tienen el aviso automático,
 * salvo que el cliente ya haya renovado (tiene otra suscripción ACTIVA). Solo se
 * avisa por la suscripción más reciente de cada cliente: quien compró varias
 * visitas de un día recibiría si no un correo por cada una.
 */
export async function procesarRecordatoriosVencidas(): Promise<number> {
  const encontradas = await prisma.suscripcion.findMany({
    where: {
      estado: 'VENCIDA',
      recordatorios: { none: { tipo: 'VENCIDA', enviadoPor: null } },
      cliente: { activo: true, suscripciones: { none: { estado: 'ACTIVA' } } },
    },
    include: {
      cliente: {
        include: {
          usuario: true,
          suscripciones: { where: { estado: { not: 'CANCELADA' } }, orderBy: { fechaFin: 'desc' }, take: 1, select: { id: true } },
        },
      },
      plan: true,
    },
  });
  const candidatas = encontradas.filter((s) => s.cliente.suscripciones[0]?.id === s.id);

  return enviarLote(candidatas, 'VENCIDA', (s) =>
    enviarCorreoVencida(s.cliente.usuario.email, {
      nombre: `${s.cliente.usuario.nombre} ${s.cliente.usuario.apellido}`,
      plan: s.plan.nombre,
      fechaVencimiento: s.fechaFin.toISOString().slice(0, 10),
      monto: Number(s.plan.precio),
    }),
  );
}

/**
 * Envía un aviso automático por suscripción y lo registra. Si un correo falla
 * (dirección inválida, límite de Resend...), se registra el error y se sigue
 * con los demás; ese aviso queda pendiente para la próxima corrida.
 */
async function enviarLote<T extends { id: bigint; clienteId: bigint }>(
  candidatas: T[],
  tipo: TipoRecordatorio,
  enviarCorreo: (s: T) => Promise<void>,
): Promise<number> {
  let enviados = 0;
  for (const s of candidatas) {
    try {
      await enviarCorreo(s);
      await prisma.recordatorio.create({ data: { clienteId: s.clienteId, suscripcionId: s.id, tipo } });
      enviados++;
    } catch (err) {
      console.error(`[recordatorios] no se pudo enviar ${tipo} (suscripción ${s.id}):`, err instanceof Error ? err.message : err);
    }
  }
  return enviados;
}

function diasHasta(fechaFin: Date): number {
  return Math.round((fechaFin.getTime() - hoyGuatemala().getTime()) / (24 * 60 * 60 * 1000));
}

/** Corrida completa del día: marcar vencidas, luego enviar ambos tipos de aviso. */
export async function ejecutarRecordatoriosDiarios() {
  const marcadas = await marcarSuscripcionesVencidas();
  const porVencer = await procesarRecordatoriosPorVencer();
  const vencidas = await procesarRecordatoriosVencidas();
  console.log(
    `[recordatorios] suscripciones marcadas vencidas: ${marcadas}, avisos por_vencer: ${porVencer}, avisos vencida: ${vencidas}`,
  );
  return { marcadas, porVencer, vencidas };
}

/** Envío manual desde el panel: siempre se registra, puede repetirse (enviadoPor != null). */
export async function enviarRecordatorioManual(suscripcionId: bigint, tipo: TipoRecordatorio, enviadoPor: bigint) {
  const s = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
    include: { cliente: { include: { usuario: true } }, plan: true },
  });
  if (!s) throw new NotFoundError('Suscripción');

  const nombre = `${s.cliente.usuario.nombre} ${s.cliente.usuario.apellido}`;

  if (tipo === 'POR_VENCER') {
    await enviarCorreoPorVencer(s.cliente.usuario.email, {
      nombre,
      plan: s.plan.nombre,
      diasRestantes: diasHasta(s.fechaFin),
      monto: Number(s.plan.precio),
    });
  } else {
    await enviarCorreoVencida(s.cliente.usuario.email, {
      nombre,
      plan: s.plan.nombre,
      fechaVencimiento: s.fechaFin.toISOString().slice(0, 10),
      monto: Number(s.plan.precio),
    });
  }

  await prisma.recordatorio.create({
    data: { clienteId: s.clienteId, suscripcionId: s.id, tipo, enviadoPor },
  });
}
