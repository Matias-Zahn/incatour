export class ResolverSolicitudDto {
  private constructor(
    public servicioId: number,
    public resolucion: "ACEPTADA" | "RECHAZADA",
    public motivo?: string
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ResolverSolicitudDto?] {
    const { servicioId, resolucion, motivo } = obj;

    if (!servicioId || typeof servicioId !== "number") {
      return ["El servicioId es requerido y debe ser un número"];
    }

    if (resolucion !== "ACEPTADA" && resolucion !== "RECHAZADA") {
      return ["La resolución debe ser 'ACEPTADA' o 'RECHAZADA'"];
    }

    if (resolucion === "RECHAZADA" && (!motivo || motivo.trim() === "")) {
      return ["El motivo es obligatorio cuando la resolución es RECHAZADA"];
    }

    return [undefined, new ResolverSolicitudDto(servicioId, resolucion, motivo)];
  }
}
