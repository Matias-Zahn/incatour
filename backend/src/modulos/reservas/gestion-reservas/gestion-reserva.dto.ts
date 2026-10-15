import { ESTADO_RESERVA } from "../../../shared/constantes";

const ESTADOS = Object.values(ESTADO_RESERVA) as string[];

const fechaOpcional = (valor: any, nombre: string): [string | undefined, (Date | undefined)?] => {
  if (valor === undefined) return [undefined, undefined];
  const f = new Date(valor);
  if (isNaN(f.getTime())) return [`${nombre} no es una fecha válida (usá YYYY-MM-DD).`];
  return [undefined, f];
};

const textoOpcional = (valor: any): string | undefined =>
  typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : undefined;

// CU-31 (cliente): filtro de "mis reservas"
export class FiltrosMisReservasDto {
  private constructor(public estado?: string) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosMisReservasDto?] {
    if (query.estado !== undefined && !ESTADOS.includes(query.estado)) {
      return [`estado debe ser uno de: ${ESTADOS.join(", ")}.`];
    }
    return [undefined, new FiltrosMisReservasDto(query.estado)];
  }
}

// CU-31 (administrador): filtros por titular, pasajero, paquete, fecha y estado
export class FiltrosReservaDto {
  private constructor(
    public titular?: string,
    public pasajero?: string,
    public idpaquete?: number,
    public fechaDesde?: Date,
    public fechaHasta?: Date,
    public estado?: string,
    public limite: number = 50
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosReservaDto?] {
    if (query.estado !== undefined && !ESTADOS.includes(query.estado)) {
      return [`estado debe ser uno de: ${ESTADOS.join(", ")}.`];
    }

    let idpaquete: number | undefined;
    if (query.idpaquete !== undefined) {
      idpaquete = parseInt(query.idpaquete);
      if (isNaN(idpaquete)) return ["idpaquete debe ser un número entero."];
    }

    const [e1, fechaDesde] = fechaOpcional(query.fechaDesde, "fechaDesde");
    if (e1) return [e1];
    const [e2, fechaHasta] = fechaOpcional(query.fechaHasta, "fechaHasta");
    if (e2) return [e2];
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return ["fechaDesde no puede ser posterior a fechaHasta."];

    let limite = 50;
    if (query.limite !== undefined) {
      limite = parseInt(query.limite);
      if (isNaN(limite) || limite < 1 || limite > 200) return ["limite debe estar entre 1 y 200."];
    }

    return [
      undefined,
      new FiltrosReservaDto(
        textoOpcional(query.titular), textoOpcional(query.pasajero), idpaquete, fechaDesde, fechaHasta, query.estado, limite
      ),
    ];
  }
}

// CU-32: el motivo es opcional
export class CancelarReservaDto {
  private constructor(public motivo: string | null) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CancelarReservaDto?] {
    const { motivo } = obj ?? {};
    if (motivo === undefined || motivo === null || motivo === "") return [undefined, new CancelarReservaDto(null)];
    if (typeof motivo !== "string" || motivo.trim().length > 300) {
      return ["motivo debe ser un texto de hasta 300 caracteres."];
    }
    return [undefined, new CancelarReservaDto(motivo.trim())];
  }
}