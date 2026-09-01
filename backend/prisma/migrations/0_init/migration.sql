-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."estado_suscripcion" AS ENUM ('ACTIVA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "public"."metodo_pago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "public"."rol_usuario" AS ENUM ('ADMIN', 'ENTRENADOR', 'SUSCRIPTOR');

-- CreateEnum
CREATE TYPE "public"."tipo_recordatorio" AS ENUM ('POR_VENCER', 'VENCIDA');

-- CreateTable
CREATE TABLE "public"."asistencias" (
    "id" BIGSERIAL NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "suscripcion_id" BIGINT NOT NULL,
    "entrada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salida" TIMESTAMPTZ(6),

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clientes" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "dpi" VARCHAR(13),
    "telefono" VARCHAR(20),
    "fecha_nacimiento" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pagos" (
    "id" BIGSERIAL NOT NULL,
    "suscripcion_id" BIGINT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "public"."metodo_pago" NOT NULL DEFAULT 'EFECTIVO',
    "fecha_pago" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referencia" VARCHAR(80),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."planes" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "duracion_dias" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recordatorios" (
    "id" BIGSERIAL NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "suscripcion_id" BIGINT NOT NULL,
    "tipo" "public"."tipo_recordatorio" NOT NULL,
    "fecha_envio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_por" BIGINT,

    CONSTRAINT "recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suscripciones" (
    "id" BIGSERIAL NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "fecha_inicio" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_fin" DATE NOT NULL,
    "precio_pagado" DECIMAL(10,2) NOT NULL,
    "estado" "public"."estado_suscripcion" NOT NULL DEFAULT 'ACTIVA',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuarios" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "public"."rol_usuario" NOT NULL DEFAULT 'SUSCRIPTOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_asistencias_cliente" ON "public"."asistencias"("cliente_id" ASC);

-- CreateIndex
CREATE INDEX "idx_asistencias_entrada" ON "public"."asistencias"("entrada" ASC);

-- CreateIndex
CREATE INDEX "idx_clientes_activo" ON "public"."clientes"("activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_clientes_codigo" ON "public"."clientes"("codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_clientes_dpi" ON "public"."clientes"("dpi" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_clientes_usuario" ON "public"."clientes"("usuario_id" ASC);

-- CreateIndex
CREATE INDEX "idx_pagos_fecha" ON "public"."pagos"("fecha_pago" ASC);

-- CreateIndex
CREATE INDEX "idx_pagos_suscripcion" ON "public"."pagos"("suscripcion_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_planes_nombre" ON "public"."planes"("nombre" ASC);

-- CreateIndex
CREATE INDEX "idx_recordatorios_fecha" ON "public"."recordatorios"("fecha_envio" ASC);

-- CreateIndex
CREATE INDEX "idx_recordatorios_suscripcion" ON "public"."recordatorios"("suscripcion_id" ASC);

-- CreateIndex
CREATE INDEX "idx_suscripciones_cliente" ON "public"."suscripciones"("cliente_id" ASC);

-- CreateIndex
CREATE INDEX "idx_suscripciones_estado" ON "public"."suscripciones"("estado" ASC);

-- CreateIndex
CREATE INDEX "idx_suscripciones_fecha_fin" ON "public"."suscripciones"("fecha_fin" ASC);

-- CreateIndex
CREATE INDEX "idx_usuarios_activo" ON "public"."usuarios"("activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuarios_email" ON "public"."usuarios"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."asistencias" ADD CONSTRAINT "fk_asistencias_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."asistencias" ADD CONSTRAINT "fk_asistencias_suscripcion" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."clientes" ADD CONSTRAINT "fk_clientes_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagos" ADD CONSTRAINT "fk_pagos_suscripcion" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recordatorios" ADD CONSTRAINT "fk_recordatorios_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recordatorios" ADD CONSTRAINT "fk_recordatorios_suscripcion" FOREIGN KEY ("suscripcion_id") REFERENCES "public"."suscripciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."recordatorios" ADD CONSTRAINT "fk_recordatorios_usuario" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."suscripciones" ADD CONSTRAINT "fk_suscripciones_cliente" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."suscripciones" ADD CONSTRAINT "fk_suscripciones_plan" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- The Prisma schema-diff engine has no representation for triggers, views, or
-- partial (WHERE-qualified) unique indexes, so none of the statements below
-- were auto-generated. They're transcribed verbatim from the original SQL
-- script that was applied to this database, so that replaying this migration
-- (e.g. into the shadow database `prisma migrate dev` uses) reproduces the
-- real database exactly, not just the subset Prisma's data model understands.

-- Partial unique indexes (not representable as @@unique in schema.prisma)
CREATE UNIQUE INDEX "uq_suscripcion_activa_por_cliente" ON "public"."suscripciones" ("cliente_id") WHERE "estado" = 'ACTIVA';
CREATE UNIQUE INDEX "uq_asistencia_abierta_por_cliente" ON "public"."asistencias" ("cliente_id") WHERE "salida" IS NULL;
CREATE UNIQUE INDEX "uq_recordatorio_automatico" ON "public"."recordatorios" ("suscripcion_id", "tipo") WHERE "enviado_por" IS NULL;

-- Audit trigger function + triggers (not representable in schema.prisma)
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_usuarios_timestamp
    BEFORE UPDATE ON "public"."usuarios"
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER tg_clientes_timestamp
    BEFORE UPDATE ON "public"."clientes"
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER tg_planes_timestamp
    BEFORE UPDATE ON "public"."planes"
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER tg_suscripciones_timestamp
    BEFORE UPDATE ON "public"."suscripciones"
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- Views (not representable in schema.prisma beyond their column shape)
CREATE OR REPLACE VIEW v_aforo_actual AS
SELECT COUNT(*)::INTEGER AS personas_dentro
FROM "public"."asistencias"
WHERE salida IS NULL;

CREATE OR REPLACE VIEW v_panel_clientes AS
SELECT
    c.id                AS cliente_id,
    c.codigo,
    u.nombre,
    u.apellido,
    u.email,
    c.telefono,
    p.nombre            AS plan,
    p.precio,
    s.id                AS suscripcion_id,
    s.fecha_inicio,
    s.fecha_fin,
    s.estado,
    (s.fecha_fin - CURRENT_DATE) AS dias_restantes,
    CASE
        WHEN s.id IS NULL                          THEN 'SIN_PLAN'
        WHEN s.fecha_fin <  CURRENT_DATE           THEN 'VENCIDA'
        WHEN s.fecha_fin <= CURRENT_DATE + 5       THEN 'POR_VENCER'
        ELSE 'VIGENTE'
    END AS semaforo
FROM "public"."clientes" c
JOIN "public"."usuarios" u ON u.id = c.usuario_id
LEFT JOIN LATERAL (
    SELECT * FROM "public"."suscripciones" s2
    WHERE s2.cliente_id = c.id
      AND s2.estado <> 'CANCELADA'
    ORDER BY s2.fecha_fin DESC
    LIMIT 1
) s ON TRUE
LEFT JOIN "public"."planes" p ON p.id = s.plan_id
WHERE c.activo;

