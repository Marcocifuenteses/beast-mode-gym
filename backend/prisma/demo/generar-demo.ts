/**
 * Genera los scripts SQL de datos de demostración (máximo un mes de uso):
 *
 *   01-base.sql          planes + personal (administradores y entrenadores)
 *   02-socios-demo.sql   socios con su historia: suscripciones, pagos,
 *                        asistencias y recordatorios
 *   usuarios-demo.md     correos y contraseñas de todas las cuentas
 *
 * Las fechas se escriben relativas al momento en que se ejecuta el SQL
 * (CURRENT_DATE - n, now() - intervalo), así que los datos siempre
 * representan "el último mes", sin importar cuándo se carguen.
 *
 * Uso: npm run demo:generar   (desde backend/)
 * Los .sql están pensados para una base recién migrada y vacía.
 */
import { writeFileSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DIR = __dirname;

// --- Aleatoriedad reproducible (misma semilla → mismos datos) --------------

function mulberry32(semilla: number) {
  return () => {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261027);
const entre = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(rnd() * lista.length)];
const prob = (p: number) => rnd() < p;

// --- Helpers SQL -----------------------------------------------------------

const q = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);
/** Fecha (columna DATE) a `d` días de hoy. */
const fecha = (d: number) => (d === 0 ? 'CURRENT_DATE' : `(CURRENT_DATE ${d < 0 ? '-' : '+'} ${Math.abs(d)})`);
/** Instante a `d` días de hoy, a la hora local de Guatemala dada (la sesión usa esa zona). */
const instante = (d: number, hora: number, minuto: number) =>
  `(${fecha(d)} + TIME '${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00')`;
const haceMinutos = (m: number) => `(now() - INTERVAL '${m} minutes')`;
const sinAcentos = (s: string) =>
  s.replace(/ñ/g, 'n').replace(/Ñ/g, 'N').normalize('NFD').replace(/[̀-ͯ]/g, '');

