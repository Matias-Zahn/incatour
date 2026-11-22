import { TOPES } from "../../../shared/constantes";
import { enteroOpcional } from "../../../shared/filtros";
import { textoRequerido } from "../../../shared/validaciones";

export interface PrecioTemporada {
  idtemporada: number;
  monto: number;
  moneda: string;
}

/** B2: un equipo del paquete con su regla: "1 carpa cada 2 pasajeros" = { cantidad: 1, cadaPasajeros: 2 }. */
export interface EquipoPaquete {
  idservicio: number;
  cantidad: number;
  cadaPasajeros: number;
}

/** B2: los servicios del paquete, uno por tipo. undefined = no viene (en el PUT, ese tipo no se toca). */
export interface ServiciosPaquete {
  idtransporte?: number | undefined;
  idtren?: number | null | undefined;
  equipo?: EquipoPaquete[] | undefined;
}

const esId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const enRango = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

// B2: idtransporte (obligatorio en el alta), idtren (null lo quita) y equipo con su regla
function validarServicios(obj: { [key: string]: any }, alta: boolean): [string | undefined, ServiciosPaquete?] {
  const { idtransporte, idtren, equipo, serviciosIncluidos } = obj;
  if (serviciosIncluidos !== undefined) return ["serviciosIncluidos ya no se usa: mandá idtransporte, idtren y equipo."];
  if ((alta || idtransporte !== undefined) && !esId(idtransporte)) {
    return ["idtransporte es requerido y debe ser un número entero mayor a 0."];
  }
  if (idtren != null && !esId(idtren)) return ["idtren debe ser un número entero mayor a 0."];
  if (equipo !== undefined) {
    if (!Array.isArray(equipo)) return ["equipo debe ser una lista de { idservicio, cantidad, cadaPasajeros }."];
    const vistos = new Set<number>();
    for (let i = 0; i < equipo.length; i++) {
      const e = equipo[i];
      if (!esId(e?.idservicio)) return [`equipo[${i}]: idservicio debe ser un número entero mayor a 0.`];
      if (!enRango(e.cantidad, 1, TOPES.reglaEquipo) || !enRango(e.cadaPasajeros, 1, TOPES.reglaEquipo)) {
        return [`equipo[${i}]: cantidad y cadaPasajeros deben ser enteros entre 1 y ${TOPES.reglaEquipo}.`];
      }
      if (vistos.has(e.idservicio)) return [`equipo repite el servicio ${e.idservicio}.`];
      vistos.add(e.idservicio);
    }
  }
  const lista = equipo?.map((e: EquipoPaquete) => ({ idservicio: e.idservicio, cantidad: e.cantidad, cadaPasajeros: e.cadaPasajeros }));
  return [undefined, { idtransporte, idtren: alta ? (idtren ?? null) : idtren, equipo: lista ?? (alta ? [] : undefined) }];
}

const errorDiasCierre = (v: unknown) =>
  v !== undefined && !enRango(v, 0, TOPES.diasCierreVenta) ? `diasCierreVenta debe ser un número entero entre 0 y ${TOPES.diasCierreVenta}.` : undefined;
const SALE_DESDE = "localidadGarantizada (Sale desde) es obligatoria.";

