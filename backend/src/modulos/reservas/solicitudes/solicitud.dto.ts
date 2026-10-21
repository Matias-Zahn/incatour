export class ResolverSolicitudDto {
  private constructor(
    public servicioId: number,
    public resolucion: "ACEPTADA" | "RECHAZADA",
    public motivo?: string
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ResolverSolicitudDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido."];

    const servicioId = obj.servicioId ?? obj.idservicio;
    const resolucion = obj.resolucion ?? obj.estado;
    const motivo = obj.motivo ?? obj.observaciones;

    if (!servicioId || typeof servicioId !== "number") {
      return ["El servicioId es requerido y debe ser un número"];
    }

    if (resolucion !== "ACEPTADA" && resolucion !== "RECHAZADA") {
      return ["La resolución debe ser 'ACEPTADA' o 'RECHAZADA'"];
    }

    if (resolucion === "RECHAZADA" && (!motivo || typeof motivo !== "string" || motivo.trim() === "")) {
      return ["El motivo es obligatorio cuando la resolución es RECHAZADA"];
    }

    return [undefined, new ResolverSolicitudDto(servicioId, resolucion, motivo)];
  }
}
