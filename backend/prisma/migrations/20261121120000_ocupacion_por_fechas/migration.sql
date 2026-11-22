-- A1: stock por día. SalidaServicio y SalidaEquipamiento pasan a Ocupacion (con fechas) y los contadores
-- de disponible pasan a ser totales que no cambian con el uso. Bloque 8: las plazas del hotel admiten NULL.

-- 1. Tabla nueva y columnas de totales
CREATE TABLE "public"."Ocupacion" (
    "idocupacion" SERIAL NOT NULL,
    "idservicio" INTEGER NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "comprobanteReserva" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ocupacion_pkey" PRIMARY KEY ("idocupacion")
);

ALTER TABLE "public"."ServicioAlojamiento" ADD COLUMN "plazasTotales" INTEGER;
ALTER TABLE "public"."ServicioEquipamiento" ADD COLUMN "cantidadTotal" INTEGER;

-- 2. Equipamiento: total = disponible + lo que sigue afuera (salidas no canceladas sin la devolución registrada).
-- Las canceladas ya lo devolvieron (CU-37) y las que registraron la devolución también (CU-41)
UPDATE "public"."ServicioEquipamiento" e
SET "cantidadTotal" = e."cantidadDisponible" + COALESCE((
  SELECT SUM(se."cantidad")
  FROM "public"."SalidaEquipamiento" se
  JOIN "public"."Salida" s ON s."idsalida" = se."idsalida"
  WHERE se."idservicio" = e."idservicio"
    AND s."estado" <> 'CANCELADA'
    AND NOT EXISTS (
      SELECT 1 FROM "public"."RegistroAuditoria" a
      WHERE a."idsalida" = s."idsalida" AND a."cambios"->>'tipoOperacion' = 'DEVOLUCION_EQUIPAMIENTO'
    )
), 0);

-- 3. Hotel: plazas que tiene comprometidas cada salida no cancelada.
-- PUBLICADA: todo el bloqueo. Las demás: lo que sigue bloqueado más las reservas confirmadas que salieron
-- del bloqueo (Confirmado sin solicitud confirmada), la regla de plazasADevolverAlHotel
CREATE TEMP TABLE "hotel_salida" AS
SELECT ss."idsalida", ss."idservicio", s."estado", s."fechaInicio"::date AS "inicio", s."fechaFin"::date AS "fin",
  COALESCE((s."definicionPaquete"->>'nochesPrevias')::int, p."nochesPrevias") AS "previas",
  COALESCE((s."definicionPaquete"->>'nochesPosteriores')::int, p."nochesPosteriores") AS "posteriores",
  CASE WHEN s."estado" = 'PUBLICADA' THEN s."tamanoMaximo"
  ELSE COALESCE(s."stockLocalAlojamiento", 0) + COALESCE((
    SELECT SUM(r."cantidadPasajeros")
    FROM "public"."Reserva" r
    WHERE r."idsalida" = s."idsalida" AND r."estado" = 'CONFIRMADA' AND r."estadoAlojamiento" = 'CONFIRMADO'
      AND NOT EXISTS (SELECT 1 FROM "public"."Solicitud" so WHERE so."idreserva" = r."idreserva" AND so."estado" = 'CONFIRMADA')
  ), 0) END AS "plazas"
FROM "public"."SalidaServicio" ss
JOIN "public"."Salida" s ON s."idsalida" = ss."idsalida"
JOIN "public"."Paquete" p ON p."idpaquete" = s."idpaquete"
WHERE ss."tipo" = 'ALOJAMIENTO' AND s."estado" <> 'CANCELADA';

-- Total = libre + lo comprometido por las salidas activas (las finalizadas ya devolvieron sus plazas)
UPDATE "public"."ServicioAlojamiento" a
SET "plazasTotales" = a."capacidadDisponible" + COALESCE((
  SELECT SUM(h."plazas") FROM "hotel_salida" h
  WHERE h."idservicio" = a."idservicio" AND h."estado" IN ('PUBLICADA', 'CERRADA', 'EN_CURSO')
), 0);

-- 4. Copiar a Ocupacion, con las finalizadas como historial (las canceladas no se copian: no ocupan)
INSERT INTO "public"."Ocupacion" ("idservicio", "idsalida", "tipo", "desde", "hasta", "cantidad")
SELECT se."idservicio", se."idsalida", 'EQUIPAMIENTO', s."fechaInicio"::date, s."fechaFin"::date + 2, se."cantidad"
FROM "public"."SalidaEquipamiento" se
JOIN "public"."Salida" s ON s."idsalida" = se."idsalida"
WHERE s."estado" <> 'CANCELADA';

INSERT INTO "public"."Ocupacion" ("idservicio", "idsalida", "tipo", "desde", "hasta", "cantidad", "comprobanteReserva")
SELECT ss."idservicio", ss."idsalida", 'TRANSPORTE', s."fechaInicio"::date, s."fechaFin"::date, 1, ss."comprobanteReserva"
FROM "public"."SalidaServicio" ss
JOIN "public"."Salida" s ON s."idsalida" = ss."idsalida"
WHERE ss."tipo" = 'TRANSPORTE' AND s."estado" <> 'CANCELADA';

-- El hotel solo en las noches previas y posteriores (durante el trekking el grupo acampa)
INSERT INTO "public"."Ocupacion" ("idservicio", "idsalida", "tipo", "desde", "hasta", "cantidad")
SELECT "idservicio", "idsalida", 'ALOJAMIENTO', "inicio" - "previas", "inicio" - 1, "plazas"
FROM "hotel_salida" WHERE "previas" > 0 AND "plazas" > 0;

INSERT INTO "public"."Ocupacion" ("idservicio", "idsalida", "tipo", "desde", "hasta", "cantidad")
SELECT "idservicio", "idsalida", 'ALOJAMIENTO', "fin", "fin" + "posteriores" - 1, "plazas"
FROM "hotel_salida" WHERE "posteriores" > 0 AND "plazas" > 0;

DROP TABLE "hotel_salida";

-- 5. Borrar lo viejo
ALTER TABLE "public"."ServicioEquipamiento" ALTER COLUMN "cantidadTotal" SET NOT NULL;
ALTER TABLE "public"."ServicioEquipamiento" DROP COLUMN "cantidadDisponible";
ALTER TABLE "public"."ServicioAlojamiento" DROP COLUMN "capacidadDisponible";

ALTER TABLE "public"."SalidaServicio" DROP CONSTRAINT "SalidaServicio_idsalida_fkey";
ALTER TABLE "public"."SalidaServicio" DROP CONSTRAINT "SalidaServicio_idservicio_fkey";
ALTER TABLE "public"."SalidaEquipamiento" DROP CONSTRAINT "SalidaEquipamiento_idsalida_fkey";
ALTER TABLE "public"."SalidaEquipamiento" DROP CONSTRAINT "SalidaEquipamiento_idservicio_fkey";
DROP TABLE "public"."SalidaServicio";
DROP TABLE "public"."SalidaEquipamiento";

-- Índices y claves de Ocupacion
CREATE INDEX "Ocupacion_idservicio_desde_hasta_idx" ON "public"."Ocupacion"("idservicio", "desde", "hasta");
CREATE INDEX "Ocupacion_idsalida_idx" ON "public"."Ocupacion"("idsalida");
ALTER TABLE "public"."Ocupacion" ADD CONSTRAINT "Ocupacion_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "public"."ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Ocupacion" ADD CONSTRAINT "Ocupacion_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "public"."Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;
