-- RES-06: plazo de reintegro por paquete, congelado en la reserva, y condición aplicada en el reembolso
ALTER TABLE "public"."Paquete" ADD COLUMN "diasMinimosReintegro" INTEGER;

ALTER TABLE "public"."Reserva" ADD COLUMN "diasMinimosReintegro" INTEGER;

ALTER TABLE "public"."Reembolso" ADD COLUMN "condicionAplicada" TEXT;
