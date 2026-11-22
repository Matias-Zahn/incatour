-- B6: el equipaje se pesa y cobra en persona; se quitan la franquicia del transporte y el adicional congelado de la reserva
-- AlterTable
ALTER TABLE "public"."Reserva" DROP COLUMN "adicionalesEquipaje";

-- AlterTable
ALTER TABLE "public"."ServicioTransporte" DROP COLUMN "costoPorKgExcedente",
DROP COLUMN "pesoEquipajeIncluido";

