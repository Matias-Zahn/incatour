import { beforeEach, describe, expect, it, vi } from "vitest";
import { CuentaGuiaService } from "./cuenta-guia.service";
import { CrearCuentaGuiaDto, ModificarCuentaGuiaDto } from "./cuenta-guia.dto";

const { repo } = vi.hoisted(() => ({
  repo: { findPersonalGuia: vi.fn(), findCuenta: vi.fn(), checkEmailExists: vi.fn(), crearCuentaGuia: vi.fn(), modificarCuenta: vi.fn(), consultarAsignacionesActivas: vi.fn().mockResolvedValue([]) },
}));
vi.mock("./cuenta-guia.repository", () => ({ CuentaGuiaRepository: class { constructor() { return repo; } } }));

const cuenta = (estado = "ACTIVO") => ({
  idpersonal: 4, usuario: { idusuario: 9, email: "g@incatour.com", estado }, personal: { asignaciones: [] },
});

describe("CuentaGuiaService (CTA-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findPersonalGuia.mockResolvedValue({ idpersonal: 4, nombreCompleto: "Ana Quispe", rol: "Guía", estado: "ACTIVO", guia: null });
    repo.checkEmailExists.mockResolvedValue(null);
  });

  it("no crea una cuenta con la habilitación vencida", async () => {
    const dto = CrearCuentaGuiaDto.create({ idpersonal: 4, email: "g@incatour.com", contrasenia: "clave1234", fechaHabilitacion: "2020-01-01" })[1]!;

    await expect(new CuentaGuiaService().crearCuentaGuia(dto)).rejects.toThrow("vencida");
    expect(repo.crearCuentaGuia).not.toHaveBeenCalled();
  });

  it("no pisa la habilitación con una vencida al modificar", async () => {
    repo.findCuenta.mockResolvedValue(cuenta());

    await expect(new CuentaGuiaService().modificarCuenta(9, ModificarCuentaGuiaDto.create({ fechaHabilitacion: "2020-01-01" })[1]!)).rejects.toThrow("vencida");
    expect(repo.modificarCuenta).not.toHaveBeenCalled();
  });

  it("no modifica una cuenta dada de baja", async () => {
    repo.findCuenta.mockResolvedValue(cuenta("INACTIVO"));

    await expect(new CuentaGuiaService().modificarCuenta(9, ModificarCuentaGuiaDto.create({ contrasenia: "otraClave123" })[1]!)).rejects.toThrow("dada de baja");
    expect(repo.modificarCuenta).not.toHaveBeenCalled();
  });
});
