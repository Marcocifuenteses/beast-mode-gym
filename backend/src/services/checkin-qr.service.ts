import jwt from 'jsonwebtoken';
import { createHmac, randomBytes } from 'crypto';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

/** Cada QR vale este tiempo; el frontend del socio pide uno nuevo antes de que caduque. */
export const QR_VIGENCIA_SEGUNDOS = 45;

const AUDIENCIA = 'checkin-qr';

// Clave propia derivada de JWT_SECRET: si los QR se firmaran con la misma clave
// que los access tokens, verifyAccessToken (que no revisa audiencia) aceptaría
// un QR como sesión válida. Con una clave distinta, ninguno sirve como el otro.
const CLAVE_QR = createHmac('sha256', env.JWT_SECRET).update(AUDIENCIA).digest();

interface QrPayload {
  sub: string;
  jti: string;
}

export function generarTokenQr(clienteId: bigint): { token: string; expiraEn: Date } {
  // jti corto (12 caracteres aleatorios) en vez de un UUID: basta para que no se
  // repita en los segundos que vive el QR, y un token más corto da un QR menos
  // denso que las cámaras leen más rápido.
  const jti = randomBytes(9).toString('base64url');
  const token = jwt.sign({ sub: clienteId.toString(), jti } satisfies QrPayload, CLAVE_QR, {
    audience: AUDIENCIA,
    expiresIn: QR_VIGENCIA_SEGUNDOS,
  });
  return { token, expiraEn: new Date(Date.now() + QR_VIGENCIA_SEGUNDOS * 1000) };
}

// QR ya usados (jti → vencimiento en ms). Un mismo QR no puede registrar dos
// movimientos: evita que un doble escaneo marque entrada y salida seguidas, o
// que se reutilice una captura de pantalla mientras sigue vigente. Vive en
// memoria porque los QR caducan en segundos; con varias instancias del backend
// habría que moverlo a la DB o a Redis.
const usados = new Map<string, number>();

function limpiarUsados(ahora: number): void {
  for (const [jti, vence] of usados) {
    if (vence <= ahora) usados.delete(jti);
  }
}

/** Valida un QR de check-in y lo marca como usado. Devuelve el id del cliente. */
export function consumirTokenQr(token: string): bigint {
  let payload: QrPayload & { exp: number };
  try {
    payload = jwt.verify(token, CLAVE_QR, { audience: AUDIENCIA }) as QrPayload & { exp: number };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(400, 'Este QR ya caducó. Pide al socio que lo actualice en su app.');
    }
    throw new AppError(400, 'QR no válido');
  }

  const ahora = Date.now();
  limpiarUsados(ahora);
  if (usados.has(payload.jti)) {
    throw new AppError(409, 'Este QR ya se usó. Espera a que se genere uno nuevo.');
  }
  usados.set(payload.jti, payload.exp * 1000);

  return BigInt(payload.sub);
}
