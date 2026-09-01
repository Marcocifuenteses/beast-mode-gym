SELECT
  (count(*)) :: integer AS personas_dentro
FROM
  asistencias
WHERE
  (salida IS NULL);