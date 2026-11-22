import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PersonalService } from "./personal.service";
import { CrearPersonalDto, ModificarPersonalDto } from "./personal.dto";

const { repo } = vi.hoisted(() => ({
  repo: { darDeBaja: vi.fn(), buscarPorId: vi.fn(), modificar: vi.fn(), checkPasaporteExists: vi.fn(), checkHabilitacionExists: vi.fn(), crearPorteador: vi.fn(), crearGuia: vi.fn(), checkEmailExists: vi.fn(), consultarAsignacionesActivas: vi.fn() },
}));
vi.mock("./personal.repository", () => ({ PersonalRepository: class { constructor() { return repo; } } }));

describe("PersonalService.modificarPersonal (CU-24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.buscarPorId.mockResolvedValue({ estado: "ACTIVO", nroPasaporte: "X", guia: { idusuario: 9 } });
    repo.consultarAsignacionesActivas.mockResolvedValue([]);
  });

  it("CTA-16: con un permiso Emitido en una salida activa no cambia el pasaporte", async () => {
    repo.consultarAsignacionesActivas.mockResolvedValue([{ salida: { fechaFin: new Date("2030-01-10"), permisos: [{ estadoTramite: "Emitido" }] } }]);
    await expect(new PersonalService().modificarPersonal(1, ModificarPersonalDto.create({ nroPasaporte: "NUEVO1" })[1]!))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.modificar).not.toHaveBeenCalled();
  });

  it("CTA-17: la habilitación tiene que cubrir hasta el fin de las salidas asignadas", async () => {
    repo.consultarAsignacionesActivas.mockResolvedValue([{ salida: { fechaFin: new Date("2099-01-10"), permisos: [] } }]);
    await expect(new PersonalService().modificarPersonal(1, ModificarPersonalDto.create({ fechaHabilitacion: "2098-12-31" })[1]!))
      .rejects.toMatchObject({ statusCode: 409 });
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

  it("rechaza con 409 si el número de habilitación ya está registrado en otro guía", async () => {
    repo.buscarPorId.mockResolvedValue({ idpersonal: 1, estado: "ACTIVO", nroPasaporte: "X", guia: { idpersonal: 1, nroHabilitacion: "HAB-100" } });
    repo.checkHabilitacionExists.mockResolvedValue({ idpersonal: 2, nroHabilitacion: "HAB-200" });

    await expect(new PersonalService().modificarPersonal(1, ModificarPersonalDto.create({ nroHabilitacion: "HAB-200" })[1]!))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.modificar).not.toHaveBeenCalled();
  });
});

describe("PersonalService: 12.8, los rechazos por salidas asignadas son 409 y las listan", () => {
  const salida = (nro: string, fin: string) => ({ idsalida: Number(nro.slice(-1)), nroSalida: nro, fechaInicio: new Date("2030-01-01"), fechaFin: new Date(fin), estado: "PUBLICADA", permisos: [] });
  beforeEach(() => {
    vi.clearAllMocks();
    repo.buscarPorId.mockResolvedValue({ estado: "ACTIVO", nroPasaporte: "X", guia: null });
  });

  it("baja: dice qué salidas la bloquean y las manda en detalle.salidas", async () => {
    repo.darDeBaja.mockResolvedValue({ bloqueadoPor: [salida("SAL-2030-004", "2030-01-04"), salida("SAL-2030-007", "2030-01-07")] });
    await expect(new PersonalService().darDeBaja(1)).rejects.toMatchObject({
      statusCode: 409,
      message: "No se puede dar de baja: está asignado a SAL-2030-004 y SAL-2030-007, que todavía no finalizaron",
      detalle: { salidas: [expect.objectContaining({ idsalida: 4, nroSalida: "SAL-2030-004" }), expect.objectContaining({ nroSalida: "SAL-2030-007" })] },
    });
  });

  it("pasaporte: nombra la última salida que no cubre", async () => {
    repo.consultarAsignacionesActivas.mockResolvedValue([{ salida: salida("SAL-2030-007", "2030-03-15") }, { salida: salida("SAL-2030-004", "2030-01-04") }]);
    await expect(new PersonalService().modificarPersonal(1, ModificarPersonalDto.create({ fechaVencimientoPasaporte: "2030-02-01" })[1]!)).rejects.toMatchObject({
      statusCode: 409,
      message: "El pasaporte no puede vencer antes de que termine SAL-2030-007 (15/03/2030)",
      detalle: { salidas: [expect.objectContaining({ nroSalida: "SAL-2030-007" })] },
    });
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
    repo.checkHabilitacionExists.mockResolvedValue(null);
  });

  it("rechaza con 409 si el número de habilitación ya está registrado", async () => {
    repo.checkHabilitacionExists.mockResolvedValue({ idpersonal: 2, nroHabilitacion: "H-1" });
    await expect(new PersonalService().crearPersonal(dtoDe({}))).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.crearGuia).not.toHaveBeenCalled();
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
