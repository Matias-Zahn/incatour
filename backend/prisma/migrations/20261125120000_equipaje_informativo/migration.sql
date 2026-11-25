-- Equipaje informativo: la franquicia y el excedente del transporte vuelven, opcionales, solo para mostrarlos al cliente (no se cobran en la compra)
-- AlterTable
ALTER TABLE "public"."ServicioTransporte" ADD COLUMN "costoPorKgExcedente" DOUBLE PRECISION,
ADD COLUMN "pesoEquipajeIncluido" DOUBLE PRECISION;