function insertar(tabla: string, columnas: string[], filas: string[][]): string {
  if (filas.length === 0) return '';
  const bloques: string[] = [];
  for (let i = 0; i < filas.length; i += 200) {
    const valores = filas
      .slice(i, i + 200)
      .map((f) => `  (${f.join(', ')})`)
      .join(',\n');
    bloques.push(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES\n${valores};`);
  }
  return bloques.join('\n\n') + '\n';
}

const setval = (tabla: string) =>
  `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), (SELECT MAX(id) FROM ${tabla}));`;

const hash = (password: string) => bcrypt.hashSync(password, 10);

// --- Catálogos -------------------------------------------------------------

interface PlanDemo {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  dias: number;
}

const PLANES: PlanDemo[] = [
  { id: 1, nombre: 'Visita', descripcion: 'Acceso por un día', precio: 25, dias: 1 },
  { id: 2, nombre: 'Quincenal', descripcion: 'Acceso por 15 días', precio: 140, dias: 15 },
  { id: 3, nombre: 'Mensual', descripcion: 'Acceso ilimitado por 30 días', precio: 250, dias: 30 },
  { id: 4, nombre: 'Trimestral', descripcion: 'Acceso ilimitado por 90 días', precio: 675, dias: 90 },
  { id: 5, nombre: 'Anual', descripcion: 'Acceso ilimitado por 365 días', precio: 2400, dias: 365 },
];
const plan = (nombre: string) => PLANES.find((p) => p.nombre === nombre)!;

interface Personal {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: 'ADMIN' | 'ENTRENADOR';
  puesto: string;
}

const PERSONAL: Personal[] = [
  { id: 1, nombre: 'Rodrigo', apellido: 'Estrada', email: 'rodrigo.estrada@beastmodegym.com', password: 'Estrada.Gym2026', rol: 'ADMIN', puesto: 'Dueño / administrador' },
  { id: 2, nombre: 'Andrea', apellido: 'Samayoa', email: 'andrea.samayoa@beastmodegym.com', password: 'Andrea#Recepcion24', rol: 'ADMIN', puesto: 'Administración y caja' },
  { id: 3, nombre: 'Kevin', apellido: 'Ajú', email: 'kevin.aju@beastmodegym.com', password: 'KevinFit_93', rol: 'ENTRENADOR', puesto: 'Entrenador · turno mañana' },
  { id: 4, nombre: 'Gabriela', apellido: 'Paz', email: 'gabriela.paz@beastmodegym.com', password: 'GabyPaz.2025', rol: 'ENTRENADOR', puesto: 'Entrenadora · turno mañana' },
  { id: 5, nombre: 'Luis', apellido: 'Coyoy', email: 'luis.coyoy@beastmodegym.com', password: 'Coyoy#Tarde21', rol: 'ENTRENADOR', puesto: 'Entrenador · turno tarde' },
];
const ENTRENADORES = PERSONAL.filter((p) => p.rol === 'ENTRENADOR');

const NOMBRES_M = ['José', 'Luis', 'Carlos', 'Juan Pablo', 'Diego', 'Andrés', 'Fernando', 'Kevin', 'Javier', 'Mario', 'Pablo', 'Daniel', 'Alejandro', 'Sergio', 'Byron', 'Edgar', 'Marvin', 'Cristian', 'Oscar', 'Rodrigo', 'Esteban', 'Gerson', 'Walter', 'Josué'];
const NOMBRES_F = ['María José', 'Ana Lucía', 'Andrea', 'Gabriela', 'Sofía', 'Daniela', 'Mónica', 'Paola', 'Fernanda', 'Karla', 'Alejandra', 'Lucía', 'Valeria', 'Jimena', 'Rocío', 'Claudia', 'Mariela', 'Ximena', 'Wendy', 'Silvia', 'Isabel', 'Diana', 'Lourdes', 'Katherine'];
const APELLIDOS = ['López', 'García', 'Pérez', 'Hernández', 'Morales', 'Ramírez', 'Castillo', 'Juárez', 'Ixcot', 'Chávez', 'Méndez', 'Barrios', 'Orellana', 'Monterroso', 'Cifuentes', 'Cabrera', 'Gálvez', 'Archila', 'Recinos', 'Sandoval', 'Arévalo', 'Quiñónez', 'Xicará', 'Tzul', 'Velásquez', 'Solís', 'Aguilar', 'Rosales', 'Figueroa', 'Mazariegos', 'Girón', 'Cordón'];
const DOMINIOS = ['gmail.com', 'gmail.com', 'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
const PALABRAS = ['Xela', 'Guate', 'Antigua', 'Pollito', 'Chapin', 'Rayo', 'Luna', 'Cielo', 'Tigre', 'Coco', 'Gym', 'Fit'];

// --- Socios ----------------------------------------------------------------

type Perfil =
  | 'mensual'
  | 'mensual_por_vencer'
  | 'quincenal_renueva'
  | 'quincenal_vencido'
  | 'visitas'
  | 'visita_luego_mensual'
  | 'trimestral'
  | 'anual'
  | 'sin_plan'
  | 'cancelada'
  | 'dado_de_baja';

// Mezcla de un gimnasio que abrió hace un mes: la mayoría con plan mensual.
const PERFILES: Perfil[] = [
  ...Array<Perfil>(22).fill('mensual'),
  ...Array<Perfil>(4).fill('mensual_por_vencer'),
  ...Array<Perfil>(5).fill('quincenal_renueva'),
  ...Array<Perfil>(4).fill('quincenal_vencido'),
  ...Array<Perfil>(3).fill('visitas'),
  ...Array<Perfil>(2).fill('visita_luego_mensual'),
  ...Array<Perfil>(5).fill('trimestral'),
  ...Array<Perfil>(2).fill('anual'),
  ...Array<Perfil>(2).fill('sin_plan'),
  'cancelada',
  'dado_de_baja',
];

interface Suscripcion {
  id: number;
  plan: PlanDemo;
  inicio: number;
  fin: number;
  estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA';
  /** Hora del pago en caja. */
  horaPago: [number, number];
  metodo: 'EFECTIVO' | 'TRANSFERENCIA';
}

interface Socio {
  usuarioId: number;
  clienteId: number;
  codigo: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  telefono: string;
  dpi: string;
  nacimiento: string;
  alta: number;
  perfil: Perfil;
  activo: boolean;
  suscripciones: Suscripcion[];
  /** Franja horaria en la que suele entrenar. */
  franja: [number, number];
  frecuencia: number;
}

const emailsUsados = new Set<string>(PERSONAL.map((p) => p.email));

function crearEmail(nombre: string, apellido: string): string {
  const n = sinAcentos(nombre.split(' ')[0]).toLowerCase();
  const n2 = sinAcentos(nombre).toLowerCase().replace(/ /g, '');
  const a = sinAcentos(apellido).toLowerCase().replace(/ /g, '');
  const anio = String(entre(85, 105) % 100).padStart(2, '0');
  const patrones = [
    `${n}.${a}${anio}`,
    `${n2}${a}`,
    `${n[0]}${a}${entre(1, 99)}`,
    `${n}_${a}`,
    `${n}${a}.${anio}`,
    `${a}.${n}`,
  ];
  for (;;) {
    const email = `${elegir(patrones)}@${elegir(DOMINIOS)}`;
    if (!emailsUsados.has(email)) {
      emailsUsados.add(email);
      return email;
    }
  }
}

function crearPassword(nombre: string, apellido: string): string {
  const n = sinAcentos(nombre.split(' ')[0]);
  const a = sinAcentos(apellido.split(' ').pop()!);
  const anio = entre(1988, 2006);
  const patrones = [
    () => `${n}${anio}`,
    () => `${n.toLowerCase()}.${a.toLowerCase()}${entre(1, 99)}`,
    () => `${elegir(PALABRAS)}${entre(10, 99)}!`,
    () => `${n}#${String(anio).slice(2)}${a[0]}`,
    () => `${n[0]}${a.toLowerCase()}${anio}`,
    () => `${elegir(PALABRAS)}.${n.toLowerCase()}`,
  ];
  return elegir(patrones)();
}

