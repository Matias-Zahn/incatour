-- La salida empieza cuando el guía la inicia, no con el primer avance; y se guarda cuándo terminó de verdad
ALTER TABLE "public"."Salida" ADD COLUMN "fechaHoraInicioReal" TIMESTAMP(3);
ALTER TABLE "public"."Salida" ADD COLUMN "fechaHoraFinReal" TIMESTAMP(3);
