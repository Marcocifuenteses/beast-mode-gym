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

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use(errorHandler);