export class CrearPaqueteDto {
  private constructor(
    public idcircuito: number,
    public nombrePaquete: string,
    public tipoGarantia: string,
    public matrizPrecios: PrecioTemporada[],
    public condiciones?: string,
    public idservicioGarantizado?: number,
    public localidadGarantizada?: string,
    public categoriaGarantizada?: string,
    public tipoHabitacionGarantizada?: string,
    public nochesPrevias?: number,
    public nochesPosteriores?: number,
    public diasDisponibles?: string,
    public servicios: ServiciosPaquete = {},
    public diasMinimosReintegro?: number | null,
    public diasCierreVenta?: number,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearPaqueteDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido."];

    const {
      idcircuito, nombrePaquete, condiciones, tipoGarantia,
      idservicioGarantizado, localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada, nochesPrevias, nochesPosteriores,
      diasDisponibles, matrizPrecios, diasMinimosReintegro, diasCierreVenta,
    } = obj;

    // --- Validaciones obligatorias ---
    if (idcircuito == null || typeof idcircuito !== "number" || !Number.isInteger(idcircuito) || idcircuito <= 0) {
      return ["idcircuito es requerido y debe ser un número entero mayor a 0."];
    }

    if (!nombrePaquete || typeof nombrePaquete !== "string") {
      return ["nombrePaquete es requerido."];
    }

    if (!tipoGarantia || typeof tipoGarantia !== "string") {
      return ["tipoGarantia es requerido ('POR_ESTABLECIMIENTO' o 'POR_CATEGORIA')."];
    }

    const tiposValidos = ["POR_ESTABLECIMIENTO", "POR_CATEGORIA"];
    if (!tiposValidos.includes(tipoGarantia)) {
      return [`tipoGarantia debe ser uno de: ${tiposValidos.join(", ")}.`];
    }

    // B2: "Sale desde", obligatoria en los dos tipos de garantía
    if (!localidadGarantizada || typeof localidadGarantizada !== "string" || !localidadGarantizada.trim()) return [SALE_DESDE];

    // --- Validaciones condicionales según tipo de garantía (RF-06, CAT-08) ---
    if (tipoGarantia === "POR_ESTABLECIMIENTO") {
      if (idservicioGarantizado == null || typeof idservicioGarantizado !== "number" || !Number.isInteger(idservicioGarantizado) || idservicioGarantizado <= 0) {
        return ["Con garantía por establecimiento, idservicioGarantizado es obligatorio y debe ser un número entero mayor a 0."];
      }
    }

    if (tipoGarantia === "POR_CATEGORIA") {
      if (!categoriaGarantizada || typeof categoriaGarantizada !== "string") {
        return ["Con garantía por categoría, categoriaGarantizada es obligatoria."];
      }
      if (!tipoHabitacionGarantizada || typeof tipoHabitacionGarantizada !== "string") {
        return ["Con garantía por categoría, tipoHabitacionGarantizada es obligatoria."];
      }
      if (idservicioGarantizado !== undefined && idservicioGarantizado !== null) {
        return ["Con garantía por categoría, no debe indicarse idservicioGarantizado."];
      }
    }

    // --- Validación de noches (opcionales, pero si vienen deben ser >= 0 y enteros, CAT-11) ---
    if (nochesPrevias != null && (typeof nochesPrevias !== "number" || !Number.isInteger(nochesPrevias) || nochesPrevias < 0 || nochesPrevias > TOPES.noches)) {
      return [`nochesPrevias debe ser un número entero entre 0 y ${TOPES.noches}.`];
    }
    if (nochesPosteriores != null && (typeof nochesPosteriores !== "number" || !Number.isInteger(nochesPosteriores) || nochesPosteriores < 0 || nochesPosteriores > TOPES.noches)) {
      return [`nochesPosteriores debe ser un número entero entre 0 y ${TOPES.noches}.`];
    }

    // RES-06: plazo de reintegro (opcional; sin plazo, el reintegro es siempre del 100%)
    if (diasMinimosReintegro != null && (typeof diasMinimosReintegro !== "number" || !Number.isInteger(diasMinimosReintegro) || diasMinimosReintegro < 0 || diasMinimosReintegro > TOPES.diasMinimosReintegro)) {
      return [`diasMinimosReintegro debe ser un número entero entre 0 y ${TOPES.diasMinimosReintegro}.`];
    }

    const errorCierre = errorDiasCierre(diasCierreVenta);
    if (errorCierre) return [errorCierre];

    // --- Validación de matriz de precios (RN: Viabilidad Comercial, CAT-11) ---
    if (!Array.isArray(matrizPrecios) || matrizPrecios.length === 0) {
      return ["La matriz de precios es obligatoria y debe contener al menos una tarifa."];
    }

    const temporadasVistas = new Set<number>();
    for (let i = 0; i < matrizPrecios.length; i++) {
      const p = matrizPrecios[i];
      if (p.idtemporada == null || typeof p.idtemporada !== "number" || !Number.isInteger(p.idtemporada) || p.idtemporada <= 0) {
        return [`matrizPrecios[${i}]: idtemporada debe ser un número entero mayor a 0.`];
      }
      const monto = p.monto ?? p.precioPersona;
      p.monto = monto;
      if (monto == null || typeof monto !== "number" || monto <= 0 || monto > TOPES.montoTarifa) {
        return [`matrizPrecios[${i}]: monto debe ser mayor a 0 y no superar ${TOPES.montoTarifa}.`];
      }
      // RES-16: hay una sola moneda; si no viene se asume USD
      p.moneda = p.moneda ?? "USD";
      if (p.moneda !== "USD") return [`matrizPrecios[${i}]: la moneda tiene que ser USD.`];
      if (temporadasVistas.has(p.idtemporada)) {
        return [`matrizPrecios[${i}]: la temporada ${p.idtemporada} está duplicada.`];
      }
      temporadasVistas.add(p.idtemporada);
    }

    // --- B2: servicios por tipo ---
    const [errorServicios, servicios] = validarServicios(obj, true);
    if (errorServicios) return [errorServicios];

    return [undefined, new CrearPaqueteDto(
      idcircuito, nombrePaquete, tipoGarantia,
      matrizPrecios as PrecioTemporada[],
      condiciones,
      tipoGarantia === "POR_ESTABLECIMIENTO" ? idservicioGarantizado : undefined,
      localidadGarantizada.trim(), categoriaGarantizada,
      tipoHabitacionGarantizada,
      nochesPrevias ?? 0, nochesPosteriores ?? 0,
      diasDisponibles,
      servicios,
      diasMinimosReintegro ?? null,
      diasCierreVenta,
    )];
  }
}

