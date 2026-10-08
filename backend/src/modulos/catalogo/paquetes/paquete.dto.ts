interface PrecioTemporada {
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
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearPaqueteDto?] {
    const {
      idcircuito, nombrePaquete, condiciones, tipoGarantia,
      idservicioGarantizado, localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada, nochesPrevias, nochesPosteriores,
      diasDisponibles, matrizPrecios, serviciosIncluidos,
    } = obj;

    // --- Validaciones obligatorias ---
    if (idcircuito == null || typeof idcircuito !== "number") {
      return ["idcircuito es requerido y debe ser un número."];
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

    // --- Validaciones condicionales según tipo de garantía ---
    if (tipoGarantia === "POR_ESTABLECIMIENTO") {
      if (idservicioGarantizado == null || typeof idservicioGarantizado !== "number") {
        return ["Con garantía por establecimiento, idservicioGarantizado es obligatorio."];
      }
    }

    if (tipoGarantia === "POR_CATEGORIA") {
      if (!localidadGarantizada || typeof localidadGarantizada !== "string") {
        return ["Con garantía por categoría, localidadGarantizada es obligatoria."];
      }
      if (!categoriaGarantizada || typeof categoriaGarantizada !== "string") {
        return ["Con garantía por categoría, categoriaGarantizada es obligatoria."];
      }
    }

    // --- Validación de noches (opcionales, pero si vienen deben ser >= 0) ---
    if (nochesPrevias != null && (typeof nochesPrevias !== "number" || nochesPrevias < 0)) {
      return ["nochesPrevias debe ser un número mayor o igual a 0."];
    }
    if (nochesPosteriores != null && (typeof nochesPosteriores !== "number" || nochesPosteriores < 0)) {
      return ["nochesPosteriores debe ser un número mayor o igual a 0."];
    }

    // --- Validación de matriz de precios (RN: Viabilidad Comercial) ---
    if (!Array.isArray(matrizPrecios) || matrizPrecios.length === 0) {
      return ["La matriz de precios es obligatoria y debe contener al menos una tarifa."];
    }

    const temporadasVistas = new Set<number>();
    for (let i = 0; i < matrizPrecios.length; i++) {
      const p = matrizPrecios[i];
      if (p.idtemporada == null || typeof p.idtemporada !== "number") {
        return [`matrizPrecios[${i}]: idtemporada es requerido.`];
      }
      if (p.monto == null || typeof p.monto !== "number" || p.monto <= 0) {
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

    // --- Validación de servicios incluidos (opcional) ---
    if (serviciosIncluidos != null) {
      if (!Array.isArray(serviciosIncluidos)) {
        return ["serviciosIncluidos debe ser un arreglo de IDs de servicios."];
      }
      for (let i = 0; i < serviciosIncluidos.length; i++) {
        if (typeof serviciosIncluidos[i] !== "number") {
          return [`serviciosIncluidos[${i}]: debe ser un número (ID de servicio).`];
        }
      }
    }

    return [undefined, new CrearPaqueteDto(
      idcircuito, nombrePaquete, tipoGarantia,
      matrizPrecios as PrecioTemporada[],
      condiciones, idservicioGarantizado,
      localidadGarantizada, categoriaGarantizada,
      tipoHabitacionGarantizada,
      nochesPrevias ?? 0, nochesPosteriores ?? 0,
      diasDisponibles,
      serviciosIncluidos ?? [],
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
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarPaqueteDto?] {
    const { nombrePaquete, condiciones, nochesPrevias, nochesPosteriores, diasDisponibles, matrizPrecios } = obj;

    if (!nombrePaquete && condiciones === undefined && nochesPrevias == null &&
        nochesPosteriores == null && diasDisponibles === undefined && matrizPrecios === undefined) {
      return ["Debe enviar al menos un campo para modificar."];
    }

    if (nochesPrevias != null && (typeof nochesPrevias !== "number" || nochesPrevias < 0)) {
      return ["nochesPrevias debe ser un número mayor o igual a 0."];
    }
    if (nochesPosteriores != null && (typeof nochesPosteriores !== "number" || nochesPosteriores < 0)) {
      return ["nochesPosteriores debe ser un número mayor o igual a 0."];
    }

    // Si mandan matrizPrecios en el PUT, validamos la estructura
    if (matrizPrecios !== undefined) {
      if (!Array.isArray(matrizPrecios) || matrizPrecios.length === 0) {
        return ["Si se envía matrizPrecios, debe contener al menos una tarifa."];
      }
      const temporadasVistas = new Set<number>();
      for (let i = 0; i < matrizPrecios.length; i++) {
        const p = matrizPrecios[i];
        if (p.idtemporada == null || typeof p.idtemporada !== "number") {
          return [`matrizPrecios[${i}]: idtemporada es requerido.`];
        }
        if (p.monto == null || typeof p.monto !== "number" || p.monto <= 0) {
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

    return [undefined, new ModificarPaqueteDto(
      nombrePaquete, condiciones, nochesPrevias, nochesPosteriores, diasDisponibles,
      matrizPrecios as PrecioTemporada[] | undefined,
    )];
  }
}
