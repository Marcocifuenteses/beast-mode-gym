export type EstadoSuscripcion = 'ACTIVA' | 'VENCIDA' | 'CANCELADA';
export type Semaforo = 'SIN_PLAN' | 'VENCIDA' | 'POR_VENCER' | 'VIGENTE';
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA';

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  duracionDias: number;
  activo: boolean;
}

export interface ClientePanel {
  clienteId: string;
  codigo: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  plan: string | null;
  precio: string | null;
  suscripcionId: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoSuscripcion | null;
  diasRestantes: number | null;
  semaforo: Semaforo;
}

export interface SuscripcionHistorial {
  id: string;
  planId: string;
  fechaInicio: string;
  fechaFin: string;
  precioPagado: string;
  estado: EstadoSuscripcion;
  plan: Plan;
}

export interface ClienteCompleto extends ClientePanel {
  historialSuscripciones: SuscripcionHistorial[];
}

export interface Asistencia {
  id: string;
  clienteId: string;
  suscripcionId: string;
  entrada: string;
  salida: string | null;
}

export interface PerfilSuscriptor {
  perfil: ClientePanel;
  historialAsistencias: Asistencia[];
}

export interface DashboardResumen {
  clientesActivos: number;
  vencenEn7Dias: number;
  ingresosDelMes: string;
  asistenciasHoy: number;
  grafica30Dias: { fecha: string; asistencias: number }[];
}

export interface CheckinResultado {
  accion: 'ENTRADA' | 'SALIDA';
  cliente: { nombre: string; apellido: string; codigo: string };
  asistencia: Asistencia;
}
