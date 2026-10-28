import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerido'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RESEND_API_KEY: z.string().default(''),
  // Remitente de los correos. onboarding@resend.dev funciona sin dominio propio,
  // pero Resend solo entrega a la dirección dueña de la cuenta.
  EMAIL_REMITENTE: z.string().default('BEAST MODE <onboarding@resend.dev>'),
  // Modo pruebas: si se define, TODOS los correos se envían a esta dirección
  // (indicando a quién iban). Necesario mientras no haya un dominio verificado.
  EMAIL_DESTINO_PRUEBAS: z.union([z.literal(''), z.string().email()]).default(''),
  // URL pública del frontend, para los enlaces de los correos.
  APP_URL: z.string().url().default('http://localhost:4200'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  AFORO_CAPACIDAD: z.coerce.number().int().positive().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
