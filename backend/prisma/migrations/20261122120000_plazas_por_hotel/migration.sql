-- Bloque 10 y 12.2 del plan del viernes: una salida puede tener varios hoteles y cada compra manda al grupo a uno.
-- Cada ocupación de hotel con bloqueo lleva las plazas que la venta todavía no asignó (el contador por hotel que
-- reemplaza a Salida."stockLocalAlojamiento", que queda como la suma).

-- 1. Columna nueva: null en los hoteles a solicitud y en el resto de los servicios
ALTER TABLE "public"."Ocupacion" ADD COLUMN "plazasLibres" INTEGER;
ALTER TABLE "public"."Ocupacion" ADD CONSTRAINT check_plazas_libres CHECK ("plazasLibres" IS NULL OR "plazasLibres" >= 0);

-- 2. Hasta acá una salida tenía un solo hotel, y siempre con bloqueo: sus plazas libres son las de la salida
UPDATE "public"."Ocupacion" o
SET "plazasLibres" = COALESCE(s."stockLocalAlojamiento", 0)
FROM "public"."Salida" s
WHERE s."idsalida" = o."idsalida" AND o."tipo" = 'ALOJAMIENTO';

-- 3. Las reservas que salieron de ese bloqueo (Confirmado sin solicitud confirmada) quedan en ese hotel,
-- así la cancelación le devuelve las plazas
UPDATE "public"."Reserva" r
SET "idalojamiento" = (
  SELECT o."idservicio" FROM "public"."Ocupacion" o
  WHERE o."idsalida" = r."idsalida" AND o."tipo" = 'ALOJAMIENTO'
  ORDER BY o."idocupacion" LIMIT 1
)
WHERE r."idalojamiento" IS NULL AND r."estadoAlojamiento" = 'CONFIRMADO'
  AND NOT EXISTS (SELECT 1 FROM "public"."Solicitud" so WHERE so."idreserva" = r."idreserva" AND so."estado" = 'CONFIRMADA');
