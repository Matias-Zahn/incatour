-- CU-40 (SAL-09): sobrantes pendientes de liberar ante la autoridad, para poder reintentar
ALTER TABLE "public"."Salida" ADD COLUMN "lugaresPorLiberar" INTEGER NOT NULL DEFAULT 0;
