-- Si existen números de habilitación duplicados en bases locales previas, sufijar con idpersonal para no abortar la migración
WITH duplicados AS (
  SELECT "idpersonal",
         ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM("nroHabilitacion")) ORDER BY "idpersonal") AS rn
  FROM "public"."Guia"
  WHERE "nroHabilitacion" IS NOT NULL
)
UPDATE "public"."Guia" g
SET "nroHabilitacion" = g."nroHabilitacion" || '-' || g."idpersonal"
FROM duplicados d
WHERE g."idpersonal" = d."idpersonal" AND d.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Guia_nroHabilitacion_key" ON "public"."Guia"("nroHabilitacion");
