import cron from 'node-cron';
import { ejecutarRecordatoriosDiarios } from '../services/recordatorios.service';

/** Corre todos los días a las 8:00 AM, hora de Guatemala. */
export function iniciarCronRecordatorios(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      ejecutarRecordatoriosDiarios().catch((err) => console.error('[cron recordatorios] error:', err));
    },
    { timezone: 'America/Guatemala' },
  );
  console.log('Cron de recordatorios programado: 08:00 America/Guatemala');
}
