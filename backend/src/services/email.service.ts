import { Resend } from 'resend';
import { env } from '../config/env';

// Sin RESEND_API_KEY no se puede instanciar un cliente real; en ese caso se
// loguea el correo en vez de enviarlo, para que el resto del flujo (registrar
// el recordatorio, correr el cron) siga siendo probable en desarrollo.
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// El plan gratis de Resend acepta 2 envíos por segundo: los correos salen en
// fila, con una pausa mínima entre uno y otro (p. ej. en la corrida diaria).
const PAUSA_ENTRE_ENVIOS_MS = 600;
let colaEnvios: Promise<unknown> = Promise.resolve();

export interface DatosPorVencer {
  nombre: string;
  plan: string;
  diasRestantes: number;
  monto: number;
}

export interface DatosVencida {
  nombre: string;
  plan: string;
  fechaVencimiento: string;
  monto: number;
}

export interface DatosPagoConfirmado {
  nombre: string;
  plan: string;
  monto: number;
  metodo: string;
  fechaFin: string;
}

export interface DatosBienvenida {
  nombre: string;
  email: string;
  codigo: string;
  passwordTemporal: string;
}

// --- Utilidades ------------------------------------------------------------

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "2026-11-26" → "26/11/2026". */
function fechaLegible(isoFecha: string): string {
  const [y, m, d] = isoFecha.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const quetzales = (monto: number) => `Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const metodoLegible = (metodo: string) => (metodo === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo');

// --- Layout compartido: misma marca que la interfaz (verde), una sola columna
// de ancho fluido para verse bien en el teléfono y en la computadora. ---------

function filaDato(etiqueta: string, valor: string): string {
  return `
    <tr>
      <td style="padding:7px 0;color:#5f6b68;font-size:13px;">${etiqueta}</td>
      <td style="padding:7px 0;color:#172120;font-size:13px;font-weight:700;text-align:right;">${valor}</td>
    </tr>`;
}

function badge(texto: string, color: string, fondo: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${color};background:${fondo};">${texto}</span>`;
}

