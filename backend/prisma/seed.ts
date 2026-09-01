import { PrismaClient, EstadoSuscripcion, MetodoPago } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fakerES_MX as faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const SEED_DOMAIN = '@seed.gym.local';
const SALT_ROUNDS = 10;

function hash(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function seedAdmin() {
  await prisma.usuario.upsert({
    where: { email: 'admin@gym.com' },
    update: { passwordHash: hash('admin123') },
    create: {
      nombre: 'Admin',
      apellido: 'Sistema',
      email: 'admin@gym.com',
      passwordHash: hash('admin123'),
      rol: 'ADMIN',
    },
  });
  console.log('Admin listo: admin@gym.com / admin123');
}

async function seedPlanes() {
  const planes = [
    { nombre: 'Visita', descripcion: 'Acceso por un dia', precio: 10.0, duracionDias: 1 },
    { nombre: 'Mensual', descripcion: 'Acceso por 30 dias', precio: 125.0, duracionDias: 30 },
    { nombre: 'Trimestral', descripcion: 'Acceso por 90 dias', precio: 300.0, duracionDias: 90 },
    { nombre: 'Anual', descripcion: 'Acceso por 365 dias', precio: 900.0, duracionDias: 365 },
  ];

  for (const plan of planes) {
    await prisma.plan.upsert({
      where: { nombre: plan.nombre },
      update: {},
      create: plan,
    });
  }
  console.log(`${planes.length} planes listos`);
}

async function seedEntrenadores() {
  const entrenadores = [
    { nombre: 'Carlos', apellido: 'Ramírez', email: 'entrenador1@gym.com' },
    { nombre: 'Lucía', apellido: 'Morales', email: 'entrenador2@gym.com' },
  ];

  for (const e of entrenadores) {
    await prisma.usuario.upsert({
      where: { email: e.email },
      update: { passwordHash: hash('entrenador123') },
      create: { ...e, passwordHash: hash('entrenador123'), rol: 'ENTRENADOR' },
    });
  }
  console.log(`${entrenadores.length} entrenadores listos (password: entrenador123)`);
}

async function limpiarSuscriptoresSeed() {
  // Cascada: borra clientes/suscripciones/pagos/asistencias/recordatorios asociados.
  const { count } = await prisma.usuario.deleteMany({
    where: { email: { endsWith: SEED_DOMAIN } },
  });
  console.log(`${count} suscriptores de seed anteriores eliminados`);
}

interface EstadoObjetivo {
  estado: EstadoSuscripcion;
  fechaFin: Date;
}

function calcularEstado(index: number, hoy: Date): EstadoObjetivo {
  if (index < 10) {
    // Activa, vigente por un buen tiempo.
    return { estado: EstadoSuscripcion.ACTIVA, fechaFin: addDays(hoy, faker.number.int({ min: 15, max: 60 })) };
  }
  if (index < 15) {
    // Activa, por vencer en 1-5 dias.
    return { estado: EstadoSuscripcion.ACTIVA, fechaFin: addDays(hoy, faker.number.int({ min: 1, max: 5 })) };
  }
  // Vencida.
  return { estado: EstadoSuscripcion.VENCIDA, fechaFin: addDays(hoy, -faker.number.int({ min: 1, max: 30 })) };
}

async function seedSuscriptores() {
  const planes = await prisma.plan.findMany();
  const hoy = new Date();
  const clientesConSuscripcion: { clienteId: bigint; suscripcionId: bigint; fechaInicio: Date; fechaFin: Date }[] =
    [];

  for (let i = 0; i < 20; i++) {
    const nombre = faker.person.firstName();
    const apellido = faker.person.lastName();
    const email = `seed${String(i + 1).padStart(2, '0')}${SEED_DOMAIN}`;
    const plan = faker.helpers.arrayElement(planes);
    const { estado, fechaFin } = calcularEstado(i, hoy);
    const fechaInicio = addDays(fechaFin, -plan.duracionDias);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        email,
        passwordHash: hash('cliente123'),
        rol: 'SUSCRIPTOR',
        cliente: {
          create: {
            codigo: `SEED-${String(i + 1).padStart(4, '0')}`,
            dpi: String(1000000000000 + i),
            telefono: faker.phone.number({ style: 'national' }),
            fechaNacimiento: faker.date.birthdate({ min: 18, max: 55, mode: 'age' }),
          },
        },
      },
      include: { cliente: true },
    });

    const suscripcion = await prisma.suscripcion.create({
      data: {
        clienteId: usuario.cliente!.id,
        planId: plan.id,
        fechaInicio,
        fechaFin,
        precioPagado: plan.precio,
        estado,
      },
    });

    await prisma.pago.create({
      data: {
        suscripcionId: suscripcion.id,
        monto: plan.precio,
        metodo: i % 2 === 0 ? MetodoPago.EFECTIVO : MetodoPago.TRANSFERENCIA,
        fechaPago: fechaInicio,
      },
    });

    clientesConSuscripcion.push({
      clienteId: usuario.cliente!.id,
      suscripcionId: suscripcion.id,
      fechaInicio,
      fechaFin,
    });
  }

  console.log('20 suscriptores creados (10 activas, 5 por vencer, 5 vencidas). Password: cliente123');
  return clientesConSuscripcion;
}

async function seedAsistencias(
  clientes: { clienteId: bigint; suscripcionId: bigint; fechaInicio: Date; fechaFin: Date }[],
) {
  const hoy = new Date();

  for (const [idx, c] of clientes.entries()) {
    let rangoFin = c.fechaFin < hoy ? c.fechaFin : hoy;
    if (rangoFin <= c.fechaInicio) {
      // Suscripciones muy cortas (p. ej. plan "Visita") pueden dejar el rango
      // vacío; se fuerza una ventana mínima solo para tener datos de ejemplo.
      rangoFin = new Date(c.fechaInicio.getTime() + 60 * 60 * 1000);
    }
    const visitasCerradas = faker.number.int({ min: 2, max: 4 });

    for (let v = 0; v < visitasCerradas; v++) {
      const entrada = faker.date.between({ from: c.fechaInicio, to: rangoFin });
      const salida = new Date(entrada.getTime() + faker.number.int({ min: 30, max: 120 }) * 60_000);
      await prisma.asistencia.create({
        data: {
          clienteId: c.clienteId,
          suscripcionId: c.suscripcionId,
          entrada,
          salida,
        },
      });
    }

    // Los primeros 3 clientes quedan con una visita abierta ahora mismo,
    // para que v_aforo_actual no arranque en cero.
    if (idx < 3) {
      await prisma.asistencia.create({
        data: {
          clienteId: c.clienteId,
          suscripcionId: c.suscripcionId,
          entrada: new Date(),
          salida: null,
        },
      });
    }
  }

  console.log('Asistencias de seed creadas (3 clientes con visita abierta)');
}

async function main() {
  await seedAdmin();
  await seedPlanes();
  await seedEntrenadores();
  await limpiarSuscriptoresSeed();
  const clientes = await seedSuscriptores();
  await seedAsistencias(clientes);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
