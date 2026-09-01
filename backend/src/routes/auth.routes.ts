import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isProduction } from '../config/env';
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken, RefreshTokenError } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/api/auth',
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten().fieldErrors });
  }
  const { email, password } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const credencialesInvalidas = () => res.status(401).json({ error: 'Email o contraseña incorrectos' });

  if (!usuario || !usuario.activo) {
    return credencialesInvalidas();
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    return credencialesInvalidas();
  }

  const tokens = await issueTokenPair(usuario.id, usuario.rol, req.ip);

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: tokens.refreshTokenExpiresAt,
  });

  res.json({
    accessToken: tokens.accessToken,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
    },
  });
});

router.post('/refresh', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawRefreshToken) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }

  try {
    const tokens = await rotateRefreshToken(rawRefreshToken, req.ip);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      expires: tokens.refreshTokenExpiresAt,
    });
    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    if (err instanceof RefreshTokenError) {
      res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }
});

router.post('/logout', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawRefreshToken) {
    await revokeRefreshToken(rawRefreshToken);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});

router.get('/me', authenticate, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
  if (!usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
  });
});

export default router;
