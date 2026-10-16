-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_idservicio_fkey";

-- AlterTable
ALTER TABLE "Solicitud" ALTER COLUMN "idservicio" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EvaluacionPersonal" (
    "idsalida" INTEGER NOT NULL,
    "idpersonal" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "fechaEvaluacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluacionPersonal_pkey" PRIMARY KEY ("idsalida","idpersonal")
);

-- CreateTable
CREATE TABLE "EvaluacionProveedor" (
    "idsalida" INTEGER NOT NULL,
    "idproveedor" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "fechaEvaluacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluacionProveedor_pkey" PRIMARY KEY ("idsalida","idproveedor")
);

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionPersonal" ADD CONSTRAINT "EvaluacionPersonal_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionPersonal" ADD CONSTRAINT "EvaluacionPersonal_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionProveedor" ADD CONSTRAINT "EvaluacionProveedor_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionProveedor" ADD CONSTRAINT "EvaluacionProveedor_idproveedor_fkey" FOREIGN KEY ("idproveedor") REFERENCES "Proveedor"("idproveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CU-42: el puntaje va de 1 a 5
ALTER TABLE "EvaluacionPersonal" ADD CONSTRAINT check_puntaje_personal CHECK ("puntaje" BETWEEN 1 AND 5);
ALTER TABLE "EvaluacionProveedor" ADD CONSTRAINT check_puntaje_proveedor CHECK ("puntaje" BETWEEN 1 AND 5);
