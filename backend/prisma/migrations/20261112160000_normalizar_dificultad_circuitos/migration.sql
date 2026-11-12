-- Normalizar valores previos de dificultad en Circuito a Baja, Media o Alta
UPDATE "public"."Circuito"
SET "dificultad" = 'Baja'
WHERE UPPER(TRIM("dificultad")) IN ('BAJA', 'FACIL', 'FÁCIL');

UPDATE "public"."Circuito"
SET "dificultad" = 'Media'
WHERE UPPER(TRIM("dificultad")) IN ('MEDIA', 'MODERADA', 'MODERADO');

UPDATE "public"."Circuito"
SET "dificultad" = 'Alta'
WHERE UPPER(TRIM("dificultad")) IN ('ALTA', 'EXTREMA', 'DIFICIL', 'DIFÍCIL');
