import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoridadMock } from "../../../integraciones/autoridad/autoridad.mock";
import { AsignacionService } from "./asignacion.service";
import { ConfirmarAsignacionDto } from "./asignacion.dto";

// vi.mock se ejecuta antes que los imports: lo que usan los mocks se declara con vi.hoisted
const { repo, logistica, actual } = vi.hoisted(() => ({
  repo: { buscarSalida: vi.fn(), personalLibre: vi.fn(), buscarPersonal: vi.fn(), confirmar: vi.fn(), tomarSobrantes: vi.fn(), devolverSobrantes: vi.fn() },
  logistica: { disponiblesTransporte: vi.fn(), disponiblesEquipamiento: vi.fn() },
  actual: { autoridad: null as unknown },
}));
vi.mock("./asignacion.repository", () => ({ ESTADOS_ASIGNABLES: ["PUBLICADA", "CERRADA"], AsignacionRepository: class { constructor() { return repo; } } }));
vi.mock("../logistica/logistica.repository", () => ({ LogisticaRepository: class { constructor() { return logistica; } } }));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => actual.autoridad }));

const INICIO = new Date("2026-11-20");
const FIN = new Date("2026-11-23");
const pasaporte = (vence: string) => ({ nacionalidad: "Peruana", nroPasaporte: "P", fechaVencimientoPasaporte: new Date(vence) });
const pasajero = (id: number, vence = "2030-01-01") => ({ idpasajero: id, pasajero: { idpasajero: id, nombreCompleto: `Pasajero ${id}`, ...pasaporte(vence) } });

// Salida de 8 lugares: bloqueo inicial 8 + 2 guías + 4 porteadores = 14. Vendidos 3 → dotación 2 + 2 → sobran 7
const salida = (bloqueo: string, pasajeros = [pasajero(1), pasajero(2), pasajero(3)]) => ({
  idsalida: 2, nroSalida: "SAL-2026-002", estado: "PUBLICADA", idbloqueo: bloqueo, tamanoMaximo: 8,
  fechaInicio: INICIO, fechaFin: FIN, stockLocalAlojamiento: 5, servicios: [], personalAsignado: [],
  paquete: { circuito: { minimoGuias: 2, parametrosPorteadores: "1 por cada 2 pasajeros" } },
  reservas: [{ idreserva: 10, nroReserva: "RES-1", estadoAlojamiento: "CONFIRMADO", pasajeros }],
});
const persona = (id: number, rol: string) => ({
  idpersonal: id, nombreCompleto: `Persona ${id}`, rol, ...pasaporte("2030-01-01"),
  guia: rol === "Guía" ? { fechaHabilitacion: new Date("2028-12-31"), usuario: { estado: "ACTIVO" } } : null,
});
const equipo = [persona(1, "Guía"), persona(2, "Guía"), persona(3, "Porteador"), persona(4, "Porteador")];
const dto = ConfirmarAsignacionDto.create({ personalIds: [1, 2, 3, 4], idtransporte: 7, itemsCamping: [] })[1]!;

