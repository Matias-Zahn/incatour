import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { ESTADO, redondear2 } from "../../../shared/constantes";

export type TipoGarantiaCosto = "POR_ESTABLECIMIENTO" | "POR_CATEGORIA";

export type ItemEquipoCostoInput = {
  idservicio: number;
  cantidad: number;
  cadaPasajeros: number | null; // null = fija por salida
};

export interface SimularCostoBody {
  tipoGarantia: TipoGarantiaCosto;
  idservicioGarantizado?: number | undefined;
  localidadGarantizada: string;
  categoriaGarantizada?: string | undefined;
  tipoHabitacionGarantizada?: string | undefined;
  nochesPrevias: number;
  nochesPosteriores: number;
  idtransporte?: number | undefined;
  idtren?: number | undefined;
  equipo?: ItemEquipoCostoInput[] | undefined;
  pasajeros: number;
}

export type ItemDesgloseCosto = {
  tipo: "ALOJAMIENTO" | "TRANSPORTE" | "TREN" | "EQUIPAMIENTO";
  idservicio: number | null;
  nombreServicio: string;
  costoBase: number;
  calculo: string;
  porPasajero: number;
};

export type ResultadoCostoPaquete = {
  costoPorPasajero: number;
  moneda: "USD";
  desglose: ItemDesgloseCosto[];
  avisos: string[];
};

export type ServicioCosto = {
  idservicio: number;
  nombreServicio: string;
  costoBase: number;
};

export type EntradaCostoPura = {
  nochesPrevias: number;
  nochesPosteriores: number;
  pasajeros: number;
  hotel: ServicioCosto | null;
  avisoHotel?: string | null;
  transporte?: ServicioCosto | null;
  tren?: ServicioCosto | null;
  equipo?: {
    servicio: ServicioCosto;
    cantidad: number;
    cadaPasajeros: number | null;
  }[];
};

const esEnteroEnRango = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

const formatearNumero = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(redondear2(n));

/**
 * Función pura (B5): calcula el costo estimado por pasajero de un paquete y su desglose.
 * - Hotel: costoBase × (nochesPrevias + nochesPosteriores)
 * - Transporte: costoBase ÷ pasajeros
 * - Tren: costoBase
 * - Equipo: costoBase × cantidad ÷ cadaPasajeros (fijo por salida: ÷ pasajeros, como el transporte)
 */
export function costoPorPasajero(entrada: EntradaCostoPura): ResultadoCostoPaquete {
  const desglose: ItemDesgloseCosto[] = [];
  const avisos: string[] = [];

  const noches = entrada.nochesPrevias + entrada.nochesPosteriores;
  if (noches > 0) {
    if (entrada.hotel) {
      const porPasajero = redondear2(entrada.hotel.costoBase * noches);
      desglose.push({
        tipo: "ALOJAMIENTO",
        idservicio: entrada.hotel.idservicio,
        nombreServicio: entrada.hotel.nombreServicio,
        costoBase: entrada.hotel.costoBase,
        calculo: `${formatearNumero(entrada.hotel.costoBase)} × ${noches} ${noches === 1 ? "noche" : "noches"}`,
        porPasajero,
      });
    } else if (entrada.avisoHotel) {
      avisos.push(entrada.avisoHotel);
    }
  }

  if (entrada.transporte) {
    const porPasajero = redondear2(entrada.transporte.costoBase / entrada.pasajeros);
    desglose.push({
      tipo: "TRANSPORTE",
      idservicio: entrada.transporte.idservicio,
      nombreServicio: entrada.transporte.nombreServicio,
      costoBase: entrada.transporte.costoBase,
      calculo: `${formatearNumero(entrada.transporte.costoBase)} ÷ ${entrada.pasajeros} ${entrada.pasajeros === 1 ? "pasajero" : "pasajeros"}`,
      porPasajero,
    });
  }

  if (entrada.tren) {
    const porPasajero = redondear2(entrada.tren.costoBase);
    desglose.push({
      tipo: "TREN",
      idservicio: entrada.tren.idservicio,
      nombreServicio: entrada.tren.nombreServicio,
      costoBase: entrada.tren.costoBase,
      calculo: `${formatearNumero(entrada.tren.costoBase)} por pasajero`,
      porPasajero,
    });
  }

  for (const item of entrada.equipo ?? []) {
    const divisor = item.cadaPasajeros ?? entrada.pasajeros;
    const porPasajero = redondear2((item.servicio.costoBase * item.cantidad) / divisor);
    desglose.push({
      tipo: "EQUIPAMIENTO",
      idservicio: item.servicio.idservicio,
      nombreServicio: item.servicio.nombreServicio,
      costoBase: item.servicio.costoBase,
      calculo: item.cadaPasajeros
        ? `${formatearNumero(item.servicio.costoBase)} × ${item.cantidad} ÷ ${item.cadaPasajeros}`
        : `${formatearNumero(item.servicio.costoBase)} × ${item.cantidad} por salida ÷ ${entrada.pasajeros} ${entrada.pasajeros === 1 ? "pasajero" : "pasajeros"}`,
      porPasajero,
    });
  }

  const total = redondear2(desglose.reduce((acum, item) => acum + item.porPasajero, 0));

  return {
    costoPorPasajero: total,
    moneda: "USD",
    desglose,
    avisos,
  };
}