/** Franjas típicas: madrugadores, mediodía y después del trabajo (la más llena). */
function elegirFranja(): [number, number] {
  const r = rnd();
  if (r < 0.34) return [5 * 60 + 30, 7 * 60 + 45];
  if (r < 0.46) return [9 * 60, 11 * 60 + 30];
  if (r < 0.56) return [12 * 60, 13 * 60 + 30];
  return [17 * 60, 20 * 60 + 15];
}

let siguienteSuscripcion = 1;
function nuevaSuscripcion(p: PlanDemo, inicio: number): Suscripcion {
  const fin = inicio + p.dias;
  return {
    id: siguienteSuscripcion++,
    plan: p,
    inicio,
    fin,
    estado: fin >= 0 ? 'ACTIVA' : 'VENCIDA',
    horaPago: [entre(6, 20), entre(0, 59)],
    metodo: prob(0.68) ? 'EFECTIVO' : 'TRANSFERENCIA',
  };
}

/** Historia de suscripciones según el perfil (días negativos = pasado). */
function historia(perfil: Perfil, alta: number): Suscripcion[] {
  switch (perfil) {
    case 'mensual':
      return [nuevaSuscripcion(plan('Mensual'), alta)];
    case 'mensual_por_vencer':
      return [nuevaSuscripcion(plan('Mensual'), alta)];
    case 'quincenal_renueva': {
      const lista = [nuevaSuscripcion(plan('Quincenal'), alta)];
      while (lista[lista.length - 1].fin < 0) {
        const previa = lista[lista.length - 1];
        // Renueva el día que vence o un par de días después (nunca en el futuro).
        lista.push(nuevaSuscripcion(plan('Quincenal'), Math.min(previa.fin + entre(0, 2), -1)));
      }
      return lista;
    }
    case 'quincenal_vencido':
    case 'dado_de_baja':
      return [nuevaSuscripcion(plan('Quincenal'), alta)];
    case 'visitas': {
      const dias = [alta, alta + entre(4, 8), alta + entre(10, 18)].filter((d) => d <= -1);
      return dias.map((d) => nuevaSuscripcion(plan('Visita'), d));
    }
    case 'visita_luego_mensual': {
      const visita = nuevaSuscripcion(plan('Visita'), alta);
      return [visita, nuevaSuscripcion(plan('Mensual'), alta + entre(1, 4))];
    }
    case 'trimestral':
      return [nuevaSuscripcion(plan('Trimestral'), alta)];
    case 'anual':
      return [nuevaSuscripcion(plan('Anual'), alta)];
    case 'cancelada': {
      const s = nuevaSuscripcion(plan('Mensual'), alta);
      s.estado = 'CANCELADA';
      return [s];
    }
    case 'sin_plan':
      return [];
  }
}

