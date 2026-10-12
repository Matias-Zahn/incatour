import { TIPO_SERVICIO } from "../../../shared/constantes";

// CU-39 solo cubre equipamiento y transporte (el personal se reemplaza por el CU-38)
export const TIPOS_LOGISTICA: string[] = [TIPO_SERVICIO.EQUIPAMIENTO, TIPO_SERVICIO.TRANSPORTE];

export interface ItemDesasignar {
  tipo: string;
  idservicio: number;
}

export interface ItemNuevo {
  tipo: string;
  idservicio: number;
  cantidad?: number; // EQUIPAMIENTO
  comprobanteReserva?: string; // TRANSPORTE: comprobante de la reserva externa
}

// DCD ControladorLogistica.confirmarModificacion(salidaId, itemsDesasignar, itemsNuevos, motivo)
export class ModificarLogisticaDto {
  private constructor(
    public itemsDesasignar: ItemDesasignar[],
    public itemsNuevos: ItemNuevo[],
    public motivo: string | null
  ) {}

  public static create(obj: { [key: string]: any }): [string?, ModificarLogisticaDto?] {
    const itemsDesasignar = obj.itemsDesasignar ?? [];
    const itemsNuevos = obj.itemsNuevos ?? [];

    if (!Array.isArray(itemsDesasignar) || !Array.isArray(itemsNuevos)) {
      return ["itemsDesasignar e itemsNuevos deben ser arreglos."];
    }
    if (itemsDesasignar.length === 0 && itemsNuevos.length === 0) {
      return ["Debe indicar al menos un recurso a desasignar o a asignar."];
    }

    const claves = new Set<string>();
    for (const it of itemsDesasignar) {
      if (!TIPOS_LOGISTICA.includes(it?.tipo)) return [`tipo debe ser uno de: ${TIPOS_LOGISTICA.join(", ")}.`];
      if (!Number.isInteger(it.idservicio) || it.idservicio <= 0) return ["idservicio debe ser un número entero."];
      const clave = `${it.tipo}:${it.idservicio}`;
      if (claves.has(clave)) return [`El recurso ${clave} está repetido en itemsDesasignar.`];
      claves.add(clave);
    }

    const clavesNuevas = new Set<string>();
    let transportes = 0;
    for (const it of itemsNuevos) {
      if (!TIPOS_LOGISTICA.includes(it?.tipo)) return [`tipo debe ser uno de: ${TIPOS_LOGISTICA.join(", ")}.`];
      if (!Number.isInteger(it.idservicio) || it.idservicio <= 0) return ["idservicio debe ser un número entero."];
      const clave = `${it.tipo}:${it.idservicio}`;
      if (clavesNuevas.has(clave)) return [`El recurso ${clave} está repetido en itemsNuevos.`];
      clavesNuevas.add(clave);

      if (it.tipo === TIPO_SERVICIO.EQUIPAMIENTO) {
        if (!Number.isInteger(it.cantidad) || (it.cantidad as number) <= 0) {
          return ["La cantidad de equipamiento debe ser un entero mayor a 0."];
        }
      } else {
        transportes++;
        if (typeof it.comprobanteReserva !== "string" || it.comprobanteReserva.trim().length === 0) {
          return ["El transporte nuevo requiere el comprobante de la reserva externa (comprobanteReserva)."];
        }
        if (it.comprobanteReserva.trim().length > 100) return ["comprobanteReserva no puede superar los 100 caracteres."];
      }
    }
    if (transportes > 1) return ["Una salida admite un único servicio de transporte."];

    // El motivo es opcional (paso 12: "registra opcionalmente el motivo")
    let motivo: string | null = null;
    if (obj.motivo !== undefined && obj.motivo !== null && obj.motivo !== "") {
      if (typeof obj.motivo !== "string" || obj.motivo.trim().length > 300) return ["El motivo no puede superar los 300 caracteres."];
      motivo = obj.motivo.trim();
    }

    return [
      undefined,
      new ModificarLogisticaDto(
        itemsDesasignar.map((i: ItemDesasignar) => ({ tipo: i.tipo, idservicio: i.idservicio })),
        itemsNuevos.map((i: ItemNuevo) => ({
          tipo: i.tipo,
          idservicio: i.idservicio,
          ...(i.cantidad !== undefined && { cantidad: i.cantidad }),
          ...(i.comprobanteReserva !== undefined && { comprobanteReserva: i.comprobanteReserva.trim() }),
        })),
        motivo
      ),
    ];
  }
}

// DCD consultarProveedoresDisponibles(tipoRecurso, fechasSalida)
export class TipoRecursoDto {
  private constructor(public tipo: string) {}

  public static create(query: { [key: string]: any }): [string?, TipoRecursoDto?] {
    if (!TIPOS_LOGISTICA.includes(query.tipo)) return [`tipo es requerido y debe ser uno de: ${TIPOS_LOGISTICA.join(", ")}.`];
    return [undefined, new TipoRecursoDto(query.tipo)];
  }
}