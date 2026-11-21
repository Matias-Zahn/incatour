-- Venta continua (bloques 2, 4 y 12.2 del plan del viernes): el paquete guarda el "Sale desde" y la regla de
-- cada equipo, la salida guarda su corte de venta y la reserva el hotel al que fue el grupo.

-- 1. Columnas nuevas
ALTER TABLE "public"."Paquete" ADD COLUMN "diasCierreVenta" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "public"."PaqueteServicio" ADD COLUMN "cantidad" INTEGER, ADD COLUMN "cadaPasajeros" INTEGER;
ALTER TABLE "public"."Reserva" ADD COLUMN "idalojamiento" INTEGER;
ALTER TABLE "public"."Salida" ADD COLUMN "diasCierreVenta" INTEGER NOT NULL DEFAULT 2;

-- 2. B2: el equipo que ya estaba en un paquete queda en 1 por pasajero
UPDATE "public"."PaqueteServicio" ps
SET "cantidad" = 1, "cadaPasajeros" = 1
WHERE EXISTS (SELECT 1 FROM "public"."ServicioEquipamiento" e WHERE e."idservicio" = ps."idservicio");

-- 3. B2: "Sale desde" obligatorio. Los paquetes por establecimiento sin localidad toman la de su hotel garantizado
-- (GarantiaEstablecimiento tiene un solo hotel por paquete, así que no puede haber dos localidades)
UPDATE "public"."Paquete" p
SET "localidadGarantizada" = sb."localidad"
FROM "public"."GarantiaEstablecimiento" g
JOIN "public"."ServicioBase" sb ON sb."idservicio" = g."idservicio"
WHERE g."idpaquete" = p."idpaquete" AND (p."localidadGarantizada" IS NULL OR btrim(p."localidadGarantizada") = '');

-- Si queda alguno sin localidad (sin hotel garantizado), la migración se corta y los lista para corregirlos a mano
DO $$
DECLARE pendientes TEXT;
BEGIN
  SELECT string_agg("nroPaquete", ', ') INTO pendientes FROM "public"."Paquete"
  WHERE "localidadGarantizada" IS NULL OR btrim("localidadGarantizada") = '';
  IF pendientes IS NOT NULL THEN
    RAISE EXCEPTION 'Paquetes sin "Sale desde" (localidadGarantizada) ni hotel garantizado: %. Cargala a mano y volvé a migrar', pendientes;
  END IF;
END $$;

ALTER TABLE "public"."Paquete" ALTER COLUMN "localidadGarantizada" SET NOT NULL;

-- 4. B4: corte de venta de las salidas existentes. Si el paquete tiene noches de hotel y la salida no ocupó
-- un hotel con bloqueo, las compras van a solicitud: rige el corte largo (DIAS_CIERRE_SOLICITUD = 5)
UPDATE "public"."Salida" s
SET "diasCierreVenta" = 5
FROM "public"."Paquete" p
WHERE p."idpaquete" = s."idpaquete"
  AND COALESCE((s."definicionPaquete"->>'nochesPrevias')::int, p."nochesPrevias")
    + COALESCE((s."definicionPaquete"->>'nochesPosteriores')::int, p."nochesPosteriores") > 0
  AND NOT EXISTS (SELECT 1 FROM "public"."Ocupacion" o WHERE o."idsalida" = s."idsalida" AND o."tipo" = 'ALOJAMIENTO');

-- 5. 12.2: la reserva guarda su hotel (lo completa la compra; las anteriores quedan en null)
ALTER TABLE "public"."Reserva" ADD CONSTRAINT "Reserva_idalojamiento_fkey" FOREIGN KEY ("idalojamiento") REFERENCES "public"."ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;
