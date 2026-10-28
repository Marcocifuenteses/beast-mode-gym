// Postgres bigint -> BigInt de JS, y res.json() no sabe serializarlo por defecto.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

import { app } from './app';
import { env, isProduction } from './config/env';
import { iniciarCronRecordatorios } from './jobs/recordatorios.cron';
import { ejecutarRecordatoriosDiarios } from './services/recordatorios.service';

app.listen(env.PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${env.PORT}`);
  iniciarCronRecordatorios();

  // En hostings gratis (Render) el servidor se duerme sin tráfico y el cron de
  // las 8am casi nunca llega a correr; se ejecuta también al despertar. Es
  // idempotente: los avisos automáticos se deduplican por suscripción y tipo.
  if (isProduction) {
    ejecutarRecordatoriosDiarios().catch((err) => console.error('[recordatorios] corrida al arrancar falló:', err));
  }
});
