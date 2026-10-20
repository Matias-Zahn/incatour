-- DropForeignKey
ALTER TABLE "public"."Solicitud" DROP CONSTRAINT "Solicitud_idservicio_fkey";

-- DropForeignKey
ALTER TABLE "public"."RegistroAuditoria" DROP CONSTRAINT "RegistroAuditoria_idsalida_fkey";

-- DropForeignKey
ALTER TABLE "public"."RegistroAuditoria" DROP CONSTRAINT "RegistroAuditoria_idreserva_fkey";

-- DropForeignKey
ALTER TABLE "public"."RegistroAuditoria" DROP CONSTRAINT "RegistroAuditoria_idpaquete_fkey";

-- AlterTable
ALTER TABLE "public"."Solicitud" DROP COLUMN "idservicio";

-- AlterTable
ALTER TABLE "public"."RegistroAuditoria" DROP COLUMN "idpaquete",
DROP COLUMN "idreserva",
ALTER COLUMN "idsalida" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "public"."Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

