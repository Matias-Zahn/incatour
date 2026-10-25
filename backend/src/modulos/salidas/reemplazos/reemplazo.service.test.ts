import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoridadMock } from "../../../integraciones/autoridad/autoridad.mock";
import { ReemplazoService } from "./reemplazo.service";
import { ConfirmarReemplazoDto } from "./reemplazo.dto";

const { repo, asignacion, actual } = vi.hoisted(() => ({
  repo: { buscarSalida: vi.fn(), buscarPersonal: vi.fn(), marcarPermisoDadoDeBaja: vi.fn(), reemplazar: vi.fn() },
  asignacion: { personalLibre: vi.fn() },
  actual: { autoridad: null as unknown },
}));
vi.mock("./reemplazo.repository", () => ({ ReemplazoRepository: class { constructor() { return repo; } } }));
vi.mock("../asignacion/asignacion.repository", () => ({ AsignacionRepository: class { constructor() { return asignacion; } } }));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => actual.autoridad }));

const INICIO = new Date("2030-11-20");
const FIN = new Date("2030-11-23");
const persona = (id: number, rol = "Guía", habilitacion = "2031-12-31") => ({
  idpersonal: id, nombreCompleto: `Persona ${id}`, rol, nacionalidad: "Peruana", nroPasaporte: `P${id}`,
  fechaVencimientoPasaporte: new Date("2032-01-01"),
  guia: rol === "Guía" ? { fechaHabilitacion: new Date(habilitacion) } : null,
});
const dto = ConfirmarReemplazoDto.create({ idoriginal: 1, idreemplazante: 9, motivo: "Licencia médica" })[1]!;

