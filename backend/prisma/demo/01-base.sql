-- BEAST MODE · 01 · Planes y personal
-- Generado por prisma/demo/generar-demo.ts. Fechas relativas al momento de ejecución.
-- Requiere una base recién migrada (npx prisma migrate deploy) y vacía.
BEGIN;
-- Las horas se escriben en hora de Guatemala.
SET LOCAL TIME ZONE 'America/Guatemala';

-- Planes
INSERT INTO planes (id, nombre, descripcion, precio, duracion_dias, activo, creado_en, actualizado_en) VALUES
  (1, 'Visita', 'Acceso por un día', 25.00, 1, true, ((CURRENT_DATE - 33) + TIME '10:00:00'), ((CURRENT_DATE - 33) + TIME '10:00:00')),
  (2, 'Quincenal', 'Acceso por 15 días', 140.00, 15, true, ((CURRENT_DATE - 33) + TIME '10:00:00'), ((CURRENT_DATE - 33) + TIME '10:00:00')),
  (3, 'Mensual', 'Acceso ilimitado por 30 días', 250.00, 30, true, ((CURRENT_DATE - 33) + TIME '10:00:00'), ((CURRENT_DATE - 33) + TIME '10:00:00')),
  (4, 'Trimestral', 'Acceso ilimitado por 90 días', 675.00, 90, true, ((CURRENT_DATE - 33) + TIME '10:00:00'), ((CURRENT_DATE - 33) + TIME '10:00:00')),
  (5, 'Anual', 'Acceso ilimitado por 365 días', 2400.00, 365, true, ((CURRENT_DATE - 33) + TIME '10:00:00'), ((CURRENT_DATE - 33) + TIME '10:00:00'));

-- Personal (contraseñas en usuarios-demo.md)
INSERT INTO usuarios (id, nombre, apellido, email, password_hash, rol, activo, creado_en, actualizado_en) VALUES
  (1, 'Rodrigo', 'Estrada', 'rodrigo.estrada@beastmodegym.com', '$2b$10$3M.Q6cDEFJJApWKyW8IZW.trE8xtHDE/7tsBtOGb5ITGxL0kG3R2m', 'ADMIN', true, ((CURRENT_DATE - 33) + TIME '10:15:00'), ((CURRENT_DATE - 33) + TIME '10:15:00')),
  (2, 'Andrea', 'Samayoa', 'andrea.samayoa@beastmodegym.com', '$2b$10$cxzLL4c.EGmBfgj9YanKceQyQr5McKxFqP.5aT3Ab3jKT2ajX9M4e', 'ADMIN', true, ((CURRENT_DATE - 33) + TIME '10:20:00'), ((CURRENT_DATE - 33) + TIME '10:20:00')),
  (3, 'Kevin', 'Ajú', 'kevin.aju@beastmodegym.com', '$2b$10$A1WiTguCDpFmhMC/rGezqO3DlRNuDXgOd9vjlP9RxyJ5edY07oXDe', 'ENTRENADOR', true, ((CURRENT_DATE - 33) + TIME '10:25:00'), ((CURRENT_DATE - 33) + TIME '10:25:00')),
  (4, 'Gabriela', 'Paz', 'gabriela.paz@beastmodegym.com', '$2b$10$GW.lao7x1tdkGAxRa/u2OuGGhDeqaOGkuKl8Md3y6f3VsRk3O/ol2', 'ENTRENADOR', true, ((CURRENT_DATE - 33) + TIME '10:30:00'), ((CURRENT_DATE - 33) + TIME '10:30:00')),
  (5, 'Luis', 'Coyoy', 'luis.coyoy@beastmodegym.com', '$2b$10$OBo0kr6qMwiXbx2XPvVQ8O8G0s79iIeX3itEf00YS/wl3MXJxjLBm', 'ENTRENADOR', true, ((CURRENT_DATE - 33) + TIME '10:35:00'), ((CURRENT_DATE - 33) + TIME '10:35:00'));

SELECT setval(pg_get_serial_sequence('planes', 'id'), (SELECT MAX(id) FROM planes));
SELECT setval(pg_get_serial_sequence('usuarios', 'id'), (SELECT MAX(id) FROM usuarios));

COMMIT;
