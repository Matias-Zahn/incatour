/*
  Warnings:

  - You are about to drop the column `apellido` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `Cliente` table. All the data in the column will be lost.
  - The primary key for the `Idioma` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `ididioma` on the `Idioma` table. All the data in the column will be lost.
  - You are about to drop the column `idservicioGarantizado` on the `Paquete` table. All the data in the column will be lost.
  - You are about to drop the column `fechaHabilitacion` on the `Personal` table. All the data in the column will be lost.
  - You are about to drop the column `idusuario` on the `Personal` table. All the data in the column will be lost.
  - You are about to drop the column `nroHabilitacion` on the `Personal` table. All the data in the column will be lost.
  - You are about to drop the column `idservicioAlojamiento` on the `Salida` table. All the data in the column will be lost.
  - You are about to drop the column `idservicioTransporte` on the `Salida` table. All the data in the column will be lost.
  - You are about to drop the column `idservicioTren` on the `Salida` table. All the data in the column will be lost.
  - You are about to drop the `PersonalIdioma` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaccion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Valoracion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `esNativo` to the `Idioma` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idpersonal` to the `Idioma` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nivelDominio` to the `Idioma` table without a default value. This is not possible if the table is not empty.
  - Added the required column `apellido` to the `Usuario` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Paquete" DROP CONSTRAINT "Paquete_idservicioGarantizado_fkey";

-- DropForeignKey
ALTER TABLE "Personal" DROP CONSTRAINT "Personal_idusuario_fkey";

-- DropForeignKey
ALTER TABLE "PersonalIdioma" DROP CONSTRAINT "PersonalIdioma_ididioma_fkey";

-- DropForeignKey
ALTER TABLE "PersonalIdioma" DROP CONSTRAINT "PersonalIdioma_idpersonal_fkey";

-- DropForeignKey
ALTER TABLE "Salida" DROP CONSTRAINT "Salida_idservicioAlojamiento_fkey";

-- DropForeignKey
ALTER TABLE "Salida" DROP CONSTRAINT "Salida_idservicioTransporte_fkey";

-- DropForeignKey
ALTER TABLE "Salida" DROP CONSTRAINT "Salida_idservicioTren_fkey";

-- DropForeignKey
ALTER TABLE "Transaccion" DROP CONSTRAINT "Transaccion_idreserva_fkey";

-- DropForeignKey
ALTER TABLE "Valoracion" DROP CONSTRAINT "Valoracion_idreserva_idpasajero_fkey";

-- DropIndex
DROP INDEX "Personal_idusuario_key";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "apellido",
DROP COLUMN "nombre";

-- AlterTable
ALTER TABLE "Idioma" DROP CONSTRAINT "Idioma_pkey",
DROP COLUMN "ididioma",
ADD COLUMN     "esNativo" BOOLEAN NOT NULL,
ADD COLUMN     "idpersonal" INTEGER NOT NULL,
ADD COLUMN     "nivelDominio" TEXT NOT NULL,
ADD CONSTRAINT "Idioma_pkey" PRIMARY KEY ("idpersonal", "nombre");

-- AlterTable
ALTER TABLE "Paquete" DROP COLUMN "idservicioGarantizado";

-- AlterTable
ALTER TABLE "Personal" DROP COLUMN "fechaHabilitacion",
DROP COLUMN "idusuario",
DROP COLUMN "nroHabilitacion";

-- AlterTable
ALTER TABLE "Salida" DROP COLUMN "idservicioAlojamiento",
DROP COLUMN "idservicioTransporte",
DROP COLUMN "idservicioTren";

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "apellido" TEXT NOT NULL,
ADD COLUMN     "nombre" TEXT NOT NULL;

-- DropTable
DROP TABLE "PersonalIdioma";

-- DropTable
DROP TABLE "Transaccion";

-- DropTable
DROP TABLE "Valoracion";

-- CreateTable
CREATE TABLE "Pago" (
    "nrotransaccion" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "medioPago" TEXT NOT NULL,
    "estadoTransaccion" TEXT NOT NULL,
    "fechahora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("nrotransaccion")
);

-- CreateTable
CREATE TABLE "Resenia" (
    "idcliente" INTEGER NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "valoracion" INTEGER NOT NULL,
    "comentario" TEXT,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resenia_pkey" PRIMARY KEY ("idcliente","idsalida")
);

-- CreateTable
CREATE TABLE "Guia" (
    "idpersonal" INTEGER NOT NULL,
    "idusuario" INTEGER,
    "nroHabilitacion" TEXT,
    "fechaHabilitacion" TIMESTAMP(3),

    CONSTRAINT "Guia_pkey" PRIMARY KEY ("idpersonal")
);

-- CreateTable
CREATE TABLE "GarantiaEstablecimiento" (
    "idpaquete" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,

    CONSTRAINT "GarantiaEstablecimiento_pkey" PRIMARY KEY ("idpaquete")
);

-- CreateTable
CREATE TABLE "SalidaServicio" (
    "idsalida" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Guia_idusuario_key" ON "Guia"("idusuario");

-- CreateIndex
CREATE UNIQUE INDEX "SalidaServicio_idsalida_tipo_key" ON "SalidaServicio"("idsalida", "tipo");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resenia" ADD CONSTRAINT "Resenia_idcliente_fkey" FOREIGN KEY ("idcliente") REFERENCES "Cliente"("idcliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resenia" ADD CONSTRAINT "Resenia_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guia" ADD CONSTRAINT "Guia_idusuario_fkey" FOREIGN KEY ("idusuario") REFERENCES "Usuario"("idusuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarantiaEstablecimiento" ADD CONSTRAINT "GarantiaEstablecimiento_idpaquete_fkey" FOREIGN KEY ("idpaquete") REFERENCES "Paquete"("idpaquete") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarantiaEstablecimiento" ADD CONSTRAINT "GarantiaEstablecimiento_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaServicio" ADD CONSTRAINT "SalidaServicio_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaServicio" ADD CONSTRAINT "SalidaServicio_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idioma" ADD CONSTRAINT "Idioma_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================
-- RESTRICCIONES MANUALES (INYECCIÓN SQL)
-- ==========================================

-- CHECK en Salida (Stock)
ALTER TABLE "Salida" ADD CONSTRAINT check_stock_local CHECK ("stockLocal" >= 0);
ALTER TABLE "Salida" ADD CONSTRAINT check_stock_alojamiento CHECK ("stockLocalAlojamiento" IS NULL OR "stockLocalAlojamiento" >= 0);

-- CHECK en Permisos (Estados)
ALTER TABLE "PermisoPasajero" ADD CONSTRAINT check_estado_pasajero CHECK ("estadoTramite" IN ('Emitido', 'Perdido', 'Dado de baja'));
ALTER TABLE "PermisoPersonal" ADD CONSTRAINT check_estado_personal CHECK ("estadoTramite" IN ('Emitido', 'Perdido', 'Dado de baja'));

