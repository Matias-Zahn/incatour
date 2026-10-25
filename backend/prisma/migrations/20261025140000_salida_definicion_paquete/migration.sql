-- CAT-05: foto de la definición del paquete en cada salida (las tarifas siguen vivas)
ALTER TABLE "public"."Salida" ADD COLUMN "definicionPaquete" JSONB;

-- Las salidas existentes toman la foto de su paquete actual (misma forma que arma el código)
UPDATE "public"."Salida" s
SET "definicionPaquete" = jsonb_build_object(
  'condiciones', p."condiciones",
  'tipoGarantia', p."tipoGarantia",
  'localidadGarantizada', p."localidadGarantizada",
  'categoriaGarantizada', p."categoriaGarantizada",
  'tipoHabitacionGarantizada', p."tipoHabitacionGarantizada",
  'establecimiento', (
    SELECT jsonb_build_object(
      'idservicio', sb."idservicio",
      'nombreServicio', sb."nombreServicio",
      'localidad', sb."localidad",
      'categoria', sa."categoria"
    )
    FROM "public"."GarantiaEstablecimiento" g
    JOIN "public"."ServicioBase" sb ON sb."idservicio" = g."idservicio"
    LEFT JOIN "public"."ServicioAlojamiento" sa ON sa."idservicio" = sb."idservicio"
    WHERE g."idpaquete" = p."idpaquete"
    LIMIT 1
  ),
  'servicios', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'idservicio', sb."idservicio",
        'nombreServicio', sb."nombreServicio",
        'transporte', CASE WHEN st."idservicio" IS NULL THEN NULL ELSE jsonb_build_object(
          'pesoEquipajeIncluido', st."pesoEquipajeIncluido",
          'costoPorKgExcedente', st."costoPorKgExcedente"
        ) END
      ) ORDER BY sb."idservicio"
    )
    FROM "public"."PaqueteServicio" ps
    JOIN "public"."ServicioBase" sb ON sb."idservicio" = ps."idservicio"
    LEFT JOIN "public"."ServicioTransporte" st ON st."idservicio" = sb."idservicio"
    WHERE ps."idpaquete" = p."idpaquete"
  ), '[]'::jsonb),
  'nochesPrevias', p."nochesPrevias",
  'nochesPosteriores', p."nochesPosteriores",
  'diasDisponibles', p."diasDisponibles",
  'diasMinimosReintegro', p."diasMinimosReintegro"
)
FROM "public"."Paquete" p
WHERE p."idpaquete" = s."idpaquete";
