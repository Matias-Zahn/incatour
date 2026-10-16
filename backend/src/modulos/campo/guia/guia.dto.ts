// CU-49: estado con el que el guía informa cada tramo
export const ESTADO_TRAMO = { COMPLETADO: "COMPLETADO", DEMORADO: "DEMORADO" } as const;

// CU-49: registrarAvance(salidaId, hitoId, estadoTramo, fechaHoraLlegada)
export class RegistrarAvanceDto {
  private constructor(
    public numeroOrden: number,
    public estadoTramo: string,
    public fechaHoraLlegada: Date,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, RegistrarAvanceDto?] {
    const { numeroOrden, estadoTramo, fechaHoraLlegada } = obj;

    if (typeof numeroOrden !== "number" || !Number.isInteger(numeroOrden) || numeroOrden <= 0) {
      return ["numeroOrden (la etapa alcanzada) es requerido y debe ser un entero positivo"];
    }
    const estados: string[] = Object.values(ESTADO_TRAMO);
    if (!estados.includes(estadoTramo)) return [`estadoTramo debe ser ${estados.join(" o ")}`];

    const llegada = new Date(String(fechaHoraLlegada));
    if (fechaHoraLlegada === undefined || isNaN(llegada.getTime())) {
      return ["fechaHoraLlegada es requerida y debe ser una fecha y hora válida (ej. 2026-12-10T14:35:00-05:00)"];
    }

    return [undefined, new RegistrarAvanceDto(numeroOrden, estadoTramo, llegada)];
  }
}

// CU-50: opciones que el guía elige al registrar un incidente
export const TIPO_INCIDENTE = ["ACCIDENTE", "SALUD", "CLIMA", "EQUIPAMIENTO", "RETRASO", "OTRO"] as const;
export const NIVEL_GRAVEDAD = ["BAJO", "MEDIO", "CRITICO"] as const;

// CU-50: confirmarRegistro(salidaId, tipo, desc, gravedad, fechaOcurrencia, arrayAfectados)
export class RegistrarIncidenteDto {
  private constructor(
    public tipoIncidente: string,
    public descripcion: string,
    public nivelGravedad: string,
    public fechaHoraOcurrencia: Date,
    public pasajerosAfectados: number[],
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, RegistrarIncidenteDto?] {
    const { tipoIncidente, descripcion, nivelGravedad, fechaHoraOcurrencia, pasajerosAfectados = [] } = obj;

    if (!(TIPO_INCIDENTE as readonly string[]).includes(tipoIncidente)) {
      return [`tipoIncidente debe ser uno de: ${TIPO_INCIDENTE.join(", ")}`];
    }
    if (typeof descripcion !== "string" || descripcion.trim().length < 5 || descripcion.trim().length > 1000) {
      return ["La descripción es requerida (entre 5 y 1000 caracteres)"];
    }
    if (!(NIVEL_GRAVEDAD as readonly string[]).includes(nivelGravedad)) {
      return [`nivelGravedad debe ser ${NIVEL_GRAVEDAD.join(", ")}`];
    }
    const ocurrencia = new Date(String(fechaHoraOcurrencia));
    if (fechaHoraOcurrencia === undefined || isNaN(ocurrencia.getTime())) {
      return ["fechaHoraOcurrencia es requerida y debe ser una fecha y hora válida"];
    }
    // FA1: pasajeros afectados, opcional
    if (
      !Array.isArray(pasajerosAfectados) ||
      !pasajerosAfectados.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0) ||
      new Set(pasajerosAfectados).size !== pasajerosAfectados.length
    ) {
      return ["pasajerosAfectados debe ser una lista de ids de pasajero sin repetir"];
    }

    return [
      undefined,
      new RegistrarIncidenteDto(tipoIncidente, descripcion.trim(), nivelGravedad, ocurrencia, pasajerosAfectados),
    ];
  }
}
