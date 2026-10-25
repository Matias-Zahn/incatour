import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersonalService } from "./personal.service";
import { CrearPersonalDto } from "./personal.dto";

const { repo } = vi.hoisted(() => ({
  repo: { buscarPorId: vi.fn(), modificar: vi.fn(), checkPasaporteExists: vi.fn(), crearPorteador: vi.fn(), crearGuia: vi.fn(), checkEmailExists: vi.fn() },
}));
vi.mock("./personal.repository", () => ({ PersonalRepository: class { constructor() { return repo; } } }));

describe("PersonalService.modificarPersonal (CU-24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.buscarPorId.mockResolvedValue({ estado: "ACTIVO", nroPasaporte: "X", guia: { idusuario: 9 } });
  });

  it("al cambiar el nombre de un guía también actualiza nombre y apellido de su usuario (CTA-04)", async () => {
    await new PersonalService().modificarPersonal(1, { nombreCompleto: "Rosa Quispe Mamani" } as any);

    expect(repo.modificar).toHaveBeenCalledWith(1, expect.anything(), {
      idusuario: 9,
      nombre: "Rosa",
      apellido: "Quispe Mamani",
    });
  });

  it("rechaza con 400 un nombre de guía sin apellido", async () => {
    await expect(new PersonalService().modificarPersonal(1, { nombreCompleto: "Rosa" } as any)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.modificar).not.toHaveBeenCalled();
  });
});

describe("PersonalService.crearPersonal: vencimiento del pasaporte (BE-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 15, 0)); // 25/10 15:00 hora local
    repo.checkPasaporteExists.mockResolvedValue(null);
    repo.crearPorteador.mockResolvedValue({ idpersonal: 1 });
  });
  afterEach(() => vi.useRealTimers());

  const porteador = (venc: string) => ({ nroPasaporte: "X1", fechaVencimientoPasaporte: new Date(venc), rolOperativo: "PORTEADOR" }) as any;

  it("acepta un pasaporte que vence hoy", async () => {
    await expect(new PersonalService().crearPersonal(porteador("2026-10-25"))).resolves.toBeDefined();
  });

  it("rechaza con 400 un pasaporte que venció ayer", async () => {
    await expect(new PersonalService().crearPersonal(porteador("2026-10-24"))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("PersonalService.crearPersonal (CTA-03: guía con cuenta opcional)", () => {
  const datos = {
    nombre: "Ana", apellido: "Quispe", nroPasaporte: "P123", nacionalidad: "Peruana",
    fechaVencimientoPasaporte: "2030-01-01", rolOperativo: "Guía", nroHabilitacion: "H-1", fechaHabilitacion: "2030-01-01",
  };
  const dtoDe = (extra: object) => CrearPersonalDto.create({ ...datos, ...extra })[1]!;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.checkPasaporteExists.mockResolvedValue(null);
    repo.checkEmailExists.mockResolvedValue(null);
  });

  it("sin email ni contraseña crea el guía sin cuenta", async () => {
    repo.crearGuia.mockResolvedValue({ personal: { idpersonal: 1 }, usuario: null });
    const r = await new PersonalService().crearPersonal(dtoDe({}));
    expect(repo.crearGuia).toHaveBeenCalledWith(expect.objectContaining({ email: undefined }), undefined);
    expect(repo.checkEmailExists).not.toHaveBeenCalled();
    expect(r.credencialesAcceso).toBeNull();
  });

  it("con email y contraseña crea la cuenta y no devuelve el hash", async () => {
    repo.crearGuia.mockResolvedValue({ personal: { idpersonal: 1 }, usuario: { idusuario: 5, email: "a@b.com", contrasenia: "hash" } });
    const r = await new PersonalService().crearPersonal(dtoDe({ email: "a@b.com", contrasenia: "clave1234" }));
    expect(repo.crearGuia).toHaveBeenCalledWith(expect.objectContaining({ email: "a@b.com" }), expect.any(String));
    expect(r.credencialesAcceso).toEqual({ idusuario: 5, email: "a@b.com" });
  });
});
