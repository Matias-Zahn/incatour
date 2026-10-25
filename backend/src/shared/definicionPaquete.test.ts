import { describe, expect, it } from "vitest";
import { armarDefinicionPaquete, definicionEfectiva } from "./definicionPaquete";

const paquete = {
  condiciones: "Sin reembolso a menos de 30 días",
  tipoGarantia: "POR_ESTABLECIMIENTO",
  localidadGarantizada: null,
  categoriaGarantizada: null,
  tipoHabitacionGarantizada: null,
  nochesPrevias: 1,
  nochesPosteriores: 2,
  diasDisponibles: "L-M-X",
  diasMinimosReintegro: 15,
  garantiasEstablecimiento: [
    { servicio: { idservicio: 40, nombreServicio: "Hotel Sol", localidad: "Cusco", alojamiento: { categoria: "4 estrellas" } } },
  ],
  servicios: [
    { servicio: { idservicio: 40, nombreServicio: "Hotel Sol", transporte: null } },
    { servicio: { idservicio: 41, nombreServicio: "Bus", transporte: { pesoEquipajeIncluido: 15, costoPorKgExcedente: 10 } } },
  ],
};

describe("armarDefinicionPaquete (CAT-05)", () => {
  it("copia condiciones, garantía, servicios con equipaje, noches, días y plazo de reintegro", () => {
    expect(armarDefinicionPaquete(paquete)).toEqual({
      condiciones: "Sin reembolso a menos de 30 días",
      tipoGarantia: "POR_ESTABLECIMIENTO",
      localidadGarantizada: null,
      categoriaGarantizada: null,
      tipoHabitacionGarantizada: null,
      establecimiento: { idservicio: 40, nombreServicio: "Hotel Sol", localidad: "Cusco", categoria: "4 estrellas" },
      servicios: [
        { idservicio: 40, nombreServicio: "Hotel Sol", transporte: null },
        { idservicio: 41, nombreServicio: "Bus", transporte: { pesoEquipajeIncluido: 15, costoPorKgExcedente: 10 } },
      ],
      nochesPrevias: 1,
      nochesPosteriores: 2,
      diasDisponibles: "L-M-X",
      diasMinimosReintegro: 15,
    });
  });

  it("sin garantía por establecimiento ni servicios: establecimiento null y servicios vacíos", () => {
    const { garantiasEstablecimiento: _g, servicios: _s, ...simple } = paquete;
    expect(armarDefinicionPaquete(simple)).toMatchObject({ establecimiento: null, servicios: [] });
  });
});

describe("definicionEfectiva", () => {
  it("usa la foto de la salida aunque el paquete haya cambiado", () => {
    const foto = armarDefinicionPaquete(paquete);
    const r = definicionEfectiva({ definicionPaquete: foto, paquete: { ...paquete, condiciones: "Nuevas condiciones", diasMinimosReintegro: 3 } });
    expect(r.condiciones).toBe("Sin reembolso a menos de 30 días");
    expect(r.diasMinimosReintegro).toBe(15);
  });

  it("salida sin foto (anterior a CAT-05): rige el paquete vivo", () => {
    expect(definicionEfectiva({ definicionPaquete: null, paquete: { ...paquete, condiciones: "Vivas" } }).condiciones).toBe("Vivas");
  });
});
