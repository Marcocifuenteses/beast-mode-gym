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

/** Envía "por vencer" a las suscripciones que vencen en exactamente 5 días y aún no tienen el aviso automático. */
export async function procesarRecordatoriosPorVencer(): Promise<number> {
  const objetivo = sumarDias(hoyGuatemala(), DIAS_AVISO_POR_VENCER);

  const candidatas = await prisma.suscripcion.findMany({
    where: {
      estado: 'ACTIVA',
      fechaFin: objetivo,
      recordatorios: { none: { tipo: 'POR_VENCER', enviadoPor: null } },
    },
    include: { cliente: { include: { usuario: true } }, plan: true },
  });

  for (const s of candidatas) {
    await enviarCorreoPorVencer(s.cliente.usuario.email, {
      nombre: `${s.cliente.usuario.nombre} ${s.cliente.usuario.apellido}`,
      plan: s.plan.nombre,
      diasRestantes: DIAS_AVISO_POR_VENCER,
      monto: Number(s.precioPagado),
    });
    await prisma.recordatorio.create({
      data: { clienteId: s.clienteId, suscripcionId: s.id, tipo: 'POR_VENCER' },
    });
  }

  return candidatas.length;
}

/** Envía "vencida" a las suscripciones VENCIDA que aún no tienen el aviso automático. */
export async function procesarRecordatoriosVencidas(): Promise<number> {
  const candidatas = await prisma.suscripcion.findMany({
    where: {
      estado: 'VENCIDA',
      recordatorios: { none: { tipo: 'VENCIDA', enviadoPor: null } },
    },
    include: { cliente: { include: { usuario: true } }, plan: true },
  });

  for (const s of candidatas) {
    await enviarCorreoVencida(s.cliente.usuario.email, {
      nombre: `${s.cliente.usuario.nombre} ${s.cliente.usuario.apellido}`,
      plan: s.plan.nombre,
      fechaVencimiento: s.fechaFin.toISOString().slice(0, 10),
      monto: Number(s.precioPagado),
    });
    await prisma.recordatorio.create({
      data: { clienteId: s.clienteId, suscripcionId: s.id, tipo: 'VENCIDA' },
    });
  }

  return candidatas.length;
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
    const diasRestantes = Math.ceil((s.fechaFin.getTime() - hoyGuatemala().getTime()) / (24 * 60 * 60 * 1000));
    await enviarCorreoPorVencer(s.cliente.usuario.email, {
      nombre,
      plan: s.plan.nombre,
      diasRestantes,
      monto: Number(s.precioPagado),
    });
  } else {
    await enviarCorreoVencida(s.cliente.usuario.email, {
      nombre,
      plan: s.plan.nombre,
      fechaVencimiento: s.fechaFin.toISOString().slice(0, 10),
      monto: Number(s.precioPagado),
    });
  }

  await prisma.recordatorio.create({
    data: { clienteId: s.clienteId, suscripcionId: s.id, tipo, enviadoPor },
  });
}