describe("ReemplazoService.confirmarReemplazo (CU-38)", () => {
  let autoridad: AutoridadMock;
  let idBloqueo: string;
  let nroPermiso: string;

  const salida = (estadoTramite = "Emitido") => ({
    idsalida: 2, nroSalida: "SAL-2030-001", estado: "CERRADA", idbloqueo: idBloqueo, fechaInicio: INICIO, fechaFin: FIN,
    personalAsignado: [{ idpersonal: 1, personal: persona(1) }],
    permisos: [{ idpermisopersonal: 50, idpersonal: 1, nroPermiso, estadoTramite }],
    servicios: [], equipamientos: [],
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    autoridad = new AutoridadMock();
    actual.autoridad = autoridad;
    const b = await autoridad.solicitarBloqueoCupo(INICIO, 5);
    if (!b.aprobado) throw new Error("bloqueo");
    idBloqueo = b.idBloqueo;
    const { emitidos: [emitido] } = await autoridad.solicitarEmisionNominal(idBloqueo, [{ ...persona(1), tipo: "PERSONAL", id: 1 }]);
    nroPermiso = emitido!.nroPermiso;
    repo.buscarSalida.mockResolvedValue(salida());
    repo.buscarPersonal.mockResolvedValue(persona(9));
    asignacion.personalLibre.mockResolvedValue([persona(9)]);
    repo.reemplazar.mockImplementation(async (p) => ({ nroPermiso: p.permisoNuevo.nroPermiso }));
  });

  it("da de baja el permiso del original y emite uno nuevo para el reemplazante", async () => {
    const r = await new ReemplazoService().confirmarReemplazo(2, dto, "admin@incatour.com");

    expect(r.permisoDadoDeBaja).toBe(nroPermiso);
    expect(r.permisoNuevo).toMatch(/^PER-/);
    expect(r.permisoNuevo).not.toBe(nroPermiso);
    expect(repo.reemplazar).toHaveBeenCalledWith(expect.objectContaining({ motivo: "Licencia médica", usuario: "admin@incatour.com" }));
  });

  it("FA1: rechaza un reemplazante de otro rol", async () => {
    repo.buscarPersonal.mockResolvedValue(persona(9, "Porteador"));

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toThrow("tiene que ser Guía");
  });

  it("FA1: rechaza un guía con la habilitación vencida para las fechas", async () => {
    repo.buscarPersonal.mockResolvedValue(persona(9, "Guía", "2030-11-21"));

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toThrow("habilitación vigente");
  });

  it("si falla la emisión del nuevo, deja registrada la baja y el reintento emite sin volver a dar de baja", async () => {
    vi.spyOn(autoridad, "solicitarPermisoIndividual").mockRejectedValueOnce(new Error("caída"));

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.marcarPermisoDadoDeBaja).toHaveBeenCalledWith(50);

    repo.buscarSalida.mockResolvedValue(salida("Dado de baja"));
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");
    const r = await new ReemplazoService().confirmarReemplazo(2, dto, "a");

    expect(baja).not.toHaveBeenCalled();
    expect(r.permisoNuevo).toMatch(/^PER-/);
  });

  it("si el original ya salió y volvió a la salida, usa su permiso más reciente", async () => {
    const viejo = { idpermisopersonal: 10, idpersonal: 1, nroPermiso: "PER-VIEJO", estadoTramite: "Dado de baja" };
    repo.buscarSalida.mockResolvedValue({ ...salida(), permisos: [viejo, ...salida().permisos] });

    const r = await new ReemplazoService().confirmarReemplazo(2, dto, "a");

    expect(r.permisoDadoDeBaja).toBe(nroPermiso);
    expect(repo.marcarPermisoDadoDeBaja).toHaveBeenCalledWith(50);
  });

  it("RF-47: si el original quedó con permiso Rechazado, no da de baja nada y el reemplazante pide permiso nuevo", async () => {
    repo.buscarSalida.mockResolvedValue({
      ...salida(),
      permisos: [{ idpermisopersonal: 50, idpersonal: 1, nroPermiso: null, estadoTramite: "Rechazado" }],
    });
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");

    const r = await new ReemplazoService().confirmarReemplazo(2, dto, "a");

    expect(baja).not.toHaveBeenCalled();
    expect(r.permisoDadoDeBaja).toBeNull();
    expect(r.permisoNuevo).toMatch(/^PER-/);
    expect(repo.marcarPermisoDadoDeBaja).not.toHaveBeenCalled();
    expect(repo.reemplazar).toHaveBeenCalledWith(expect.objectContaining({ idpermisoAnterior: 50 }));
  });

  it("RF-47: si la autoridad también rechaza al reemplazante, responde 400 y no cambia nada", async () => {
    repo.buscarSalida.mockResolvedValue({
      ...salida(),
      permisos: [{ idpermisopersonal: 50, idpersonal: 1, nroPermiso: null, estadoTramite: "Rechazado" }],
    });
    repo.buscarPersonal.mockResolvedValue({ ...persona(9), nroPasaporte: "" });

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.reemplazar).not.toHaveBeenCalled();
  });

  it("compensación: si la base falla después de emitir, da de baja el permiso nuevo", async () => {
    repo.reemplazar.mockRejectedValue(new Error("fallo de la base"));
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toThrow("fallo de la base");
    expect(baja).toHaveBeenCalledTimes(2); // la del original y la compensación del nuevo
  });

  it("SAL-04: si la base falla tras emitir, la fila apunta al permiso nuevo dado de baja y el reintento funciona", async () => {
    const fila = { idpermisopersonal: 50, idpersonal: 1, nroPermiso, estadoTramite: "Emitido" };
    repo.marcarPermisoDadoDeBaja.mockImplementation(async (_id: number, nro?: string) => {
      fila.estadoTramite = "Dado de baja";
      if (nro) fila.nroPermiso = nro;
    });
    repo.buscarSalida.mockImplementation(async () => ({ ...salida(), permisos: [fila] }));
    repo.reemplazar.mockRejectedValueOnce(new Error("fallo de la base"));

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toThrow("fallo de la base");
    const r = await new ReemplazoService().confirmarReemplazo(2, dto, "a");

    expect(r.permisoNuevo).toMatch(/^PER-/);
  });

  it("FA2: no permite reemplazar en una salida que ya inició", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(), estado: "EN_CURSO" });

    await expect(new ReemplazoService().confirmarReemplazo(2, dto, "a")).rejects.toThrow("ya inició");
  });
});
