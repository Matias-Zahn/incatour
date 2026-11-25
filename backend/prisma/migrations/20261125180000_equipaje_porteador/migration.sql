-- Solo informativo: lo que el porteador carga por pasajero en el sendero y lo que cuesta el excedente (se cobra en el lugar)
ALTER TABLE "public"."Paquete" ADD COLUMN "kgPorteador" DOUBLE PRECISION, ADD COLUMN "costoKgExcedentePorteador" DOUBLE PRECISION;
