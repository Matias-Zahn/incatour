ALTER TABLE "Salida"
ADD CONSTRAINT "check_stocklocal_positivo" CHECK ("stockLocal" >= 0);

ALTER TABLE "Permiso"
ADD CONSTRAINT "check_permiso_exclusivo" CHECK (
    (
        "idpasajero" IS NOT NULL
        AND "idpersonal" IS NULL
    )
    OR (
        "idpasajero" IS NULL
        AND "idpersonal" IS NOT NULL
    )
);