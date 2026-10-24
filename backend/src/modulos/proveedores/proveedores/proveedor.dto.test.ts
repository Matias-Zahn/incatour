import { describe, it, expect } from "vitest";
import { CrearProveedorDto, ModificarProveedorDto, FiltrosProveedorDto } from "./proveedor.dto";

describe("CU-15: CrearProveedorDto", () => {
  it("valida y crea proveedor correctamente", () => {
    const [error, dto] = CrearProveedorDto.create({
      tipoProveedor: "ALOJAMIENTO",
      razonSocial: " Hotel Andes Del Sol ",
      localidad: " Cusco ",
      datosContacto: " contacto@andes.com ",
      canalComunicacion: " Email ",
      estado: "ACTIVO",
    });

    expect(error).toBeUndefined();
    expect(dto?.tipoProveedor).toBe("ALOJAMIENTO");
    expect(dto?.razonSocial).toBe("Hotel Andes Del Sol");
    expect(dto?.localidad).toBe("Cusco");
    expect(dto?.estado).toBe("ACTIVO");
  });

  it("rechaza tipo de proveedor inválido", () => {
    const [err] = CrearProveedorDto.create({
      tipoProveedor: "AEREO",
      razonSocial: "Aerolíneas",
      localidad: "Lima",
      datosContacto: "test",
      canalComunicacion: "Tel",
    });
    expect(err).toMatch("tipoProveedor debe ser uno de");
  });

  it("BE-03: rechaza tipo 'Operador' y exige canalComunicacion en alta", () => {
    const [errTipo] = CrearProveedorDto.create({
      tipoProveedor: "Operador",
      razonSocial: "Andes Travel",
      localidad: "Cusco",
      datosContacto: "reservas@andestravel.com · +51 84 123456",
      canalComunicacion: "Correo electrónico",
    });
    expect(errTipo).toBe("tipoProveedor debe ser uno de: ALOJAMIENTO, TRANSPORTE, TREN, EQUIPAMIENTO.");

    const [errCanal] = CrearProveedorDto.create({
      tipoProveedor: "ALOJAMIENTO",
      razonSocial: "Andes Travel",
      localidad: "Cusco",
      datosContacto: "reservas@andestravel.com · +51 84 123456",
    });
    expect(errCanal).toBe("canalComunicacion es requerido.");
  });
});

describe("CU-16: ModificarProveedorDto", () => {
  it("acepta modificación de un campo y rechaza cuerpo vacío", () => {
    const [errVacio] = ModificarProveedorDto.create({});
    expect(errVacio).toBe("Debe enviar al menos un campo para modificar.");

    const [error, dto] = ModificarProveedorDto.create({ razonSocial: " Nueva Razón Social " });
    expect(error).toBeUndefined();
    expect(dto?.razonSocial).toBe("Nueva Razón Social");
  });

  it("BE-03: rechaza tipo 'Operador' en modificación", () => {
    const [err] = ModificarProveedorDto.create({
      tipoProveedor: "Operador",
    });
    expect(err).toBe("tipoProveedor debe ser uno de: ALOJAMIENTO, TRANSPORTE, TREN, EQUIPAMIENTO.");
  });
});

describe("CU-14: FiltrosProveedorDto", () => {
  it("valida filtros de listado", () => {
    const [error, dto] = FiltrosProveedorDto.create({
      tipoProveedor: "TRANSPORTE",
      localidad: " Ollantaytambo ",
      estado: "ACTIVO",
    });
    expect(error).toBeUndefined();
    expect(dto?.localidad).toBe("Ollantaytambo");
    expect(dto?.tipoProveedor).toBe("TRANSPORTE");
  });
});