describe("AsignacionService.confirmarAsignacion (CU-40)", () => {
  let autoridad: AutoridadMock;
  let idBloqueo: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Hoy fijo antes de INICIO (2026-11-20): solo se simula el reloj de Date
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01"));
    autoridad = new AutoridadMock();
    actual.autoridad = autoridad;
    const b = await autoridad.solicitarBloqueoCupo(INICIO, 14);
    if (!b.aprobado) throw new Error("bloqueo");
    idBloqueo = b.idBloqueo;
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo));
    repo.buscarPersonal.mockResolvedValue(equipo);
    repo.personalLibre.mockResolvedValue(equipo);
    logistica.disponiblesTransporte.mockResolvedValue([{ idservicio: 7 }]);
    logistica.disponiblesEquipamiento.mockResolvedValue([]);
    repo.tomarSobrantes.mockResolvedValue(true);
    repo.devolverSobrantes.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("SAL-10: rechaza asignar una salida que ya empezó, sin emitir permisos", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), fechaInicio: new Date("2026-10-31") });
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toThrow("ya inició");
    expect(emitir).not.toHaveBeenCalled();
  });

  it("emite un permiso por persona de la nómina y libera los 7 lugares sobrantes", async () => {
    repo.confirmar.mockResolvedValue({ idsalida: 2 });

    const r = await new AsignacionService().confirmarAsignacion(2, dto);

    expect(r.permisosEmitidos).toBe(7); // 3 pasajeros + 4 del personal
    expect(r.lugaresLiberados).toBe(7);
    // El bloqueo bajó de 14 a 7 lugares: ese día quedan 493 libres
    expect((await autoridad.solicitarBloqueoCupo(INICIO, 493)).aprobado).toBe(true);
  });

  it("SAL-09: si la autoridad no libera los sobrantes, quedan pendientes y se reintentan", async () => {
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    vi.spyOn(autoridad, "liberarLugaresSobrantes").mockRejectedValueOnce(new Error("caída"));

    const r = await new AsignacionService().confirmarAsignacion(2, dto);
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 7 }));
    expect(r.lugaresLiberados).toBe(0);
    expect(r.advertencia).toContain("liberar-sobrantes");
    expect(repo.devolverSobrantes).toHaveBeenCalledWith(2, 7);

    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), estado: "CERRADA", lugaresPorLiberar: 7 });
    expect(await new AsignacionService().liberarSobrantes(2)).toEqual({ lugaresLiberados: 7 });
    expect((await autoridad.solicitarBloqueoCupo(INICIO, 493)).aprobado).toBe(true);
  });

  it("SAL-09: el reintento sin nada pendiente no llama a la autoridad", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), estado: "CERRADA", lugaresPorLiberar: 0 });
    const liberar = vi.spyOn(autoridad, "liberarLugaresSobrantes");

    expect(await new AsignacionService().liberarSobrantes(2)).toEqual({ lugaresLiberados: 0 });
    expect(liberar).not.toHaveBeenCalled();
  });

  it("SAL-09: si otro pedido ya tomó los sobrantes, no los libera dos veces", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), estado: "CERRADA", lugaresPorLiberar: 7 });
    repo.tomarSobrantes.mockResolvedValue(false);
    const liberar = vi.spyOn(autoridad, "liberarLugaresSobrantes");

    await new AsignacionService().liberarSobrantes(2);
    expect(liberar).not.toHaveBeenCalled();
  });

  it("SAL-09: con la autoridad caída en el reintento responde 503", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), estado: "CERRADA", lugaresPorLiberar: 7 });
    vi.spyOn(autoridad, "liberarLugaresSobrantes").mockRejectedValueOnce(new Error("caída"));

    await expect(new AsignacionService().liberarSobrantes(2)).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.devolverSobrantes).toHaveBeenCalledWith(2, 7);
  });

  it("FA4: con el pasaporte de un integrante del personal vencido no emite permisos ni guarda nada", async () => {
    repo.buscarPersonal.mockResolvedValue([{ ...persona(1, "Guía"), ...pasaporte("2026-11-21") }, ...equipo.slice(1)]);
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toThrow("Persona 1");
    expect(emitir).not.toHaveBeenCalled();
    expect(repo.confirmar).not.toHaveBeenCalled();
  });

  it("SAL-21: el pasajero con el pasaporte vencido queda rechazado sin ir a la autoridad y el resto sigue", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, [pasajero(1), pasajero(2, "2026-11-21"), pasajero(3)]));
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");

    const r = await new AsignacionService().confirmarAsignacion(2, dto);

    expect(emitir.mock.calls[0]![1].map((t) => t.nombreCompleto)).not.toContain("Pasajero 2");
    expect(r.permisosEmitidos).toBe(6);
    expect(r.rechazados).toEqual([
      { tipo: "PASAJERO", id: 2, nombreCompleto: "Pasajero 2", motivo: "Pasaporte vence antes de finalizar el recorrido" },
    ]);
    // 7 sobrantes + el lugar del rechazado
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 8 }));
  });

  it("compensación: si la base falla después de emitir, da de baja los permisos", async () => {
    repo.confirmar.mockRejectedValue(new Error("fallo de la base"));
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toThrow("fallo de la base");
    expect(baja).toHaveBeenCalledTimes(7);
  });

  // Bloqueo 14, nómina de 7 (3 pasajeros + 4 personal): sobran 7. Sin permiso al primero de la nómina
  const rechazarPrimero = (indice: number) => {
    const real = autoridad.solicitarEmisionNominal.bind(autoridad);
    vi.spyOn(autoridad, "solicitarEmisionNominal").mockImplementation(async (id, nomina) => {
      const r = await real(id, nomina.filter((_, i) => i !== indice));
      return { ...r, rechazados: [{ titular: { tipo: nomina[indice]!.tipo, id: nomina[indice]!.id }, motivo: "Pasaporte vencido" }] };
    });
  };

  it("RF-47: si la autoridad rechaza a un pasajero, guarda a los demás, registra el rechazo y libera su lugar", async () => {
    rechazarPrimero(0);
    repo.confirmar.mockImplementation(async (p) => ({ idsalida: 2, estado: "CERRADA", lugaresPorLiberar: p.lugaresPorLiberar }));
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");
    const liberar = vi.spyOn(autoridad, "liberarLugaresSobrantes");

    const r = await new AsignacionService().confirmarAsignacion(2, dto);

    expect(baja).not.toHaveBeenCalled();
    expect(r.permisosEmitidos).toBe(6);
    expect(r.rechazados).toEqual([{ tipo: "PASAJERO", id: 1, nombreCompleto: "Pasajero 1", motivo: "Pasaporte vencido" }]);
    // 7 sobrantes + 1 del rechazado (no ocupa lugar): quedan 6 permisos en un bloqueo de 6
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 8, rechazados: [expect.objectContaining({ motivo: "Pasaporte vencido" })] }));
    expect(liberar).toHaveBeenCalledWith(idBloqueo, 8);
    expect(r.lugaresLiberados).toBe(8);
  });

  it("RF-47: el lugar de un personal rechazado queda reservado para su reemplazo", async () => {
    rechazarPrimero(3); // nómina: 3 pasajeros y después el personal
    repo.confirmar.mockResolvedValue({ idsalida: 2 });

    const r = await new AsignacionService().confirmarAsignacion(2, dto);

    expect(r.rechazados).toEqual([{ tipo: "PERSONAL", id: 1, nombreCompleto: "Persona 1", motivo: "Pasaporte vencido" }]);
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 7 }));
    expect(r.lugaresLiberados).toBe(7);
  });

  it("FA1: rechaza un guía sin habilitación vigente para las fechas", async () => {
    const vencido = { ...persona(1, "Guía"), guia: { fechaHabilitacion: new Date("2026-11-21"), usuario: { estado: "ACTIVO" } } };
    repo.buscarPersonal.mockResolvedValue([vencido, ...equipo.slice(1)]);

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toThrow("habilitación vigente");
  });

  it("exige la dotación mínima", async () => {
    const pocos = ConfirmarAsignacionDto.create({ personalIds: [1, 3, 4], idtransporte: 7 })[1]!;
    repo.buscarPersonal.mockResolvedValue([equipo[0], equipo[2], equipo[3]]);

    await expect(new AsignacionService().confirmarAsignacion(2, pocos)).rejects.toThrow("al menos 2 guías");
  });

  it("CTA-18: un guía sin cuenta activa no se asigna (no podría informar los avances)", async () => {
    repo.buscarPersonal.mockResolvedValue(equipo.map((p) => (p.guia ? { ...p, guia: { ...p.guia, usuario: null } } : p)));

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toThrow("cuenta de usuario activa");
  });

  it("FA5: con alojamientos pendientes responde 409", async () => {
    repo.buscarSalida.mockResolvedValue({
      ...salida(idBloqueo),
      reservas: [{ idreserva: 10, nroReserva: "RES-1", estadoAlojamiento: "PENDIENTE", pasajeros: [pasajero(1)] }],
    });

    await expect(new AsignacionService().confirmarAsignacion(2, dto)).rejects.toMatchObject({ statusCode: 409 });
  });
});
