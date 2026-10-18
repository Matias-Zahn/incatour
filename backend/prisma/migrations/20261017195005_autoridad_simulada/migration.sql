-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "autoridad";

-- CreateTable
CREATE TABLE "autoridad"."cupo_diario" (
    "fecha" TEXT NOT NULL,
    "ocupados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cupo_diario_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "autoridad"."bloqueo" (
    "idBloqueo" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "lugares" INTEGER NOT NULL,

    CONSTRAINT "bloqueo_pkey" PRIMARY KEY ("idBloqueo")
);

-- CreateTable
CREATE TABLE "autoridad"."permiso" (
    "nroPermiso" TEXT NOT NULL,
    "idBloqueo" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("nroPermiso")
);

-- AddForeignKey
ALTER TABLE "autoridad"."permiso" ADD CONSTRAINT "permiso_idBloqueo_fkey" FOREIGN KEY ("idBloqueo") REFERENCES "autoridad"."bloqueo"("idBloqueo") ON DELETE CASCADE ON UPDATE CASCADE;

-- El cupo diario nunca puede superar el tope de la autoridad ni quedar negativo
ALTER TABLE "autoridad"."cupo_diario" ADD CONSTRAINT check_cupo_diario CHECK ("ocupados" BETWEEN 0 AND 500);
