-- RES-07: desglose de precio congelado en la reserva (CU-30). Nulo en reservas anteriores.
ALTER TABLE "public"."Reserva" ADD COLUMN "temporadaAplicada" TEXT,
ADD COLUMN "precioPaquetePorPersona" DOUBLE PRECISION,
ADD COLUMN "adicionalesEquipaje" DOUBLE PRECISION,
ADD COLUMN "moneda" TEXT;
