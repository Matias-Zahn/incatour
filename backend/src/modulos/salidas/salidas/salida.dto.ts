export class ConsultarSalidasDto {
  private constructor(
    public idpaquete: number | undefined,
    public estado: string | undefined,
    public desde: Date | undefined,
    public hasta: Date | undefined,
    public idguia: number | undefined,
  ) {}

  // Los filtros llegan por query string: siempre texto y todos opcionales
  public static create(query: { [key: string]: any }): [string | undefined, ConsultarSalidasDto?] {
    const { idpaquete, estado, desde, hasta, idguia } = query;

    const [errPaquete, paquete] = aEntero(idpaquete, "idpaquete");
    if (errPaquete) return [errPaquete];

    const [errGuia, guia] = aEntero(idguia, "idguia");
    if (errGuia) return [errGuia];

    if (estado !== undefined && typeof estado !== "string") return ["estado debe ser un texto"];

    const [errDesde, fechaDesde] = aFecha(desde, "desde");
    if (errDesde) return [errDesde];

    const [errHasta, fechaHasta] = aFecha(hasta, "hasta");
    if (errHasta) return [errHasta];

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return ["desde no puede ser posterior a hasta"];

    return [undefined, new ConsultarSalidasDto(paquete, estado, fechaDesde, fechaHasta, guia)];
  }
}

const aEntero = (valor: unknown, campo: string): [string | undefined, number?] => {
  if (valor === undefined) return [undefined];
  const numero = Number(valor);
  if (typeof valor !== "string" || !Number.isInteger(numero) || numero <= 0) {
    return [`${campo} debe ser un número entero positivo`];
  }
  return [undefined, numero];
};

const aFecha = (valor: unknown, campo: string): [string | undefined, Date?] => {
  if (valor === undefined) return [undefined];
  const fecha = new Date(String(valor));
  if (typeof valor !== "string" || isNaN(fecha.getTime())) {
    return [`${campo} debe ser una fecha válida (AAAA-MM-DD)`];
  }
  return [undefined, fecha];
};