/** Día de inscripción según el perfil (todo dentro del último mes). */
function diaAlta(perfil: Perfil): number {
  switch (perfil) {
    case 'mensual':
      // Más inscripciones en la semana de apertura.
      return prob(0.4) ? entre(-24, -18) : entre(-17, -1);
    case 'mensual_por_vencer':
      return entre(-30, -27);
    case 'quincenal_renueva':
      return entre(-30, -22);
    case 'quincenal_vencido':
    case 'dado_de_baja':
      return entre(-30, -17);
    case 'visitas':
      return entre(-28, -12);
    case 'visita_luego_mensual':
      return entre(-26, -6);
    case 'trimestral':
      return entre(-29, -3);
    case 'anual':
      return entre(-30, -14);
    case 'sin_plan':
      return entre(-9, -1);
    case 'cancelada':
      return entre(-22, -12);
  }
}

const nombresUsados = new Set<string>();
const borradores = PERFILES.map((perfil) => {
  let nombre: string;
  let apellido: string;
  do {
    nombre = prob(0.5) ? elegir(NOMBRES_M) : elegir(NOMBRES_F);
    apellido = `${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
  } while (nombresUsados.has(`${nombre} ${apellido}`) || apellido.split(' ')[0] === apellido.split(' ')[1]);
  nombresUsados.add(`${nombre} ${apellido}`);
  return { perfil, nombre, apellido, alta: diaAlta(perfil) };
});

// Los códigos de socio (CLI-0001...) siguen el orden de inscripción.
borradores.sort((a, b) => a.alta - b.alta);

const socios: Socio[] = borradores.map((b, i) => ({
  usuarioId: PERSONAL.length + i + 1,
  clienteId: i + 1,
  codigo: `CLI-${String(i + 1).padStart(4, '0')}`,
  nombre: b.nombre,
  apellido: b.apellido,
  email: crearEmail(b.nombre, b.apellido.split(' ')[0]),
  password: crearPassword(b.nombre, b.apellido.split(' ')[0]),
  telefono: `${elegir(['3', '4', '5'])}${entre(1000000, 9999999)}`,
  dpi: `${entre(1000, 3999)}${entre(10000, 99999)}0101`,
  nacimiento: `${entre(1975, 2007)}-${String(entre(1, 12)).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`,
  alta: b.alta,
  perfil: b.perfil,
  activo: b.perfil !== 'dado_de_baja',
  suscripciones: historia(b.perfil, b.alta),
  franja: elegirFranja(),
  frecuencia: 0.3 + rnd() * 0.45,
}));

// --- Asistencias -----------------------------------------------------------

interface Asistencia {
  clienteId: number;
  suscripcionId: number;
  entrada: string;
  salida: string;
}

const asistencias: Asistencia[] = [];

for (const s of socios) {
  for (const sub of s.suscripciones) {
    if (sub.estado === 'CANCELADA') {
      // Vino un par de veces antes de cancelar.
      for (let d = sub.inicio; d < Math.min(sub.inicio + 6, 0); d += entre(2, 3)) agregarVisita(s, sub, d);
      continue;
    }
    const hasta = Math.min(sub.fin - 1, -1); // días completos ya pasados (hoy va aparte)
    for (let d = sub.inicio; d <= hasta; d++) {
      const esVisita = sub.plan.nombre === 'Visita';
      if (esVisita || prob(s.frecuencia)) agregarVisita(s, sub, d);
    }
  }
}

function agregarVisita(s: Socio, sub: Suscripcion, d: number): void {
  const minutoEntrada = entre(s.franja[0], s.franja[1]);
  const duracion = entre(45, 115);
  const minutoSalida = Math.min(minutoEntrada + duracion, 22 * 60);
  asistencias.push({
    clienteId: s.clienteId,
    suscripcionId: sub.id,
    entrada: instante(d, Math.floor(minutoEntrada / 60), minutoEntrada % 60),
    salida: instante(d, Math.floor(minutoSalida / 60), minutoSalida % 60),
  });
}

// Hoy: algunos ya vinieron y se fueron; otros siguen dentro (aforo actual).
// Se expresa relativo a now() para que nunca quede una visita "en el futuro".
const vigentesHoy = socios.filter((s) => s.activo && s.suscripciones.some((x) => x.estado === 'ACTIVA' && x.fin >= 1));
const mezclados = [...vigentesHoy].sort(() => rnd() - 0.5);
const dentroAhora = mezclados.slice(0, 7);
const vinieronHoy = mezclados.slice(7, 19);
const subVigente = (s: Socio) => s.suscripciones.find((x) => x.estado === 'ACTIVA')!;

const visitasAbiertas = dentroAhora.map((s) => ({
  clienteId: s.clienteId,
  suscripcionId: subVigente(s).id,
  entrada: haceMinutos(entre(8, 75)),
}));
for (const s of vinieronHoy) {
  const hace = entre(150, 480);
  const duracion = entre(45, Math.min(110, hace - 20));
  asistencias.push({
    clienteId: s.clienteId,
    suscripcionId: subVigente(s).id,
    entrada: haceMinutos(hace),
    salida: haceMinutos(hace - duracion),
  });
}

// --- Recordatorios ---------------------------------------------------------

interface Recordatorio {
  clienteId: number;
  suscripcionId: number;
  tipo: 'POR_VENCER' | 'VENCIDA';
  fecha: string;
  enviadoPor: number | null;
}
const recordatorios: Recordatorio[] = [];

for (const s of socios) {
  s.suscripciones.forEach((sub, i) => {
    if (sub.estado === 'CANCELADA' || sub.plan.nombre === 'Visita') return;
    const siguiente = s.suscripciones[i + 1];
    // Aviso automático "por vencer": el cron de las 8am, 5 días antes.
    if (sub.plan.dias > 5 && sub.fin - 5 <= -1 && !(siguiente && siguiente.inicio <= sub.fin - 5)) {
      recordatorios.push({ clienteId: s.clienteId, suscripcionId: sub.id, tipo: 'POR_VENCER', fecha: instante(sub.fin - 5, 8, 0), enviadoPor: null });
    }
    // Aviso automático "vencida": al día siguiente del vencimiento, si no había renovado.
    const renovoATiempo = siguiente && siguiente.inicio <= sub.fin;
    if (sub.estado === 'VENCIDA' && sub.fin + 1 <= -1 && !renovoATiempo) {
      recordatorios.push({ clienteId: s.clienteId, suscripcionId: sub.id, tipo: 'VENCIDA', fecha: instante(sub.fin + 1, 8, 0), enviadoPor: null });
      // Algunos no volvieron: el personal les insistió por su cuenta.
      if (!siguiente && sub.fin + 4 <= -1 && prob(0.6)) {
        recordatorios.push({ clienteId: s.clienteId, suscripcionId: sub.id, tipo: 'VENCIDA', fecha: instante(sub.fin + 4, entre(9, 18), entre(0, 59)), enviadoPor: elegir(PERSONAL).id });
      }
    }
  });
}

// --- Escritura de los SQL --------------------------------------------------

const encabezado = (titulo: string) => `-- ${titulo}
-- Generado por prisma/demo/generar-demo.ts. Fechas relativas al momento de ejecución.
-- Requiere una base recién migrada (npx prisma migrate deploy) y vacía.
BEGIN;
-- Las horas se escriben en hora de Guatemala.
SET LOCAL TIME ZONE 'America/Guatemala';

`;

const base =
  encabezado('BEAST MODE · 01 · Planes y personal') +
  '-- Planes\n' +
  insertar(
    'planes',
    ['id', 'nombre', 'descripcion', 'precio', 'duracion_dias', 'activo', 'creado_en', 'actualizado_en'],
    PLANES.map((p) => [String(p.id), q(p.nombre), q(p.descripcion), p.precio.toFixed(2), String(p.dias), 'true', instante(-33, 10, 0), instante(-33, 10, 0)]),
  ) +
  '\n-- Personal (contraseñas en usuarios-demo.md)\n' +
  insertar(
    'usuarios',
    ['id', 'nombre', 'apellido', 'email', 'password_hash', 'rol', 'activo', 'creado_en', 'actualizado_en'],
    PERSONAL.map((p, i) => [String(p.id), q(p.nombre), q(p.apellido), q(p.email), q(hash(p.password)), q(p.rol), 'true', instante(-33, 10, 15 + i * 5), instante(-33, 10, 15 + i * 5)]),
  ) +
  `\n${setval('planes')}\n${setval('usuarios')}\n\nCOMMIT;\n`;

const hashesSocios = new Map(socios.map((s) => [s.usuarioId, hash(s.password)]));

const filasPagos: string[][] = [];
let siguientePago = 1;
for (const s of socios) {
  for (const sub of s.suscripciones) {
    filasPagos.push([
      String(siguientePago++),
      String(sub.id),
      sub.plan.precio.toFixed(2),
      q(sub.metodo),
      instante(sub.inicio, sub.horaPago[0], sub.horaPago[1]),
      sub.metodo === 'TRANSFERENCIA' ? q(`TRF-${entre(100000, 999999)}`) : 'NULL',
      instante(sub.inicio, sub.horaPago[0], sub.horaPago[1]),
    ]);
  }
}

const todasLasAsistencias = [
  ...asistencias.map((a) => [String(a.clienteId), String(a.suscripcionId), a.entrada, a.salida]),
  ...visitasAbiertas.map((a) => [String(a.clienteId), String(a.suscripcionId), a.entrada, 'NULL']),
];

const sociosSql =
  encabezado('BEAST MODE · 02 · Socios con un mes de historia') +
  `-- ${socios.length} socios (contraseñas en usuarios-demo.md)\n` +
  insertar(
    'usuarios',
    ['id', 'nombre', 'apellido', 'email', 'password_hash', 'rol', 'activo', 'creado_en', 'actualizado_en'],
    socios.map((s) => {
      const alta = instante(s.alta, s.suscripciones[0]?.horaPago[0] ?? 11, s.suscripciones[0]?.horaPago[1] ?? 30);
      return [String(s.usuarioId), q(s.nombre), q(s.apellido), q(s.email), q(hashesSocios.get(s.usuarioId)!), q('SUSCRIPTOR'), String(s.activo), alta, alta];
    }),
  ) +
  '\n' +
  insertar(
    'clientes',
    ['id', 'usuario_id', 'codigo', 'dpi', 'telefono', 'fecha_nacimiento', 'activo', 'creado_en', 'actualizado_en'],
    socios.map((s) => {
      const alta = instante(s.alta, s.suscripciones[0]?.horaPago[0] ?? 11, s.suscripciones[0]?.horaPago[1] ?? 30);
      return [String(s.clienteId), String(s.usuarioId), q(s.codigo), q(s.dpi), q(s.telefono), q(s.nacimiento), String(s.activo), alta, alta];
    }),
  ) +
  '\n-- Suscripciones\n' +
  insertar(
    'suscripciones',
    ['id', 'cliente_id', 'plan_id', 'fecha_inicio', 'fecha_fin', 'precio_pagado', 'estado', 'creado_en', 'actualizado_en'],
    socios.flatMap((s) =>
      s.suscripciones.map((sub) => [
        String(sub.id),
        String(s.clienteId),
        String(sub.plan.id),
        fecha(sub.inicio),
        fecha(sub.fin),
        sub.plan.precio.toFixed(2),
        q(sub.estado),
        instante(sub.inicio, sub.horaPago[0], sub.horaPago[1]),
        instante(sub.inicio, sub.horaPago[0], sub.horaPago[1]),
      ]),
    ),
  ) +
  '\n-- Pagos\n' +
  insertar('pagos', ['id', 'suscripcion_id', 'monto', 'metodo', 'fecha_pago', 'referencia', 'creado_en'], filasPagos) +
  `\n-- Asistencias (${todasLasAsistencias.length}; ${visitasAbiertas.length} personas dentro del gym al cargar)\n` +
  insertar('asistencias', ['cliente_id', 'suscripcion_id', 'entrada', 'salida'], todasLasAsistencias) +
  '\n-- Recordatorios enviados\n' +
  insertar(
    'recordatorios',
    ['cliente_id', 'suscripcion_id', 'tipo', 'fecha_envio', 'enviado_por'],
    recordatorios.map((r) => [String(r.clienteId), String(r.suscripcionId), q(r.tipo), r.fecha, r.enviadoPor === null ? 'NULL' : String(r.enviadoPor)]),
  ) +
  ['usuarios', 'clientes', 'suscripciones', 'pagos', 'asistencias', 'recordatorios'].map(setval).map((l) => `\n${l}`).join('') +
  '\n\nCOMMIT;\n';

// --- Lista de cuentas ------------------------------------------------------

function estadoTexto(s: Socio): string {
  if (!s.activo) return 'Dado de baja (no puede entrar)';
  const vigente = s.suscripciones.find((x) => x.estado === 'ACTIVA');
  if (vigente) {
    const resta = vigente.fin;
    const dentro = dentroAhora.includes(s) ? ' · **dentro del gym ahora**' : '';
    return `${vigente.plan.nombre} · ${resta === 0 ? '**vence hoy**' : resta <= 5 ? `**vence en ${resta} día${resta === 1 ? '' : 's'}**` : `vigente, quedan ${resta} días`}${dentro}`;
  }
  if (s.perfil === 'cancelada') return 'Suscripción cancelada (sin plan)';
  const ultima = s.suscripciones[s.suscripciones.length - 1];
  if (!ultima) return 'Sin plan (se registró y aún no paga)';
  return `${ultima.plan.nombre} · vencida hace ${-ultima.fin} días`;
}

const destacados = ([
  socios.find((s) => s.activo && !dentroAhora.includes(s) && s.perfil === 'mensual' && subVigente(s).fin > 10)!,
  socios.find((s) => dentroAhora.includes(s) && s.suscripciones.some((x) => x.plan.nombre === 'Mensual'))!,
  socios.find((s) => s.perfil === 'mensual_por_vencer')!,
  socios.find((s) => s.perfil === 'quincenal_renueva')!,
  socios.find((s) => s.perfil === 'quincenal_vencido')!,
  socios.find((s) => s.perfil === 'anual')!,
  socios.find((s) => s.perfil === 'sin_plan')!,
]).filter(Boolean);

const md = `# BEAST MODE · Cuentas de demostración

Datos que simulan **un mes de uso**. Las fechas son relativas al día en que se cargó el SQL.

## Personal

| Rol | Nombre | Correo | Contraseña | Puesto |
|---|---|---|---|---|
${PERSONAL.map((p) => `| ${p.rol === 'ADMIN' ? 'Admin' : 'Entrenador'} | ${p.nombre} ${p.apellido} | ${p.email} | \`${p.password}\` | ${p.puesto} |`).join('\n')}

> El check-in (escanear QR / registrar entrada) solo lo pueden hacer los **entrenadores**.

## Socios recomendados para probar

| Para probar… | Nombre | Correo | Contraseña | Estado al cargar |
|---|---|---|---|---|
${destacados
  .map((s, i) => {
    const para = ['QR: registrar entrada', 'QR: ya está dentro (salida)', 'Membresía por vencer', 'Renovó su plan', 'Membresía vencida', 'Plan anual', 'Sin plan'][i];
    return `| ${para} | ${s.nombre} ${s.apellido} (${s.codigo}) | ${s.email} | \`${s.password}\` | ${estadoTexto(s)} |`;
  })
  .join('\n')}

## Todos los socios (${socios.length})

| Código | Nombre | Correo | Contraseña | Estado al cargar |
|---|---|---|---|---|
${socios.map((s) => `| ${s.codigo} | ${s.nombre} ${s.apellido} | ${s.email} | \`${s.password}\` | ${estadoTexto(s)} |`).join('\n')}
`;

writeFileSync(path.join(DIR, '01-base.sql'), base);
writeFileSync(path.join(DIR, '02-socios-demo.sql'), sociosSql);
writeFileSync(path.join(DIR, 'usuarios-demo.md'), md);

const conPlan = socios.filter((s) => s.activo && s.suscripciones.some((x) => x.estado === 'ACTIVA')).length;
console.log(`Socios: ${socios.length} (${conPlan} con plan vigente)`);
console.log(`Suscripciones: ${siguienteSuscripcion - 1} · Pagos: ${filasPagos.length}`);
console.log(`Asistencias: ${todasLasAsistencias.length} (${visitasAbiertas.length} dentro ahora) · Recordatorios: ${recordatorios.length}`);
console.log('Archivos escritos en prisma/demo/: 01-base.sql, 02-socios-demo.sql, usuarios-demo.md');
