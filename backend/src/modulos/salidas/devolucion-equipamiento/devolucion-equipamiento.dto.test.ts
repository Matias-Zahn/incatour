import { describe, it, expect } from "vitest";
import { DevolucionEquipamientoDto } from "./devolucion-equipamiento.dto";

describe("CU-41: DevolucionEquipamientoDto", () => {
  it("valida items de devolución correctamente", () => {
    const [error, dto] = DevolucionEquipamientoDto.create({
      items: [
        { idservicio: 10, cantidadBuenEstado: 5, cantidadDaniada: 1, observaciones: "1 varilla doblada" },
        { idservicio: 12, cantidadBuenEstado: 8, cantidadDaniada: 0 },
      ],
      observacionesGenerales: "Revisado por depósito central",
    });

    expect(error).toBeUndefined();
    expect(dto?.items.length).toBe(2);
    expect(dto?.items[0]?.cantidadBuenEstado).toBe(5);
    expect(dto?.items[0]?.cantidadDaniada).toBe(1);
    expect(dto?.items[0]?.observaciones).toBe("1 varilla doblada");
    expect(dto?.observacionesGenerales).toBe("Revisado por depósito central");
  });

  it("rechaza si la lista de items está vacía", () => {
    const [err] = DevolucionEquipamientoDto.create({ items: [] });
    expect(err).toBe("Debe enviar una lista de items a devolver (items).");
  });

  it("rechaza items duplicados para el mismo servicio", () => {
    const [err] = DevolucionEquipamientoDto.create({
      items: [
        { idservicio: 5, cantidadBuenEstado: 2, cantidadDaniada: 0 },
        { idservicio: 5, cantidadBuenEstado: 1, cantidadDaniada: 0 },
      ],
    });
    expect(err).toMatch("está duplicado en la lista de devolución");
  });

  it("rechaza si un item no devuelve ninguna unidad (0 y 0)", () => {
    const [err] = DevolucionEquipamientoDto.create({
      items: [{ idservicio: 7, cantidadBuenEstado: 0, cantidadDaniada: 0 }],
    });
    expect(err).toMatch("debe devolver al menos una unidad");
  });

  it.each([
    [{ idservicio: "7", cantidadBuenEstado: 1 }, "idservicio debe ser un número entero mayor a 0."],
    [{ idservicio: 7, cantidadBuenEstado: 2.9 }, "cantidadBuenEstado para el servicio #7 debe ser un entero mayor o igual a 0."],
    [{ idservicio: 7, cantidadBuenEstado: "3abc" }, "cantidadBuenEstado para el servicio #7 debe ser un entero mayor o igual a 0."],
  ])("SAL-19: rechaza valores que no son enteros (%o)", (item, mensaje) => {
    expect(DevolucionEquipamientoDto.create({ items: [item] })[0]).toBe(mensaje);
  });
});
