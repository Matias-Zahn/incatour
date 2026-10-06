/*
  Warnings:

  - You are about to drop the column `motivoRechazo` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the `Permiso` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Permiso" DROP CONSTRAINT "Permiso_idpasajero_fkey";

-- DropForeignKey
ALTER TABLE "Permiso" DROP CONSTRAINT "Permiso_idpersonal_fkey";

-- DropForeignKey
ALTER TABLE "Permiso" DROP CONSTRAINT "Permiso_idsalida_fkey";

-- AlterTable
ALTER TABLE "Solicitud" DROP COLUMN "motivoRechazo";

-- DropTable
DROP TABLE "Permiso";

-- CreateTable
CREATE TABLE "Reembolso" (
    "idreembolso" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "idusuario" INTEGER NOT NULL,
    "montoReembolsado" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "fechaReembolso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reembolso_pkey" PRIMARY KEY ("idreembolso")
);

-- CreateTable
CREATE TABLE "GestionSolicitud" (
    "idsolicitud" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "motivoRechazo" TEXT,
    "fechaRespuesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GestionSolicitud_pkey" PRIMARY KEY ("idsolicitud","idservicio")
);

-- CreateTable
CREATE TABLE "PermisoPasajero" (
    "idpermisopasajero" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "idpasajero" INTEGER NOT NULL,
    "nroPermiso" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "estadoTramite" TEXT NOT NULL,

    CONSTRAINT "PermisoPasajero_pkey" PRIMARY KEY ("idpermisopasajero")
);

-- CreateTable
CREATE TABLE "PermisoPersonal" (
    "idpermisopersonal" SERIAL NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "idpersonal" INTEGER NOT NULL,
    "nroPermiso" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "estadoTramite" TEXT NOT NULL,

    CONSTRAINT "PermisoPersonal_pkey" PRIMARY KEY ("idpermisopersonal")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermisoPasajero_nroPermiso_key" ON "PermisoPasajero"("nroPermiso");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoPersonal_nroPermiso_key" ON "PermisoPersonal"("nroPermiso");

-- AddForeignKey
ALTER TABLE "Reembolso" ADD CONSTRAINT "Reembolso_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reembolso" ADD CONSTRAINT "Reembolso_idusuario_fkey" FOREIGN KEY ("idusuario") REFERENCES "Usuario"("idusuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestionSolicitud" ADD CONSTRAINT "GestionSolicitud_idsolicitud_fkey" FOREIGN KEY ("idsolicitud") REFERENCES "Solicitud"("idsolicitud") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestionSolicitud" ADD CONSTRAINT "GestionSolicitud_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPasajero" ADD CONSTRAINT "PermisoPasajero_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPasajero" ADD CONSTRAINT "PermisoPasajero_idpasajero_fkey" FOREIGN KEY ("idpasajero") REFERENCES "Pasajero"("idpasajero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPersonal" ADD CONSTRAINT "PermisoPersonal_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoPersonal" ADD CONSTRAINT "PermisoPersonal_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;