export class SimularCostoDto {
  private constructor(public datos: SimularCostoBody) {}

  static create(obj: Record<string, unknown>): [string | undefined, SimularCostoDto?] {
    const {
      tipoGarantia,
      idservicioGarantizado,
      localidadGarantizada,
      categoriaGarantizada,
      tipoHabitacionGarantizada,
      nochesPrevias,
      nochesPosteriores,
      idtransporte,
      idtren,
      equipo,
      pasajeros,
    } = obj ?? {};

    if (!esEnteroEnRango(pasajeros, 1, 100)) {
      return ["pasajeros es requerido y debe ser un número entero entre 1 y 100."];
    }
    if (!esEnteroEnRango(nochesPrevias, 0, 30)) {
      return ["nochesPrevias debe ser un número entero entre 0 y 30."];
    }
    if (!esEnteroEnRango(nochesPosteriores, 0, 30)) {
      return ["nochesPosteriores debe ser un número entero entre 0 y 30."];
    }
    if (tipoGarantia !== "POR_ESTABLECIMIENTO" && tipoGarantia !== "POR_CATEGORIA") {
      return ["tipoGarantia debe ser POR_ESTABLECIMIENTO o POR_CATEGORIA."];
    }
    if (typeof localidadGarantizada !== "string" || !localidadGarantizada.trim()) {
      return ["localidadGarantizada es obligatoria."];
    }
    if (idservicioGarantizado !== undefined && idservicioGarantizado !== null) {
      if (!esEnteroEnRango(idservicioGarantizado, 1, Number.MAX_SAFE_INTEGER)) {
        return ["idservicioGarantizado debe ser un número entero mayor a 0."];
      }
    }
    if (idtransporte !== undefined && idtransporte !== null) {
      if (!esEnteroEnRango(idtransporte, 1, Number.MAX_SAFE_INTEGER)) {
        return ["idtransporte debe ser un número entero mayor a 0."];
      }
    }
    if (idtren !== undefined && idtren !== null) {
      if (!esEnteroEnRango(idtren, 1, Number.MAX_SAFE_INTEGER)) {
        return ["idtren debe ser un número entero mayor a 0."];
      }
    }

    const equipoLimpio: ItemEquipoCostoInput[] = [];
    if (equipo !== undefined) {
      if (!Array.isArray(equipo)) {
        return ["equipo debe ser un arreglo."];
      }
      const vistos = new Set<number>();
      for (let i = 0; i < equipo.length; i++) {
        const it = equipo[i] as Record<string, unknown> | null;
        if (!it || !esEnteroEnRango(it.idservicio, 1, Number.MAX_SAFE_INTEGER)) {
          return [`equipo[${i}]: idservicio debe ser un entero mayor a 0.`];
        }
        if (!esEnteroEnRango(it.cantidad, 1, 100) || (it.cadaPasajeros != null && !esEnteroEnRango(it.cadaPasajeros, 1, 100))) {
          return [`equipo[${i}]: cantidad y cadaPasajeros deben ser enteros entre 1 y 100.`];
        }
        if (vistos.has(it.idservicio)) {
          return [`equipo repite el servicio ${it.idservicio}.`];
        }
        vistos.add(it.idservicio);
        equipoLimpio.push({
          idservicio: it.idservicio,
          cantidad: it.cantidad,
          cadaPasajeros: typeof it.cadaPasajeros === "number" ? it.cadaPasajeros : null,
        });
      }
    }

    return [
      undefined,
      new SimularCostoDto({
        tipoGarantia,
        idservicioGarantizado:
          typeof idservicioGarantizado === "number" ? idservicioGarantizado : undefined,
        localidadGarantizada: localidadGarantizada.trim(),
        categoriaGarantizada:
          typeof categoriaGarantizada === "string" && categoriaGarantizada.trim()
            ? categoriaGarantizada.trim()
            : undefined,
        tipoHabitacionGarantizada:
          typeof tipoHabitacionGarantizada === "string" && tipoHabitacionGarantizada.trim()
            ? tipoHabitacionGarantizada.trim()
            : undefined,
        nochesPrevias,
        nochesPosteriores,
        idtransporte: typeof idtransporte === "number" ? idtransporte : undefined,
        idtren: typeof idtren === "number" ? idtren : undefined,
        equipo: equipoLimpio,
        pasajeros,
      }),
    ];
  }
}

