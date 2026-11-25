import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoridadMock } from "../../../integraciones/autoridad/autoridad.mock";
import { AsignacionService } from "./asignacion.service";

// vi.mock se ejecuta antes que los imports: lo que usan los mocks se declara con vi.hoisted
const { repo, salidas, actual } = vi.hoisted(() => ({
  repo: { buscarSalida: vi.fn(), confirmar: vi.fn(), tomarSobrantes: vi.fn(), devolverSobrantes: vi.fn(), buscarPersonal: vi.fn(), asignarPersonal: vi.fn(), salidasEnElMes: vi.fn() },
  salidas: { cargarEquipoDe: vi.fn() },
  actual: { autoridad: null as unknown },
}));
vi.mock("./asignacion.repository", () => ({ AsignacionRepository: class { constructor() { return repo; } } }));
vi.mock("../salidas/salida.repository", () => ({ SalidaRepository: class { constructor() { return salidas; } } }));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => actual.autoridad }));

const INICIO = new Date("2026-11-20");
const FIN = new Date("2026-11-23");
const pasaporte = (vence: string) => ({ nacionalidad: "Peruana", nroPasaporte: "P", fechaVencimientoPasaporte: new Date(vence) });
const pasajero = (id: number, vence = "2030-01-01") => ({ idpasajero: id, pasajero: { idpasajero: id, nombreCompleto: `Pasajero ${id}`, ...pasaporte(vence) } });
const persona = (id: number, rol: string, extra: Record<string, unknown> = {}) => ({
  idpersonal: id,
  personal: {
    idpersonal: id, nombreCompleto: `Persona ${id}`, rol, estado: "ACTIVO", ...pasaporte("2030-01-01"),
    guia: rol === "Guía" ? { fechaHabilitacion: new Date("2028-12-31"), usuario: { estado: "ACTIVO" } } : null,
    ...extra,
  },
});
const equipo = [persona(1, "Guía"), persona(2, "Guía"), persona(3, "Porteador"), persona(4, "Porteador")];
const bus = { idservicio: 7, tipo: "TRANSPORTE", servicio: { nombreServicio: "Bus", transporte: { capacidadVehiculo: 20 }, alojamiento: null, equipamiento: null } };

