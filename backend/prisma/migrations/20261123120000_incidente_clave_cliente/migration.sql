-- Límite de incidentes duplicados: la clave que genera el dispositivo del guía; un reenvío con la misma clave no duplica
-- AlterTable
ALTER TABLE "public"."Incidente" ADD COLUMN "claveCliente" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Incidente_idsalida_claveCliente_key" ON "public"."Incidente"("idsalida", "claveCliente");
