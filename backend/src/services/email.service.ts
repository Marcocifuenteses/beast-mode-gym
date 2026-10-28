import { Resend } from 'resend';
import { env } from '../config/env';


const FROM = 'BEAST MODE <onboarding@resend.dev>';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

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


function fila(etiqueta: string, valor: string): string {
  return `
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:13px;">${etiqueta}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:700;text-align:right;">${valor}</td>
    </tr>`;
}

function badge(texto: string, color: string, fondo: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${color};background:${fondo};">${texto}</span>`;
}

function documento(tituloInterno: string, badgeHtml: string, cuerpoHtml: string, filasHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BEAST MODE</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f0f4;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:520px;width:100%;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e6ec;">
        <!-- Encabezado de marca -->
        <div style="background:linear-gradient(135deg,#8b5cf6 0%,#22d3ee 100%);padding:28px 24px;text-align:center;">
          <div style="font-size:30px;line-height:1;margin-bottom:8px;">🏋️</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;letter-spacing:3px;font-size:22px;color:#ffffff;text-transform:uppercase;">
            Beast&nbsp;Mode
          </div>
        </div>

        <!-- Cuerpo -->
        <div style="padding:28px 24px 8px;">
          <div style="margin-bottom:14px;">${badgeHtml}</div>
          <h1 style="margin:0 0 12px;font-size:19px;color:#111827;">${tituloInterno}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151;">
            ${cuerpoHtml}
          </div>

          <table role="presentation" width="100%" style="margin-top:20px;background:#f9fafb;border-radius:12px;padding:4px 16px;border-collapse:collapse;">
            ${filasHtml}
          </table>
        </div>

        <!-- Pie -->
        <div style="padding:18px 24px;background:#fafafa;text-align:center;border-top:1px solid #eee;margin-top:20px;">
          <span style="font-size:11px;color:#9ca3af;">Mensaje automático de BEAST MODE — por favor no respondas a este correo.</span>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function plantillaPorVencer(d: DatosPorVencer): string {
  const diasTexto = `${d.diasRestantes} día${d.diasRestantes === 1 ? '' : 's'}`;
  return documento(
    `Tu membresía vence en ${diasTexto}`,
    badge('POR VENCER', '#92400e', '#fef3c7'),
    `<p style="margin:0 0 8px;">Hola <strong>${d.nombre}</strong>,</p>
     <p style="margin:0;">Tu plan está a punto de vencer. Pasa a recepción para renovarlo y seguir entrenando sin interrupciones.</p>`,
    fila('Plan', d.plan) + fila('Vence en', diasTexto) + fila('Monto de renovación', `Q${d.monto.toFixed(2)}`),
  );
}

export function plantillaVencida(d: DatosVencida): string {
  return documento(
    'Tu membresía ha vencido',
    badge('VENCIDA', '#991b1b', '#fee2e2'),
    `<p style="margin:0 0 8px;">Hola <strong>${d.nombre}</strong>,</p>
     <p style="margin:0;">Tu acceso al gimnasio está pausado. Renueva tu membresía cuando quieras para recuperarlo.</p>`,
    fila('Plan', d.plan) + fila('Venció el', d.fechaVencimiento) + fila('Monto de renovación', `Q${d.monto.toFixed(2)}`),
  );
}

export function plantillaPagoConfirmado(d: DatosPagoConfirmado): string {
  return documento(
    '¡Pago confirmado!',
    badge('PAGO CONFIRMADO', '#166534', '#dcfce7'),
    `<p style="margin:0 0 8px;">Hola <strong>${d.nombre}</strong>,</p>
     <p style="margin:0;">Registramos tu pago y tu membresía ya está activa. ¡Nos vemos en el gym! 💪</p>`,
    fila('Plan', d.plan) +
      fila('Monto pagado', `Q${d.monto.toFixed(2)}`) +
      fila('Método', d.metodo) +
      fila('Vence el', d.fechaFin),
  );
}

async function enviar(destinatario: string, subject: string, html: string, logTag: string): Promise<void> {
  if (!resend) {
    console.log(`[email:dev] ${logTag} -> ${destinatario}`);
    return;
  }
  const resultado = await resend.emails.send({ from: FROM, to: destinatario, subject, html });
  if (resultado.error) {
    console.error(`[email] Resend rechazó el envío (${logTag} -> ${destinatario}):`, resultado.error);
    throw new Error(`No se pudo enviar el correo: ${resultado.error.message}`);
  }
}

export async function enviarCorreoPorVencer(destinatario: string, datos: DatosPorVencer): Promise<void> {
  const diasTexto = `${datos.diasRestantes} día${datos.diasRestantes === 1 ? '' : 's'}`;
  await enviar(destinatario, `Tu membresía vence en ${diasTexto}`, plantillaPorVencer(datos), 'POR_VENCER');
}

export async function enviarCorreoVencida(destinatario: string, datos: DatosVencida): Promise<void> {
  await enviar(destinatario, 'Tu membresía ha vencido', plantillaVencida(datos), 'VENCIDA');
}

export async function enviarCorreoPagoConfirmado(destinatario: string, datos: DatosPagoConfirmado): Promise<void> {
  await enviar(destinatario, '¡Pago confirmado! Tu membresía está activa', plantillaPagoConfirmado(datos), 'PAGO_CONFIRMADO');
}
