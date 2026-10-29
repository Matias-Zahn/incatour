/**
 * Valores de estado compartidos por los módulos del rol 2.
 * Usar SIEMPRE estas constantes en lugar de strings sueltos: en el repo ya hay
 * dos vocabularios mezclados ("Confirmada" vs "CONFIRMADA"; "PUBLICADA" vs "ABIERTA/CERRADA").
 */
export const ESTADO = { ACTIVO: "ACTIVO", INACTIVO: "INACTIVO" } as const;

export const ESTADO_RESERVA = { CONFIRMADA: "CONFIRMADA", CANCELADA: "CANCELADA" } as const;

export const ESTADO_ALOJAMIENTO = { CONFIRMADO: "CONFIRMADO", PENDIENTE: "PENDIENTE" } as const;

export const ESTADO_SOLICITUD = {
  PENDIENTE: "PENDIENTE",
  CONFIRMADA: "CONFIRMADA",
  CANCELADA: "CANCELADA", // dada de baja por cancelación de reserva o de salida (CU-32, CU-37)
} as const;

// Plan 9/10: estadoTramite solo toma Emitido, Perdido, Dado de baja o Rechazado (RF-47, sin nroPermiso).
// "No emitido" NO es un estado: es la ausencia de fila de permiso.
export const ESTADO_PERMISO = { EMITIDO: "Emitido", PERDIDO: "Perdido", DADO_DE_BAJA: "Dado de baja", RECHAZADO: "Rechazado" } as const;

export const ESTADO_SALIDA = {
  PUBLICADA: "PUBLICADA",
  EN_CURSO: "EN_CURSO", // desde el primer avance informado por el guía (CU-49)
  FINALIZADA: "FINALIZADA",
  CANCELADA: "CANCELADA",
} as const;

/** "Activas o En curso" (CU-17, CU-20). Unifica los dos vocabularios que hoy usa el repo. */
export const SALIDAS_ACTIVAS = ["PUBLICADA", "ABIERTA", "CERRADA", "EN_CURSO"];

/** Salidas cuyo recorrido todavía no comenzó (CU-37, CU-39). Además se valida fechaInicio > ahora. */
export const SALIDAS_NO_INICIADAS = ["PUBLICADA", "ABIERTA", "CERRADA"];

/** Tope de equipaje que puede declarar cada pasajero al comprar (RES, PR #138). */
export const PESO_MAXIMO_DECLARADO_KG = 20;

export const TIPO_SERVICIO = {
  ALOJAMIENTO: "ALOJAMIENTO",
  TRANSPORTE: "TRANSPORTE",
  TREN: "TREN",
  EQUIPAMIENTO: "EQUIPAMIENTO",
} as const;
export type TipoServicio = (typeof TIPO_SERVICIO)[keyof typeof TIPO_SERVICIO];

/** El rubro del proveedor coincide con el tipo de servicio que puede ofrecer. */
export const TIPOS_PROVEEDOR: string[] = Object.values(TIPO_SERVICIO);

export const MODALIDAD_BLOQUEO_PLAZAS = "BLOQUEO_PLAZAS";

/** ServicioBase no tiene columna "tipo": se deduce de qué subtipo existe (patrón CTI). */
export const tipoDeServicio = (s: {
  alojamiento?: unknown;
  transporte?: unknown;
  tren?: unknown;
  equipamiento?: unknown;
}): TipoServicio | null => {
  if (s.alojamiento) return TIPO_SERVICIO.ALOJAMIENTO;
  if (s.transporte) return TIPO_SERVICIO.TRANSPORTE;
  if (s.tren) return TIPO_SERVICIO.TREN;
  if (s.equipamiento) return TIPO_SERVICIO.EQUIPAMIENTO;
  return null;
};

export const redondear2 = (n: number) => Math.round(n * 100) / 100;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
