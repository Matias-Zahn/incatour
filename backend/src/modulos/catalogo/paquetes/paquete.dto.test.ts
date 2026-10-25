import { describe, it, expect } from "vitest";
import { CrearPaqueteDto, FiltrosPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";

const precios = [{ idtemporada: 1, monto: 800, moneda: "USD" }];
const base = {
  idcircuito: 1,
  nombrePaquete: "Inca Clásico",
  tipoGarantia: "POR_CATEGORIA",
  localidadGarantizada: "Cusco",
  categoriaGarantizada: "3 estrellas",
  tipoHabitacionGarantizada: "Doble",
  matrizPrecios: precios,
};
const error = (cambio: Record<string, unknown>) => CrearPaqueteDto.create({ ...base, ...cambio })[0];

describe("CrearPaqueteDto", () => {
  it("acepta un paquete por categoría y completa los opcionales", () => {
    const [err, dto] = CrearPaqueteDto.create(base);

    expect(err).toBeUndefined();
    expect(dto).toMatchObject({ nochesPrevias: 0, nochesPosteriores: 0, serviciosIncluidos: [] });
  });

  it("acepta un paquete por establecimiento con idservicioGarantizado", () => {
    expect(error({ tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: 40 })).toBeUndefined();
  });

  it.each([
    [{ idcircuito: "1" }, "idcircuito es requerido y debe ser un número entero mayor a 0."],
    [{ idcircuito: 1.5 }, "idcircuito es requerido y debe ser un número entero mayor a 0."],
    [{ nombrePaquete: "" }, "nombrePaquete es requerido."],
    [{ tipoGarantia: undefined }, "tipoGarantia es requerido ('POR_ESTABLECIMIENTO' o 'POR_CATEGORIA')."],
    [{ tipoGarantia: "OTRA" }, "tipoGarantia debe ser uno de: POR_ESTABLECIMIENTO, POR_CATEGORIA."],
    [{ tipoGarantia: "POR_ESTABLECIMIENTO" }, "Con garantía por establecimiento, idservicioGarantizado es obligatorio y debe ser un número entero mayor a 0."],
    [{ tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: 2.5 }, "Con garantía por establecimiento, idservicioGarantizado es obligatorio y debe ser un número entero mayor a 0."],
    [{ localidadGarantizada: undefined }, "Con garantía por categoría, localidadGarantizada es obligatoria."],
    [{ categoriaGarantizada: undefined }, "Con garantía por categoría, categoriaGarantizada es obligatoria."],
    [{ tipoHabitacionGarantizada: undefined }, "Con garantía por categoría, tipoHabitacionGarantizada es obligatoria."],
    [{ tipoGarantia: "POR_CATEGORIA", idservicioGarantizado: 40 }, "Con garantía por categoría, no debe indicarse idservicioGarantizado."],
    [{ nochesPrevias: -1 }, "nochesPrevias debe ser un número entero mayor o igual a 0."],
    [{ nochesPrevias: 1.5 }, "nochesPrevias debe ser un número entero mayor o igual a 0."],
    [{ nochesPosteriores: "2" }, "nochesPosteriores debe ser un número entero mayor o igual a 0."],
    [{ nochesPosteriores: 2.5 }, "nochesPosteriores debe ser un número entero mayor o igual a 0."],
    [{ diasMinimosReintegro: -1 }, "diasMinimosReintegro debe ser un número entero mayor o igual a 0."],
    [{ diasMinimosReintegro: 2.5 }, "diasMinimosReintegro debe ser un número entero mayor o igual a 0."],
    [{ serviciosIncluidos: "40" }, "serviciosIncluidos debe ser un arreglo de IDs de servicios."],
    [{ serviciosIncluidos: [40, "x"] }, "serviciosIncluidos[1]: debe ser un número entero mayor a 0 (ID de servicio)."],
    [{ serviciosIncluidos: [40, 2.5] }, "serviciosIncluidos[1]: debe ser un número entero mayor a 0 (ID de servicio)."],
  ])("rechaza %o", (cambio, mensaje) => {
    expect(error(cambio)).toBe(mensaje);
  });

  describe("matriz de precios (RN: no hay paquetes sin precio)", () => {
    it.each([
      [undefined, "La matriz de precios es obligatoria y debe contener al menos una tarifa."],
      [[], "La matriz de precios es obligatoria y debe contener al menos una tarifa."],
      [[{ monto: 1, moneda: "USD" }], "matrizPrecios[0]: idtemporada debe ser un número entero mayor a 0."],
      [[{ idtemporada: 1.5, monto: 1, moneda: "USD" }], "matrizPrecios[0]: idtemporada debe ser un número entero mayor a 0."],
      [[{ idtemporada: 1, monto: 0, moneda: "USD" }], "matrizPrecios[0]: monto debe ser un número mayor a 0."],
      [[{ idtemporada: 1, monto: 10 }], "matrizPrecios[0]: moneda es requerida."],
      [[...precios, { idtemporada: 1, monto: 900, moneda: "USD" }], "matrizPrecios[1]: la temporada 1 está duplicada."],
    ])("rechaza %o", (matrizPrecios, mensaje) => {
      expect(error({ matrizPrecios })).toBe(mensaje);
    });
  });
});

describe("ModificarPaqueteDto", () => {
  it("exige al menos un campo", () => {
    expect(ModificarPaqueteDto.create({})[0]).toBe("Debe enviar al menos un campo para modificar.");
  });

  it("acepta cambiar solo la matriz de precios", () => {
    const [err, dto] = ModificarPaqueteDto.create({ matrizPrecios: precios });

    expect(err).toBeUndefined();
    expect(dto?.matrizPrecios).toEqual(precios);
  });

  it("acepta modificar circuito, garantía y servicios incluidos (CAT-14)", () => {
    const [err, dto] = ModificarPaqueteDto.create({
      idcircuito: 2,
      tipoGarantia: "POR_ESTABLECIMIENTO",
      idservicioGarantizado: 15,
      serviciosIncluidos: [7, 8],
    });

    expect(err).toBeUndefined();
    expect(dto).toMatchObject({
      idcircuito: 2,
      tipoGarantia: "POR_ESTABLECIMIENTO",
      idservicioGarantizado: 15,
      serviciosIncluidos: [7, 8],
    });
  });

  it("si se envía la matriz, no puede venir vacía ni con temporadas repetidas", () => {
    expect(ModificarPaqueteDto.create({ matrizPrecios: [] })[0]).toBe("Si se envía matrizPrecios, debe contener al menos una tarifa.");
    expect(ModificarPaqueteDto.create({ matrizPrecios: [...precios, ...precios] })[0]).toBe(
      "matrizPrecios[1]: la temporada 1 está duplicada."
    );
  });

  it("valida las noches enteras (CAT-11)", () => {
    expect(ModificarPaqueteDto.create({ nochesPrevias: -2 })[0]).toBe("nochesPrevias debe ser un número entero mayor o igual a 0.");
    expect(ModificarPaqueteDto.create({ nochesPrevias: 1.5 })[0]).toBe("nochesPrevias debe ser un número entero mayor o igual a 0.");
    // CAT-11: null explícito no es "sin cambio" (terminaba en 500 de Prisma)
    expect(ModificarPaqueteDto.create({ nochesPrevias: null })[0]).toBe("nochesPrevias debe ser un número entero mayor o igual a 0.");
    expect(ModificarPaqueteDto.create({ nombrePaquete: "X", nochesPosteriores: null })[0]).toBe("nochesPosteriores debe ser un número entero mayor o igual a 0.");
    expect(ModificarPaqueteDto.create({ nochesPosteriores: 2.5 })[0]).toBe("nochesPosteriores debe ser un número entero mayor o igual a 0.");
  });
});

describe("diasMinimosReintegro (RES-06)", () => {
  it("es opcional al crear y se puede quitar con null al modificar", () => {
    expect(CrearPaqueteDto.create(base)[1]!.diasMinimosReintegro).toBeNull();
    expect(CrearPaqueteDto.create({ ...base, diasMinimosReintegro: 15 })[1]!.diasMinimosReintegro).toBe(15);
    const [err, dto] = ModificarPaqueteDto.create({ diasMinimosReintegro: null });
    expect(err).toBeUndefined();
    expect(dto!.diasMinimosReintegro).toBeNull();
  });
});

describe("FiltrosPaqueteDto (CAT-13)", () => {
  it("acepta filtros válidos y vacíos", () => {
    expect(FiltrosPaqueteDto.create({})[0]).toBeUndefined();
    expect(FiltrosPaqueteDto.create({ idcircuito: "2", estado: "TODOS" })[1]).toMatchObject({ idcircuito: 2, estado: "TODOS" });
  });

  it.each(["abc", "0", "1e3"])("idcircuito=%s es inválido", (v) => {
    expect(FiltrosPaqueteDto.create({ idcircuito: v })[0]).toBe("idcircuito debe ser un número entero mayor a 0.");
  });
});
