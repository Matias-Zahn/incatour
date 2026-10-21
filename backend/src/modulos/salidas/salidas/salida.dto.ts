export class ConsultarSalidasDto {
  private constructor(
    public idpaquete: number | undefined,
    public estado: string | undefined,
    public desde: Date | undefined,
    public hasta: Date | undefined,
    public idguia: number | undefined,
    public idcircuito: number | undefined,
  ) {}

  // Los filtros llegan por query string: siempre texto y todos opcionales
  public static create(query: { [key: string]: any }): [string | undefined, ConsultarSalidasDto?] {
    const { idpaquete, estado, desde, hasta, idguia, idcircuito } = query;

    const [errPaquete, paquete] = aEntero(idpaquete, "idpaquete");
    if (errPaquete) return [errPaquete];

    const [errGuia, guia] = aEntero(idguia, "idguia");
    if (errGuia) return [errGuia];

    const [errCircuito, circuito] = aEntero(idcircuito, "idcircuito");
    if (errCircuito) return [errCircuito];

    if (estado !== undefined && typeof estado !== "string") return ["estado debe ser un texto"];

    const [errDesde, fechaDesde] = aFecha(desde, "desde");
    if (errDesde) return [errDesde];

    const [errHasta, fechaHasta] = aFecha(hasta, "hasta");
    if (errHasta) return [errHasta];

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return ["desde no puede ser posterior a hasta"];

    return [undefined, new ConsultarSalidasDto(paquete, estado, fechaDesde, fechaHasta, guia, circuito)];
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

// CU-36: llega por body (números) en POST y por query (texto) en GET /opciones
export class CrearSalidaDto {
  private constructor(
    public idpaquete: number,
    public fechaInicio: Date,
    public tamanoMaximo: number,
    public idalojamiento: number | undefined,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearSalidaDto?] {
    const idpaquete = entero(obj.idpaquete);
    if (!idpaquete) return ["idpaquete es requerido y debe ser un entero positivo"];

    const tamanoMaximo = entero(obj.tamanoMaximo);
    if (!tamanoMaximo) return ["tamanoMaximo es requerido y debe ser un entero positivo"];

    // Solo cuenta el día calendario (el cupo de la autoridad es por día UTC): se descarta la hora y la zona
    const fechaInicio =
      typeof obj.fechaInicio === "string" && /^\d{4}-\d{2}-\d{2}/.test(obj.fechaInicio)
        ? new Date(obj.fechaInicio.slice(0, 10))
        : new Date(NaN);
    if (isNaN(fechaInicio.getTime())) {
      return ["fechaInicio es requerida y debe ser una fecha válida (AAAA-MM-DD)"];
    }

    const idalojamiento = obj.idalojamiento == null ? undefined : entero(obj.idalojamiento);
    if (idalojamiento === null) return ["idalojamiento debe ser un entero positivo"];

    return [undefined, new CrearSalidaDto(idpaquete, fechaInicio, tamanoMaximo, idalojamiento)];
  }
}

// Acepta 5 o "5"; devuelve null si no es un entero positivo
const entero = (valor: unknown): number | null => {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
};
