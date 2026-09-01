SELECT
  c.id AS cliente_id,
  c.codigo,
  u.nombre,
  u.apellido,
  u.email,
  c.telefono,
  p.nombre AS plan,
  p.precio,
  s.id AS suscripcion_id,
  s.fecha_inicio,
  s.fecha_fin,
  s.estado,
  (s.fecha_fin - CURRENT_DATE) AS dias_restantes,
  CASE
    WHEN (s.id IS NULL) THEN 'SIN_PLAN' :: text
    WHEN (s.fecha_fin < CURRENT_DATE) THEN 'VENCIDA' :: text
    WHEN (s.fecha_fin <= (CURRENT_DATE + 5)) THEN 'POR_VENCER' :: text
    ELSE 'VIGENTE' :: text
  END AS semaforo
FROM
  (
    (
      (
        clientes c
        JOIN usuarios u ON ((u.id = c.usuario_id))
      )
      LEFT JOIN LATERAL (
        SELECT
          s2.id,
          s2.cliente_id,
          s2.plan_id,
          s2.fecha_inicio,
          s2.fecha_fin,
          s2.precio_pagado,
          s2.estado,
          s2.creado_en,
          s2.actualizado_en
        FROM
          suscripciones s2
        WHERE
          (
            (s2.cliente_id = c.id)
            AND (s2.estado <> 'CANCELADA' :: estado_suscripcion)
          )
        ORDER BY
          s2.fecha_fin DESC
        LIMIT
          1
      ) s ON (TRUE)
    )
    LEFT JOIN planes p ON ((p.id = s.plan_id))
  )
WHERE
  c.activo;