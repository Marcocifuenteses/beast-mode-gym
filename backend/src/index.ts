// Postgres bigint -> BigInt de JS, y res.json() no sabe serializarlo por defecto.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

import { app } from './app';
import { env } from './config/env';
import { iniciarCronRecordatorios } from './jobs/recordatorios.cron';

app.listen(env.PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${env.PORT}`);
  iniciarCronRecordatorios();
});
