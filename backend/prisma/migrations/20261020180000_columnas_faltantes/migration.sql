-- Columnas que el código de proveedores (CU-15/16) y logística (CU-39) ya usaba
-- pero que nunca se habían migrado.

-- Los proveedores existentes quedan con contacto vacío; desde ahora es obligatorio
ALTER TABLE "public"."Proveedor" ADD COLUMN "datosContacto" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Proveedor" ALTER COLUMN "datosContacto" DROP DEFAULT;

ALTER TABLE "public"."SalidaServicio" ADD COLUMN "comprobanteReserva" TEXT;