export class ModificarPaqueteDto {
  private constructor(
    public nombrePaquete?: string,
    public condiciones?: string,
    public nochesPrevias?: number,
    public nochesPosteriores?: number,
    public diasDisponibles?: string,
    public matrizPrecios?: PrecioTemporada[],
    public idcircuito?: number,
    public tipoGarantia?: string,
    public idservicioGarantizado?: number,
    public localidadGarantizada?: string,
    public categoriaGarantizada?: string,
    public tipoHabitacionGarantizada?: string,
    public servicios: ServiciosPaquete = {},
    public diasMinimosReintegro?: number | null,
    public diasCierreVenta?: number,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarPaqueteDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido."];

    let {
      nombrePaquete, condiciones, nochesPrevias, nochesPosteriores,
      diasDisponibles, matrizPrecios, idcircuito, tipoGarantia,
      idservicioGarantizado, localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada, diasMinimosReintegro, diasCierreVenta,
    } = obj;

    if (
      !nombrePaquete && condiciones === undefined && nochesPrevias === undefined &&
      nochesPosteriores === undefined && diasDisponibles === undefined && matrizPrecios === undefined &&
      idcircuito == null && tipoGarantia === undefined && idservicioGarantizado === undefined &&
      localidadGarantizada === undefined && categoriaGarantizada === undefined &&
      tipoHabitacionGarantizada === undefined && obj.serviciosIncluidos === undefined &&
      diasMinimosReintegro === undefined && diasCierreVenta === undefined &&
      obj.idtransporte === undefined && obj.idtren === undefined && obj.equipo === undefined
    ) {
      return ["Debe enviar al menos un campo para modificar."];
    }

    // CAT-20: los textos que vienen no pueden estar vacíos ni ser de otro tipo (null borra los criterios de garantía)
    if (nombrePaquete !== undefined) {
      const [error, limpio] = textoRequerido(nombrePaquete, "nombrePaquete", 255);
      if (error) return [error];
      nombrePaquete = limpio;
    }
    if (condiciones != null && typeof condiciones !== "string") return ["condiciones debe ser un texto."];
    // CAT-20: días como los arma el front ("L-M-X"): códigos L, M, X, J, V, S o D, sin repetir; null vuelve a todos
    if (diasDisponibles != null) {
      const dias = typeof diasDisponibles === "string" ? diasDisponibles.trim().toUpperCase().split(/[-,\s]+/).filter(Boolean) : [];
      if (dias.length === 0 || dias.some((d) => !"LMXJVSD".includes(d) || d.length !== 1) || new Set(dias).size !== dias.length) {
        return ["diasDisponibles debe ser una lista de días (L, M, X, J, V, S, D), por ejemplo \"L-M-X\"."];
      }
      diasDisponibles = dias.join("-");
    }
    // B2: el "Sale desde" no se puede borrar
    if (localidadGarantizada === null || (typeof localidadGarantizada === "string" && !localidadGarantizada.trim())) return [SALE_DESDE];
    const criterios = { localidadGarantizada, categoriaGarantizada, tipoHabitacionGarantizada };
    for (const [nombre, valor] of Object.entries(criterios)) {
      if (valor == null) continue;
      const [error] = textoRequerido(valor, nombre, 255);
      if (error) return [error];
    }

    if (idcircuito != null && (typeof idcircuito !== "number" || !Number.isInteger(idcircuito) || idcircuito <= 0)) {
      return ["idcircuito debe ser un número entero mayor a 0."];
    }

    if (tipoGarantia !== undefined) {
      const tiposValidos = ["POR_ESTABLECIMIENTO", "POR_CATEGORIA"];
      if (!tiposValidos.includes(tipoGarantia)) {
        return [`tipoGarantia debe ser uno de: ${tiposValidos.join(", ")}.`];
      }
    }

    if (idservicioGarantizado != null && (typeof idservicioGarantizado !== "number" || !Number.isInteger(idservicioGarantizado) || idservicioGarantizado <= 0)) {
      return ["idservicioGarantizado debe ser un número entero mayor a 0."];
    }

    if (tipoGarantia === "POR_CATEGORIA" && idservicioGarantizado !== undefined && idservicioGarantizado !== null) {
      return ["Con garantía por categoría, no debe indicarse idservicioGarantizado."];
    }

    if (nochesPrevias !== undefined && (typeof nochesPrevias !== "number" || !Number.isInteger(nochesPrevias) || nochesPrevias < 0 || nochesPrevias > TOPES.noches)) {
      return [`nochesPrevias debe ser un número entero entre 0 y ${TOPES.noches}.`];
    }
    if (nochesPosteriores !== undefined && (typeof nochesPosteriores !== "number" || !Number.isInteger(nochesPosteriores) || nochesPosteriores < 0 || nochesPosteriores > TOPES.noches)) {
      return [`nochesPosteriores debe ser un número entero entre 0 y ${TOPES.noches}.`];
    }

    // RES-06: null quita el plazo (reintegro siempre del 100%)
    if (diasMinimosReintegro != null && (typeof diasMinimosReintegro !== "number" || !Number.isInteger(diasMinimosReintegro) || diasMinimosReintegro < 0 || diasMinimosReintegro > TOPES.diasMinimosReintegro)) {
      return [`diasMinimosReintegro debe ser un número entero entre 0 y ${TOPES.diasMinimosReintegro}.`];
    }

    const errorCierre = errorDiasCierre(diasCierreVenta);
    if (errorCierre) return [errorCierre];

    // Si mandan matrizPrecios en el PUT, validamos la estructura
    if (matrizPrecios !== undefined) {
      if (!Array.isArray(matrizPrecios) || matrizPrecios.length === 0) {
        return ["Si se envía matrizPrecios, debe contener al menos una tarifa."];
      }
      const temporadasVistas = new Set<number>();
      for (let i = 0; i < matrizPrecios.length; i++) {
        const p = matrizPrecios[i];
        if (p.idtemporada == null || typeof p.idtemporada !== "number" || !Number.isInteger(p.idtemporada) || p.idtemporada <= 0) {
          return [`matrizPrecios[${i}]: idtemporada debe ser un número entero mayor a 0.`];
        }
        const monto = p.monto ?? p.precioPersona;
        p.monto = monto;
        if (monto == null || typeof monto !== "number" || monto <= 0 || monto > TOPES.montoTarifa) {
          return [`matrizPrecios[${i}]: monto debe ser mayor a 0 y no superar ${TOPES.montoTarifa}.`];
        }
        p.moneda = p.moneda ?? "USD";
        if (p.moneda !== "USD") return [`matrizPrecios[${i}]: la moneda tiene que ser USD.`];
        if (temporadasVistas.has(p.idtemporada)) {
          return [`matrizPrecios[${i}]: la temporada ${p.idtemporada} está duplicada.`];
        }
        temporadasVistas.add(p.idtemporada);
      }
    }

    const [errorServicios, servicios] = validarServicios(obj, false);
    if (errorServicios) return [errorServicios];

    return [undefined, new ModificarPaqueteDto(
      nombrePaquete, condiciones, nochesPrevias, nochesPosteriores, diasDisponibles,
      matrizPrecios as PrecioTemporada[] | undefined,
      idcircuito, tipoGarantia, idservicioGarantizado,
      typeof localidadGarantizada === "string" ? localidadGarantizada.trim() : localidadGarantizada,
      categoriaGarantizada, tipoHabitacionGarantizada,
      servicios, diasMinimosReintegro, diasCierreVenta,
    )];
  }
}

// CU-10 / CAT-13: filtros del listado (un valor inválido es 400, no un error de Prisma)
export class FiltrosPaqueteDto {
  private constructor(
    public idcircuito?: number,
    public estado?: string,
    public nombrePaquete?: string,
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosPaqueteDto?] {
    const [error, idcircuito] = enteroOpcional(query.idcircuito, "idcircuito");
    if (error) return [error];
    return [undefined, new FiltrosPaqueteDto(idcircuito, query.estado, query.nombrePaquete)];
  }
}
