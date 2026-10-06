/*
  Warnings:

  - Added the required column `idpasajero` to the `Valoracion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Valoracion" DROP CONSTRAINT "Valoracion_idreserva_fkey";

-- AlterTable
ALTER TABLE "Valoracion" ADD COLUMN     "idpasajero" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Valoracion" ADD CONSTRAINT "Valoracion_idreserva_idpasajero_fkey" FOREIGN KEY ("idreserva", "idpasajero") REFERENCES "ReservaPasajero"("idreserva", "idpasajero") ON DELETE RESTRICT ON UPDATE CASCADE;
