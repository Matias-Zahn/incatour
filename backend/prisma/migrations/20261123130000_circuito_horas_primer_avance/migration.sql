-- Límite de la alerta SIN_AVANCES: las horas sin primer avance las define cada circuito (antes, 12 fijas)
-- AlterTable
ALTER TABLE "public"."Circuito" ADD COLUMN "horasPrimerAvance" INTEGER NOT NULL DEFAULT 12;