// Salida de 8 lugares con 4 del personal (asignado al crearla): bloqueo 12. Vendidos 3 → sobran 5.
// Hoy es 01/11 y el corte de 25 días ya pasó: se puede confirmar
const salida = (bloqueo: string, pasajeros = [pasajero(1), pasajero(2), pasajero(3)], extra: Record<string, unknown> = {}) => ({
  idsalida: 2, nroSalida: "SAL-2026-002", estado: "PUBLICADA", idbloqueo: bloqueo, tamanoMaximo: 8, diasCierreVenta: 25,
  fechaInicio: INICIO, fechaFin: FIN, stockLocalAlojamiento: 5, definicionPaquete: null, personalAsignado: equipo, ocupaciones: [bus],
  paquete: { circuito: { minimoGuias: 2, parametrosPorteadores: "1 por cada 2 pasajeros" } },
  reservas: [{ idreserva: 10, nroReserva: "RES-1", estadoAlojamiento: "CONFIRMADO", pasajeros }],
  ...extra,
});

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
    const b = await autoridad.solicitarBloqueoCupo(INICIO, 12);
    if (!b.aprobado) throw new Error("bloqueo");
    idBloqueo = b.idBloqueo;
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo));
    salidas.cargarEquipoDe.mockResolvedValue({ totales: new Map(), filas: [] });
    repo.tomarSobrantes.mockResolvedValue(true);
    repo.devolverSobrantes.mockResolvedValue(undefined);
    repo.salidasEnElMes.mockResolvedValue(new Map());
  });

  afterEach(() => vi.useRealTimers());

  it("SAL-10: rechaza asignar una salida que ya empezó, sin emitir permisos", async () => {
    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), fechaInicio: new Date("2026-10-31") });
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");

    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("ya inició");
    expect(emitir).not.toHaveBeenCalled();
  });

  it("decisión 4: antes del corte no se confirma", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { diasCierreVenta: 2 }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toMatchObject({
      statusCode: 400,
      message: "La venta sigue abierta hasta el 17/11/2026: la salida se confirma después del corte",
    });
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { estado: "CERRADA" }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("ya está confirmada");
  });

  it("panel: puede confirmar, con el personal, el transporte y los porteadores que sobran (decisión 5)", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { personalAsignado: [...equipo, persona(5, "Porteador")] }));
    const panel = await new AsignacionService().obtenerPanelAsignacion(2);
    expect(panel).toMatchObject({
      puedeConfirmar: true, motivoNoConfirmable: null, pasajerosConfirmados: 3, dotacionRequerida: { guias: 2, porteadores: 2 },
      porteadoresSobrantes: 1, transporte: { idservicio: 7, capacidadVehiculo: 20, alcanza: true }, faltantes: [], bloqueoInicial: 13, lugaresSobrantes: 5,
    });
    expect(panel.personal[0]).toEqual({ idpersonal: 1, nombreCompleto: "Persona 1", rol: "Guía", apto: true, motivo: null });
  });

  it("salida anterior a la etapa 3 sin personal: el panel lo pide y confirmar lo asigna con personalIds", async () => {
    const vieja = salida(idBloqueo, undefined, { personalAsignado: [] });
    repo.buscarSalida.mockResolvedValue(vieja);
    expect((await new AsignacionService().obtenerPanelAsignacion(2)).faltantes).toEqual([
      "Sin personal asignado: la salida necesita al menos 2 guías y 2 porteadores (se eligen al confirmar)",
    ]);

    repo.buscarPersonal.mockResolvedValue([equipo[0]!.personal, { ...equipo[1]!.personal, estado: "INACTIVO" }]);
    await expect(new AsignacionService().confirmarAsignacion(2, [1, 2])).rejects.toThrow("Persona 2: está dado de baja");

    repo.buscarPersonal.mockResolvedValue(equipo.map((e) => e.personal));
    repo.asignarPersonal.mockImplementation(async () => repo.buscarSalida.mockResolvedValue(salida(idBloqueo)));
    repo.confirmar.mockResolvedValue({ idsalida: 2, nroSalida: "SAL-2026-002", estado: "CERRADA" });
    await new AsignacionService().confirmarAsignacion(2, [1, 2, 3, 4]);
    expect(repo.asignarPersonal).toHaveBeenCalledWith(vieja, [1, 2, 3, 4]);
    expect(repo.confirmar).toHaveBeenCalled();

    // con personal ya asignado, personalIds no vale
    await expect(new AsignacionService().confirmarAsignacion(2, [1])).rejects.toThrow("La salida ya tiene personal");
  });

  it("B4: sin transporte no se confirma: 409 con los faltantes en el detalle", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { ocupaciones: [] }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toMatchObject({
      statusCode: 409,
      message: "Falta resolver antes de confirmar: Falta el transporte",
      detalle: { faltantes: ["Falta el transporte"] },
    });
  });

  it("emite un permiso por persona de la nómina y libera los 5 lugares sobrantes", async () => {
    repo.confirmar.mockResolvedValue({ idsalida: 2 });

    const r = await new AsignacionService().confirmarAsignacion(2);

    expect(r.permisosEmitidos).toBe(7); // 3 pasajeros + 4 del personal
    expect(r.lugaresLiberados).toBe(5);
    // El bloqueo bajó de 12 a 7 lugares: ese día quedan 493 libres
    expect((await autoridad.solicitarBloqueoCupo(INICIO, 493)).aprobado).toBe(true);
  });

  it("decisión 5: con 1 vendido sobra un porteador: el admin elige cuál se desasigna, sin permiso y con su lugar liberado", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, [pasajero(1)]));
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    const servicio = new AsignacionService();

    await expect(servicio.confirmarAsignacion(2, undefined, [])).rejects.toThrow("Sobran 1 porteador para lo vendido: elegí cuál se libera");
    await expect(servicio.confirmarAsignacion(2, undefined, [1])).rejects.toThrow("Solo se pueden liberar porteadores asignados");
    expect(repo.confirmar).not.toHaveBeenCalled();

    const r = await servicio.confirmarAsignacion(2, undefined, [3]);

    expect(r.porteadoresLiberados).toBe(1);
    expect(r.permisosEmitidos).toBe(4); // 1 pasajero + 2 guías + el porteador 4
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ porteadoresQuitados: [3], lugaresPorLiberar: 8 }));
  });

  it("decisión 5: si el admin no elige, se libera el porteador con más salidas en el mes", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, [pasajero(1)]));
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    repo.salidasEnElMes.mockResolvedValue(new Map([[3, 4], [4, 1]]));

    await new AsignacionService().confirmarAsignacion(2);

    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ porteadoresQuitados: [3] }));
  });

  it("SAL-09: si la autoridad no libera los sobrantes, quedan pendientes y se reintentan", async () => {
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    vi.spyOn(autoridad, "liberarLugaresSobrantes").mockRejectedValueOnce(new Error("caída"));

    const r = await new AsignacionService().confirmarAsignacion(2);
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 5 }));
    expect(r.lugaresLiberados).toBe(0);
    expect(r.advertencia).toContain("liberar-sobrantes");
    expect(repo.devolverSobrantes).toHaveBeenCalledWith(2, 5);

    repo.buscarSalida.mockResolvedValue({ ...salida(idBloqueo), estado: "CERRADA", lugaresPorLiberar: 5 });
    expect(await new AsignacionService().liberarSobrantes(2)).toEqual({ lugaresLiberados: 5 });
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

  it("12.3: con el pasaporte de un integrante del personal vencido (aunque sea el último día) no emite ni guarda nada", async () => {
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");
    for (const vence of ["2026-11-21", "2026-11-23"]) {
      repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { personalAsignado: [persona(1, "Guía", pasaporte(vence)), ...equipo.slice(1)] }));
      await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("Persona 1: el pasaporte vence") });
    }
    expect(emitir).not.toHaveBeenCalled();
    expect(repo.confirmar).not.toHaveBeenCalled();
  });

  it("SAL-21: el pasajero con el pasaporte vencido queda rechazado sin ir a la autoridad y el resto sigue", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, [pasajero(1), pasajero(2, "2026-11-21"), pasajero(3)]));
    repo.confirmar.mockResolvedValue({ idsalida: 2 });
    const emitir = vi.spyOn(autoridad, "solicitarEmisionNominal");

    const r = await new AsignacionService().confirmarAsignacion(2);

    expect(emitir.mock.calls[0]![1].map((t) => t.nombreCompleto)).not.toContain("Pasajero 2");
    expect(r.permisosEmitidos).toBe(6);
    expect(r.rechazados).toEqual([
      { tipo: "PASAJERO", id: 2, nombreCompleto: "Pasajero 2", motivo: "Pasaporte vence antes de finalizar el recorrido" },
    ]);
    // 5 sobrantes + el lugar del rechazado
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 6 }));
  });

  it("compensación: si la base falla después de emitir, da de baja los permisos", async () => {
    repo.confirmar.mockRejectedValue(new Error("fallo de la base"));
    const baja = vi.spyOn(autoridad, "darDeBajaPermiso");

    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("fallo de la base");
    expect(baja).toHaveBeenCalledTimes(7);
  });

  // Bloqueo 12, nómina de 7 (3 pasajeros + 4 personal): sobran 5. Sin permiso al primero de la nómina
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

    const r = await new AsignacionService().confirmarAsignacion(2);

    expect(baja).not.toHaveBeenCalled();
    expect(r.permisosEmitidos).toBe(6);
    expect(r.rechazados).toEqual([{ tipo: "PASAJERO", id: 1, nombreCompleto: "Pasajero 1", motivo: "Pasaporte vencido" }]);
    // 5 sobrantes + 1 del rechazado (no ocupa lugar): quedan 6 permisos en un bloqueo de 6
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 6, rechazados: [expect.objectContaining({ motivo: "Pasaporte vencido" })] }));
    expect(liberar).toHaveBeenCalledWith(idBloqueo, 6);
    expect(r.lugaresLiberados).toBe(6);
  });

  it("RF-47: el lugar de un personal rechazado queda reservado para su reemplazo", async () => {
    rechazarPrimero(3); // nómina: 3 pasajeros y después el personal
    repo.confirmar.mockResolvedValue({ idsalida: 2 });

    const r = await new AsignacionService().confirmarAsignacion(2);

    expect(r.rechazados).toEqual([{ tipo: "PERSONAL", id: 1, nombreCompleto: "Persona 1", motivo: "Pasaporte vencido" }]);
    expect(repo.confirmar).toHaveBeenCalledWith(expect.objectContaining({ lugaresPorLiberar: 5 }));
    expect(r.lugaresLiberados).toBe(5);
  });

  it("12.3: un guía con la habilitación vencida o sin cuenta activa frena la confirmación", async () => {
    const vencida = persona(1, "Guía", { guia: { fechaHabilitacion: new Date("2026-11-21"), usuario: { estado: "ACTIVO" } } });
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { personalAsignado: [vencida, ...equipo.slice(1)] }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("Persona 1: la habilitación vence el 21/11/2026");

    const sinCuenta = persona(1, "Guía", { guia: { fechaHabilitacion: new Date("2028-12-31"), usuario: null } });
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { personalAsignado: [sinCuenta, ...equipo.slice(1)] }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("cuenta de usuario activa");
  });

  it("exige la dotación mínima por los vendidos", async () => {
    repo.buscarSalida.mockResolvedValue(salida(idBloqueo, undefined, { personalAsignado: [equipo[0], equipo[2], equipo[3]] }));
    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toThrow("al menos 2 guías y 2 porteadores (tiene 1 y 2)");
  });

  it("FA5: con alojamientos pendientes responde 409", async () => {
    repo.buscarSalida.mockResolvedValue({
      ...salida(idBloqueo),
      reservas: [{ idreserva: 10, nroReserva: "RES-1", estadoAlojamiento: "PENDIENTE", pasajeros: [pasajero(1)] }],
    });

    await expect(new AsignacionService().confirmarAsignacion(2)).rejects.toMatchObject({ statusCode: 409 });
  });
});