async function buscarServicioActivo(idservicio: number) {
  const s = await db.servicioBase.findUnique({
    where: { idservicio },
    include: {
      proveedor: { select: { estado: true } },
      alojamiento: true,
      transporte: true,
      tren: true,
      equipamiento: true,
    },
  });
  if (!s || s.estado !== ESTADO.ACTIVO || s.proveedor.estado !== ESTADO.ACTIVO) {
    throw CustomError.badRequest(`El servicio con ID ${idservicio} no existe o no está activo.`);
  }
  return s;
}

/**
 * Resuelve los servicios en la base y calcula el costo por pasajero (POST /api/paquetes/costos/simular).
 */
export async function simularCostoPaquete(dto: SimularCostoBody): Promise<ResultadoCostoPaquete> {
  const noches = dto.nochesPrevias + dto.nochesPosteriores;

  let hotel: ServicioCosto | null = null;
  let avisoHotel: string | null = null;

  if (noches > 0) {
    if (dto.tipoGarantia === "POR_ESTABLECIMIENTO") {
      if (dto.idservicioGarantizado) {
        const s = await buscarServicioActivo(dto.idservicioGarantizado);
        if (!s.alojamiento) {
          throw CustomError.badRequest(`El servicio con ID ${dto.idservicioGarantizado} no es un alojamiento.`);
        }
        hotel = { idservicio: s.idservicio, nombreServicio: s.nombreServicio, costoBase: s.costoBase };
      } else {
        avisoHotel = "Elegí un hotel garantizado para incluir el alojamiento en el costo.";
      }
    } else {
      const localidad = dto.localidadGarantizada;
      const categoria = dto.categoriaGarantizada;
      const tipoHabitacion = dto.tipoHabitacionGarantizada;

      if (categoria && tipoHabitacion) {
        const candidatos = await db.servicioBase.findMany({
          where: {
            estado: ESTADO.ACTIVO,
            proveedor: { estado: ESTADO.ACTIVO },
            localidad: { equals: localidad, mode: "insensitive" },
            alojamiento: {
              is: {
                categoria: { equals: categoria, mode: "insensitive" },
                tipoHabitacion: { equals: tipoHabitacion, mode: "insensitive" },
              },
            },
          },
          // Precio "desde": la referencia es el hotel más económico que cumple; si la salida usa uno más caro,
          // su revisión avisa la diferencia por pasajero y el admin la suma al precio antes de vender
          orderBy: { costoBase: "asc" },
          take: 1,
        });
        const referencia = candidatos[0];
        if (referencia) {
          hotel = {
            idservicio: referencia.idservicio,
            nombreServicio: `${referencia.nombreServicio} (más económico de la categoría)`,
            costoBase: referencia.costoBase,
          };
        } else {
          avisoHotel = `Ningún hotel de ${localidad} cumple ${categoria} · ${tipoHabitacion}: el costo no incluye el hotel`;
        }
      } else {
        avisoHotel = "Completá categoría y tipo de habitación para estimar el costo del hotel.";
      }
    }
  }

  let transporte: ServicioCosto | null = null;
  if (dto.idtransporte) {
    const s = await buscarServicioActivo(dto.idtransporte);
    if (!s.transporte) {
      throw CustomError.badRequest(`El servicio con ID ${dto.idtransporte} no es un transporte.`);
    }
    transporte = { idservicio: s.idservicio, nombreServicio: s.nombreServicio, costoBase: s.costoBase };
  }

  let tren: ServicioCosto | null = null;
  if (dto.idtren) {
    const s = await buscarServicioActivo(dto.idtren);
    if (!s.tren) {
      throw CustomError.badRequest(`El servicio con ID ${dto.idtren} no es un tren.`);
    }
    tren = { idservicio: s.idservicio, nombreServicio: s.nombreServicio, costoBase: s.costoBase };
  }

  const equipo: NonNullable<EntradaCostoPura["equipo"]> = [];
  for (const item of dto.equipo ?? []) {
    const s = await buscarServicioActivo(item.idservicio);
    if (!s.equipamiento) {
      throw CustomError.badRequest(`El servicio con ID ${item.idservicio} no es un equipamiento.`);
    }
    equipo.push({
      servicio: { idservicio: s.idservicio, nombreServicio: s.nombreServicio, costoBase: s.costoBase },
      cantidad: item.cantidad,
      cadaPasajeros: item.cadaPasajeros,
    });
  }

  return costoPorPasajero({
    nochesPrevias: dto.nochesPrevias,
    nochesPosteriores: dto.nochesPosteriores,
    pasajeros: dto.pasajeros,
    hotel,
    avisoHotel,
    transporte,
    tren,
    equipo,
  });
}