function documento(opciones: {
  titulo: string;
  badgeHtml: string;
  cuerpoHtml: string;
  filasHtml: string;
  boton?: { texto: string; url: string };
  avisoPruebas?: string;
}): string {
  const { titulo, badgeHtml, cuerpoHtml, filasHtml, boton, avisoPruebas } = opciones;
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BEAST MODE</title>
  </head>
  <body style="margin:0;padding:0;background:#eef0ec;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:24px 12px;">
      ${
        avisoPruebas
          ? `<div style="max-width:520px;margin:0 auto 12px;padding:10px 14px;border-radius:10px;background:#f8ebd0;color:#9a6206;font-size:12px;">${avisoPruebas}</div>`
          : ''
      }
      <div style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6dbd6;">
        <div style="background:#1e6b57;padding:26px 24px;text-align:center;">
          <div style="font-size:28px;line-height:1;margin-bottom:6px;">🏋️</div>
          <div style="font-weight:900;letter-spacing:3px;font-size:22px;color:#ffffff;text-transform:uppercase;">Beast&nbsp;Mode</div>
        </div>

        <div style="padding:26px 24px 8px;">
          <div style="margin-bottom:14px;">${badgeHtml}</div>
          <h1 style="margin:0 0 12px;font-size:19px;color:#172120;">${titulo}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151;">${cuerpoHtml}</div>

          <table role="presentation" width="100%" style="margin-top:20px;background:#f4f6f3;border-radius:12px;padding:4px 16px;border-collapse:collapse;">
            ${filasHtml}
          </table>

          ${
            boton
              ? `<div style="text-align:center;margin:24px 0 8px;">
                   <a href="${boton.url}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#1e6b57;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">${boton.texto}</a>
                 </div>`
              : ''
          }
        </div>

        <div style="padding:18px 24px;background:#f4f6f3;text-align:center;border-top:1px solid #d6dbd6;margin-top:20px;">
          <span style="font-size:11px;color:#5f6b68;">Mensaje automático de BEAST MODE — por favor no respondas a este correo.</span>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

const botonApp = (texto: string, ruta = '/login') => ({ texto, url: `${env.APP_URL.replace(/\/$/, '')}${ruta}` });

// --- Plantillas --------------------------------------------------------------

export function plantillaPorVencer(d: DatosPorVencer, avisoPruebas?: string): string {
  const diasTexto = d.diasRestantes <= 0 ? 'hoy' : `en ${d.diasRestantes} día${d.diasRestantes === 1 ? '' : 's'}`;
  return documento({
    titulo: `Tu membresía vence ${diasTexto}`,
    badgeHtml: badge('POR VENCER', '#9a6206', '#f8ebd0'),
    cuerpoHtml: `<p style="margin:0 0 8px;">Hola <strong>${escapar(d.nombre)}</strong>,</p>
     <p style="margin:0;">Tu plan está a punto de vencer. Pasa a recepción para renovarlo y seguir entrenando sin interrupciones: los días que te quedan no se pierden.</p>`,
    filasHtml: filaDato('Plan', escapar(d.plan)) + filaDato('Vence', diasTexto) + filaDato('Monto de renovación', quetzales(d.monto)),
    boton: botonApp('Ver mi membresía', '/mi-cuenta'),
    avisoPruebas,
  });
}

export function plantillaVencida(d: DatosVencida, avisoPruebas?: string): string {
  return documento({
    titulo: 'Tu membresía ha vencido',
    badgeHtml: badge('VENCIDA', '#b23a2e', '#f6deda'),
    cuerpoHtml: `<p style="margin:0 0 8px;">Hola <strong>${escapar(d.nombre)}</strong>,</p>
     <p style="margin:0;">Tu acceso al gimnasio está pausado. Renueva tu membresía en recepción cuando quieras para recuperarlo.</p>`,
    filasHtml:
      filaDato('Plan', escapar(d.plan)) + filaDato('Venció el', fechaLegible(d.fechaVencimiento)) + filaDato('Monto de renovación', quetzales(d.monto)),
    boton: botonApp('Ver mi membresía', '/mi-cuenta'),
    avisoPruebas,
  });
}

export function plantillaPagoConfirmado(d: DatosPagoConfirmado, avisoPruebas?: string): string {
  return documento({
    titulo: '¡Pago confirmado!',
    badgeHtml: badge('PAGO CONFIRMADO', '#1e7a4c', '#ddf0e4'),
    cuerpoHtml: `<p style="margin:0 0 8px;">Hola <strong>${escapar(d.nombre)}</strong>,</p>
     <p style="margin:0;">Registramos tu pago y tu membresía ya está activa. ¡Nos vemos en el gym! 💪</p>`,
    filasHtml:
      filaDato('Plan', escapar(d.plan)) +
      filaDato('Monto pagado', quetzales(d.monto)) +
      filaDato('Método', metodoLegible(d.metodo)) +
      filaDato('Vigente hasta', fechaLegible(d.fechaFin)),
    boton: botonApp('Mostrar mi QR de acceso', '/mi-cuenta/acceso'),
    avisoPruebas,
  });
}

export function plantillaBienvenida(d: DatosBienvenida, avisoPruebas?: string): string {
  return documento({
    titulo: '¡Bienvenido a BEAST MODE!',
    badgeHtml: badge('CUENTA CREADA', '#1e6b57', '#dcebe5'),
    cuerpoHtml: `<p style="margin:0 0 8px;">Hola <strong>${escapar(d.nombre)}</strong>,</p>
     <p style="margin:0;">Ya tienes tu cuenta de socio. Desde la app puedes ver tu membresía, el aforo del gym y mostrar tu QR para entrar. Te recomendamos cambiar la contraseña temporal en recepción.</p>`,
    filasHtml:
      filaDato('Correo', escapar(d.email)) +
      filaDato('Contraseña temporal', `<span style="font-family:monospace;font-size:15px;">${escapar(d.passwordTemporal)}</span>`) +
      filaDato('Código de socio', escapar(d.codigo)),
    boton: botonApp('Entrar a la app'),
    avisoPruebas,
  });
}

// --- Envío -----------------------------------------------------------------

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function enviar(
  destinatario: string,
  subject: string,
  plantilla: (avisoPruebas?: string) => string,
  logTag: string,
): Promise<void> {
  // En modo pruebas todo va a una sola bandeja, diciendo a quién iba dirigido.
  const redirigir = env.EMAIL_DESTINO_PRUEBAS && env.EMAIL_DESTINO_PRUEBAS !== destinatario;
  const para = redirigir ? env.EMAIL_DESTINO_PRUEBAS : destinatario;
  const html = plantilla(redirigir ? `<strong>Modo pruebas:</strong> este correo iba dirigido a <strong>${escapar(destinatario)}</strong>.` : undefined);

  if (!resend) {
    console.log(`[email:dev] ${logTag} -> ${destinatario}${redirigir ? ` (redirigido a ${para})` : ''}`);
    return;
  }

  const envio = colaEnvios.then(async () => {
    const resultado = await resend.emails.send({ from: env.EMAIL_REMITENTE, to: para, subject, html });
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
    if (resultado.error) {
      console.error(`[email] Resend rechazó el envío (${logTag} -> ${para}):`, resultado.error);
      throw new Error(`No se pudo enviar el correo: ${resultado.error.message}`);
    }
    console.log(`[email] ${logTag} enviado a ${para}${redirigir ? ` (original: ${destinatario})` : ''}`);
  });
  // La fila sigue aunque un envío falle; el error le llega a quien llamó.
  colaEnvios = envio.catch(() => undefined);
  await envio;
}

export async function enviarCorreoPorVencer(destinatario: string, datos: DatosPorVencer): Promise<void> {
  const cuando = datos.diasRestantes <= 0 ? 'hoy' : `en ${datos.diasRestantes} día${datos.diasRestantes === 1 ? '' : 's'}`;
  await enviar(destinatario, `Tu membresía vence ${cuando}`, (a) => plantillaPorVencer(datos, a), 'POR_VENCER');
}

export async function enviarCorreoVencida(destinatario: string, datos: DatosVencida): Promise<void> {
  await enviar(destinatario, 'Tu membresía ha vencido', (a) => plantillaVencida(datos, a), 'VENCIDA');
}

export async function enviarCorreoPagoConfirmado(destinatario: string, datos: DatosPagoConfirmado): Promise<void> {
  await enviar(destinatario, '¡Pago confirmado! Tu membresía está activa', (a) => plantillaPagoConfirmado(datos, a), 'PAGO_CONFIRMADO');
}

export async function enviarCorreoBienvenida(destinatario: string, datos: DatosBienvenida): Promise<void> {
  await enviar(destinatario, 'Bienvenido a BEAST MODE · tus datos de acceso', (a) => plantillaBienvenida(datos, a), 'BIENVENIDA');
}
