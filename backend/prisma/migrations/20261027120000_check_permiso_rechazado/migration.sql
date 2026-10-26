-- INF-01 (RF-47): el CHECK de estadoTramite tiene que admitir el permiso Rechazado
ALTER TABLE "public"."PermisoPasajero" DROP CONSTRAINT check_estado_pasajero;
ALTER TABLE "public"."PermisoPasajero" ADD CONSTRAINT check_estado_pasajero CHECK ("estadoTramite" IN ('Emitido', 'Perdido', 'Dado de baja', 'Rechazado'));

ALTER TABLE "public"."PermisoPersonal" DROP CONSTRAINT check_estado_personal;
ALTER TABLE "public"."PermisoPersonal" ADD CONSTRAINT check_estado_personal CHECK ("estadoTramite" IN ('Emitido', 'Perdido', 'Dado de baja', 'Rechazado'));
