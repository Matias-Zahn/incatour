import { enteroOpcional } from "../../../shared/filtros";
import { textoRequerido } from "../../../shared/validaciones";

export interface PrecioTemporada {
  idtemporada: number;
  monto: number;
  moneda: string;
}

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
    public serviciosIncluidos?: number[],
    public diasMinimosReintegro?: number | null,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearPaqueteDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido."];

    const {
      idcircuito, nombrePaquete, condiciones, tipoGarantia,
      idservicioGarantizado, localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada, nochesPrevias, nochesPosteriores,
      diasDisponibles, matrizPrecios, serviciosIncluidos, diasMinimosReintegro,
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

    // --- Validaciones condicionales según tipo de garantía (RF-06, CAT-08) ---
    if (tipoGarantia === "POR_ESTABLECIMIENTO") {
      if (idservicioGarantizado == null || typeof idservicioGarantizado !== "number" || !Number.isInteger(idservicioGarantizado) || idservicioGarantizado <= 0) {
        return ["Con garantía por establecimiento, idservicioGarantizado es obligatorio y debe ser un número entero mayor a 0."];
      }
    }

    if (tipoGarantia === "POR_CATEGORIA") {
      if (!localidadGarantizada || typeof localidadGarantizada !== "string") {
        return ["Con garantía por categoría, localidadGarantizada es obligatoria."];
      }
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
    if (nochesPrevias != null && (typeof nochesPrevias !== "number" || !Number.isInteger(nochesPrevias) || nochesPrevias < 0)) {
      return ["nochesPrevias debe ser un número entero mayor o igual a 0."];
    }
    if (nochesPosteriores != null && (typeof nochesPosteriores !== "number" || !Number.isInteger(nochesPosteriores) || nochesPosteriores < 0)) {
      return ["nochesPosteriores debe ser un número entero mayor o igual a 0."];
    }

    // RES-06: plazo de reintegro (opcional; sin plazo, el reintegro es siempre del 100%)
    if (diasMinimosReintegro != null && (typeof diasMinimosReintegro !== "number" || !Number.isInteger(diasMinimosReintegro) || diasMinimosReintegro < 0)) {
      return ["diasMinimosReintegro debe ser un número entero mayor o igual a 0."];
    }

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
      if (monto == null || typeof monto !== "number" || monto <= 0) {
        return [`matrizPrecios[${i}]: monto debe ser un número mayor a 0.`];
      }
      if (!p.moneda || typeof p.moneda !== "string") {
        return [`matrizPrecios[${i}]: moneda es requerida.`];
      }
      if (temporadasVistas.has(p.idtemporada)) {
        return [`matrizPrecios[${i}]: la temporada ${p.idtemporada} está duplicada.`];
      }
      temporadasVistas.add(p.idtemporada);
    }

    // --- Validación de servicios incluidos (opcional, CAT-11) ---
    if (serviciosIncluidos != null) {
      if (!Array.isArray(serviciosIncluidos)) {
        return ["serviciosIncluidos debe ser un arreglo de IDs de servicios."];
      }
      for (let i = 0; i < serviciosIncluidos.length; i++) {
        if (typeof serviciosIncluidos[i] !== "number" || !Number.isInteger(serviciosIncluidos[i]) || serviciosIncluidos[i] <= 0) {
          return [`serviciosIncluidos[${i}]: debe ser un número entero mayor a 0 (ID de servicio).`];
        }
      }
    }

    return [undefined, new CrearPaqueteDto(
      idcircuito, nombrePaquete, tipoGarantia,
      matrizPrecios as PrecioTemporada[],
      condiciones,
      tipoGarantia === "POR_ESTABLECIMIENTO" ? idservicioGarantizado : undefined,
      localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada,
      nochesPrevias ?? 0, nochesPosteriores ?? 0,
      diasDisponibles,
      serviciosIncluidos ?? [],
      diasMinimosReintegro ?? null,
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
    public serviciosIncluidos?: number[],
    public diasMinimosReintegro?: number | null,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarPaqueteDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido."];

    let {
      nombrePaquete, condiciones, nochesPrevias, nochesPosteriores,
      diasDisponibles, matrizPrecios, idcircuito, tipoGarantia,
      idservicioGarantizado, localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada, serviciosIncluidos, diasMinimosReintegro,
    } = obj;

    if (
      !nombrePaquete && condiciones === undefined && nochesPrevias === undefined &&
      nochesPosteriores === undefined && diasDisponibles === undefined && matrizPrecios === undefined &&
      idcircuito == null && tipoGarantia === undefined && idservicioGarantizado === undefined &&
      localidadGarantizada === undefined && categoriaGarantizada === undefined &&
      tipoHabitacionGarantizada === undefined && serviciosIncluidos === undefined &&
      diasMinimosReintegro === undefined
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

    if (nochesPrevias !== undefined && (typeof nochesPrevias !== "number" || !Number.isInteger(nochesPrevias) || nochesPrevias < 0)) {
      return ["nochesPrevias debe ser un número entero mayor o igual a 0."];
    }
    if (nochesPosteriores !== undefined && (typeof nochesPosteriores !== "number" || !Number.isInteger(nochesPosteriores) || nochesPosteriores < 0)) {
      return ["nochesPosteriores debe ser un número entero mayor o igual a 0."];
    }

    // RES-06: null quita el plazo (reintegro siempre del 100%)
    if (diasMinimosReintegro != null && (typeof diasMinimosReintegro !== "number" || !Number.isInteger(diasMinimosReintegro) || diasMinimosReintegro < 0)) {
      return ["diasMinimosReintegro debe ser un número entero mayor o igual a 0."];
    }

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
        if (monto == null || typeof monto !== "number" || monto <= 0) {
          return [`matrizPrecios[${i}]: monto debe ser mayor a 0.`];
        }
        if (!p.moneda || typeof p.moneda !== "string") {
          return [`matrizPrecios[${i}]: moneda es requerida.`];
        }
        if (temporadasVistas.has(p.idtemporada)) {
          return [`matrizPrecios[${i}]: la temporada ${p.idtemporada} está duplicada.`];
        }
        temporadasVistas.add(p.idtemporada);
      }
    }

    if (serviciosIncluidos !== undefined) {
      if (!Array.isArray(serviciosIncluidos)) {
        return ["serviciosIncluidos debe ser un arreglo de IDs de servicios."];
      }
      for (let i = 0; i < serviciosIncluidos.length; i++) {
        if (typeof serviciosIncluidos[i] !== "number" || !Number.isInteger(serviciosIncluidos[i]) || serviciosIncluidos[i] <= 0) {
          return [`serviciosIncluidos[${i}]: debe ser un número entero mayor a 0 (ID de servicio).`];
        }
      }
    }

    return [undefined, new ModificarPaqueteDto(
      nombrePaquete, condiciones, nochesPrevias, nochesPosteriores, diasDisponibles,
      matrizPrecios as PrecioTemporada[] | undefined,
      idcircuito, tipoGarantia, idservicioGarantizado,
      localidadGarantizada, categoriaGarantizada, tipoHabitacionGarantizada,
      serviciosIncluidos, diasMinimosReintegro,
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
