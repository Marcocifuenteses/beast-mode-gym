import path from 'path';
import { existsSync } from 'fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import planesRoutes from './routes/planes.routes';
import clientesRoutes from './routes/clientes.routes';
import suscripcionesRoutes from './routes/suscripciones.routes';
import pagosRoutes from './routes/pagos.routes';
import dashboardRoutes from './routes/dashboard.routes';
import checkinRoutes from './routes/checkin.routes';
import recordatoriosRoutes from './routes/recordatorios.routes';
import usuariosRoutes from './routes/usuarios.routes';
import { errorHandler } from './middleware/error.middleware';

export const app = express();

// Render (y casi cualquier hosting) pone un proxy delante: sin esto req.ip
// sería la IP del proxy y no la del usuario.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', checkinRoutes);
app.use('/api/recordatorios', recordatoriosRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// En producción el mismo servidor entrega el frontend de Angular ya compilado:
// una sola URL, sin CORS ni cookies entre dominios distintos. En desarrollo no
// existe la carpeta (se usa `ng serve` con proxy) y esto no hace nada.
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend/dist/frontend/browser');
if (existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR, { index: false, maxAge: '7d' }));
  // Rutas del SPA (/panel/clientes, /mi-cuenta/acceso...): siempre index.html,
  // sin caché para que un despliegue nuevo se vea al recargar.
  app.get('/{*ruta}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use(errorHandler);
