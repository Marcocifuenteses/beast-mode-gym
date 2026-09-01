import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { RolUsuario } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { parseDurationMs } from '../lib/duration';

export interface AccessTokenPayload {
  sub: string;
  rol: RolUsuario;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function signAccessToken(usuarioId: bigint, rol: RolUsuario): string {
  const payload: AccessTokenPayload = { sub: usuarioId.toString(), rol };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

function signRefreshToken(usuarioId: bigint, jti: string): string {
  const payload: RefreshTokenPayload = { sub: usuarioId.toString(), jti };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Emite un par access+refresh nuevo y persiste el refresh token en la DB. */
export async function issueTokenPair(
  usuarioId: bigint,
  rol: RolUsuario,
  createdByIp?: string,
): Promise<TokenPair> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: {
      id: jti,
      usuarioId,
      expiresAt,
      createdByIp,
    },
  });

  return {
    accessToken: signAccessToken(usuarioId, rol),
    refreshToken: signRefreshToken(usuarioId, jti),
    refreshTokenExpiresAt: expiresAt,
  };
}

export class RefreshTokenError extends Error {}

/**
 * Verifica y rota un refresh token. Si el token ya fue revocado (reutilizado
 * tras rotación), se interpreta como robo: se revocan todos los tokens del
 * usuario y se rechaza la solicitud.
 */
export async function rotateRefreshToken(rawRefreshToken: string, createdByIp?: string): Promise<TokenPair> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new RefreshTokenError('Refresh token inválido o expirado');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!stored || stored.expiresAt < new Date()) {
    throw new RefreshTokenError('Refresh token inválido o expirado');
  }

  if (stored.revokedAt) {
    // Reuso de un token ya rotado: posible robo, se revoca todo.
    await prisma.refreshToken.updateMany({
      where: { usuarioId: stored.usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new RefreshTokenError('Refresh token reutilizado, sesión revocada por seguridad');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: stored.usuarioId } });
  if (!usuario || !usuario.activo) {
    throw new RefreshTokenError('Usuario no encontrado o inactivo');
  }

  const nuevoPar = await issueTokenPair(usuario.id, usuario.rol, createdByIp);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByTokenId: extractJti(nuevoPar.refreshToken) },
  });

  return nuevoPar;
}

export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return;
  }
  await prisma.refreshToken.updateMany({
    where: { id: payload.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function extractJti(refreshToken: string): string {
  const decoded = jwt.decode(refreshToken) as RefreshTokenPayload | null;
  if (!decoded) throw new Error('No se pudo decodificar el refresh token recién emitido');
  return decoded.jti;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
