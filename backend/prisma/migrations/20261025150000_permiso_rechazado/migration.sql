-- INT-08 (RF-47): el permiso rechazado por la autoridad se registra sin número
ALTER TABLE "public"."PermisoPasajero" ALTER COLUMN "nroPermiso" DROP NOT NULL;

ALTER TABLE "public"."PermisoPersonal" ALTER COLUMN "nroPermiso" DROP NOT NULL;
