import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoridadMock } from "../../../integraciones/autoridad/autoridad.mock";
import { CrearSalidaDto } from "./salida.dto";

import { hoyUTC } from "../../../shared/fechas";
import { SalidaService, resumirSalida } from "./salida.service";

// vi.mock se ejecuta antes que los imports: lo que usan los mocks se declara con vi.hoisted
const { repo, actual } = vi.hoisted(() => ({
  // Repositorio falso: sin base de datos, controlamos qué devuelve y si falla
  repo: {
    buscarPaquete: vi.fn(), buscarAlojamientosConBloqueo: vi.fn(), crearSalida: vi.fn(), buscarTransportes: vi.fn(),
    buscarPersonalLibre: vi.fn(), buscarPersonal: vi.fn(), cargarEquipoDe: vi.fn(),
  },
  actual: { autoridad: null as unknown },
}));
vi.mock("./salida.repository", () => ({
  SalidaRepository: class {
    constructor() {
      return repo;
    }
  },
}));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => actual.autoridad }));
let autoridad: AutoridadMock;

// Fechas relativas a hoy: una fija se vuelve pasada y rompe los tests
const enDias = (n: number) => new Date(hoyUTC().getTime() + n * 86400000);
const FECHA = enDias(20).toISOString().slice(0, 10);
const paquete = {
  idpaquete: 1,
  nombrePaquete: "Inca Clásico",
  estado: "ACTIVO",
  circuito: { estado: "ACTIVO", duracionDias: 4, minimoGuias: 2, parametrosPorteadores: "1 por cada 2 pasajeros" },
  tarifas: [{ temporada: { estado: "ACTIVO", fechaInicio: enDias(-30), fechaFin: enDias(365) } }],
  garantiasEstablecimiento: [],
  servicios: [] as unknown[],
  diasDisponibles: null as string | null,
  diasCierreVenta: 2,
};
// B3: 16 pasajeros piden 2 guías y 8 porteadores; el transporte 7 tiene 30 asientos
const persona = (id: number, extra: Record<string, unknown> = {}) => ({
  idpersonal: id, nombreCompleto: `Persona ${id}`, rol: id <= 2 ? "Guía" : "Porteador", estado: "ACTIVO",
  fechaVencimientoPasaporte: enDias(400), salidasEnElMes: 0,
  guia: id <= 2 ? { fechaHabilitacion: enDias(400), usuario: { estado: "ACTIVO" } } : null,
  ...extra,
});
const PERSONAL = Array.from({ length: 10 }, (_, i) => persona(i + 1));
const dto = (extra = {}) =>
  CrearSalidaDto.create({ idpaquete: 1, fechaInicio: FECHA, tamanoMaximo: 16, idtransporte: 7, personalIds: PERSONAL.map((p) => p.idpersonal), ...extra }, true)[1]!;
// Lo que devuelve el repositorio al crear: la salida con la forma del listado
const creada = {
  idsalida: 9, estado: "PUBLICADA", fechaInicio: enDias(20), fechaFin: enDias(23), tamanoMaximo: 16, diasCierreVenta: 2,
  definicionPaquete: null, avances: [], permisos: [], reservas: [], personalAsignado: [], ocupaciones: [],
  paquete: { circuito: { duracionDias: 4, _count: { etapas: 0 } } },
};
const equipoVacio = { totales: new Map(), filas: [] };
const mocksDeAlta = () => {
  repo.buscarTransportes.mockResolvedValue([{ idservicio: 7, nombreServicio: "Bus", capacidadVehiculo: 30, libre: true }]);
  repo.buscarPersonalLibre.mockResolvedValue(PERSONAL);
  repo.buscarPersonal.mockResolvedValue(PERSONAL);
  repo.cargarEquipoDe.mockResolvedValue(equipoVacio);
  repo.crearSalida.mockResolvedValue(creada);
};

describe("SalidaService.crearSalida (CU-36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autoridad = actual.autoridad = new AutoridadMock();
    repo.buscarPaquete.mockResolvedValue(paquete);
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([]); // FA3: ninguno confirma por bloqueo
    mocksDeAlta();
  });

  it("bloquea tamaño máximo + personal elegido (16 + 2 guías + 8 porteadores = 26) y asigna el personal y el transporte", async () => {
    const r = await new SalidaService().crearSalida(dto());

    expect(r.totalLugares).toBe(26);
    expect(r.salida).toMatchObject({ idsalida: 9, ventaAbierta: true, alertas: ["FALTA_RECURSO"] }); // el mock no trae el transporte
    expect(repo.crearSalida).toHaveBeenCalledWith(
      expect.objectContaining({ fechaFin: enDias(23), idtransporte: 7, personalIds: PERSONAL.map((p) => p.idpersonal) })
    );
  });

  it("B3: se aceptan extras; el cupo se pide por el máximo más todo el personal (decisión 5)", async () => {
    repo.buscarPersonalLibre.mockResolvedValue([...PERSONAL, persona(11)]);
    repo.buscarPersonal.mockResolvedValue([...PERSONAL, persona(11)]);
    const r = await new SalidaService().crearSalida(dto({ personalIds: [...PERSONAL.map((p) => p.idpersonal), 11] }));
    expect(r.totalLugares).toBe(27);
  });

  it("B3: rechaza personal que no cubre la dotación, uno no apto (12.3) y uno ocupado en esas fechas", async () => {
    repo.buscarPersonal.mockResolvedValueOnce(PERSONAL.slice(0, 3));
    await expect(new SalidaService().crearSalida(dto({ personalIds: [1, 2, 3] }))).rejects.toThrow("al menos 2 guías y 8 porteadores (elegiste 2 y 1)");

    repo.buscarPersonal.mockResolvedValue([persona(1, { guia: { fechaHabilitacion: enDias(21), usuario: { estado: "ACTIVO" } } }), ...PERSONAL.slice(1)]);
    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("Persona 1: la habilitación vence el");

    repo.buscarPersonal.mockResolvedValue(PERSONAL);
    repo.buscarPersonalLibre.mockResolvedValue(PERSONAL.slice(1));
    await expect(new SalidaService().crearSalida(dto())).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("12.4: el transporte tiene que llevar a los pasajeros y al personal", async () => {
    repo.buscarTransportes.mockResolvedValue([{ idservicio: 7, nombreServicio: "Van", capacidadVehiculo: 20, libre: true }]);
    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow(
      "El transporte elegido tiene 20 asientos y la salida necesita 26 lugares (16 pasajeros y 10 del personal)"
    );
    repo.buscarTransportes.mockResolvedValue([{ idservicio: 7, nombreServicio: "Bus", capacidadVehiculo: 30, libre: false }]);
    await expect(new SalidaService().crearSalida(dto())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("A2b: equipo bajo el 50 % no crea (409 con detalle); entre 50 y 100 % crea con advertencia", async () => {
    const carpa = { servicio: { idservicio: 5, nombreServicio: "Carpa", equipamiento: { tipoEquipamiento: "Carpa" } }, idservicio: 5, cantidad: 1, cadaPasajeros: 2 };
    repo.buscarPaquete.mockResolvedValue({ ...paquete, servicios: [carpa] });
    // 16 pasajeros necesitan 8 carpas: con 3 libres no se crea, y se sugiere un máximo de 6
    repo.cargarEquipoDe.mockResolvedValue({ totales: new Map([[5, 3]]), filas: [] });
    await expect(new SalidaService().crearSalida(dto())).rejects.toMatchObject({
      statusCode: 409,
      detalle: { faltantes: [{ idservicio: 5, libre: 3, necesitaMinimo: 4 }], tamanoMaximoSugerido: 6 },
    });
    expect(repo.crearSalida).not.toHaveBeenCalled();

    repo.cargarEquipoDe.mockResolvedValue({ totales: new Map([[5, 5]]), filas: [] });
    const r = await new SalidaService().crearSalida(dto());
    expect(r.advertencias).toEqual([expect.stringMatching(/^Si se vende completa faltarían hasta 3 de Carpa el /)]);
    expect(repo.crearSalida).toHaveBeenCalledWith(expect.objectContaining({ equipos: [5] }));
  });

  it("FA1: sin cupo suficiente no crea la salida y dice cuántos lugares hay", async () => {
    await autoridad.solicitarBloqueoCupo(new Date(FECHA), 490);

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("hay 10 disponibles");
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("FA2: si la autoridad no responde, responde 503 y no crea la salida", async () => {
    actual.autoridad = new AutoridadMock(true);

    await expect(new SalidaService().crearSalida(dto())).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("BE-01 y 12.6: tiene que empezar después de hoy + corte (2 días), a cualquier hora del día", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 25, 23, 30)); // 25/10 23:30 hora local
      // el personal tiene que ser apto hasta el fin de esas fechas, no las de hoy + 20
      const vigente = PERSONAL.map((p) => ({ ...p, fechaVencimientoPasaporte: new Date("2030-01-01"), guia: p.guia && { ...p.guia, fechaHabilitacion: new Date("2030-01-01") } }));
      repo.buscarPersonal.mockResolvedValue(vigente);
      repo.buscarPersonalLibre.mockResolvedValue(vigente);
      const paqueteVigente = { ...paquete, tarifas: [{ temporada: { estado: "ACTIVO", fechaInicio: new Date("2026-01-01"), fechaFin: new Date("2026-12-31") } }] };
      repo.buscarPaquete.mockResolvedValue(paqueteVigente);

      await expect(new SalidaService().crearSalida(dto({ fechaInicio: "2026-10-28" }))).resolves.toBeDefined();
      await expect(new SalidaService().crearSalida(dto({ fechaInicio: "2026-10-27" }))).rejects.toThrow(
        "La salida tiene que empezar después del 27/10/2026: la venta cierra 2 días antes del inicio"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("compensación: si la base falla después del bloqueo, devuelve los lugares a la autoridad", async () => {
    repo.crearSalida.mockRejectedValue(new Error("fallo de la base"));

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("fallo de la base");

    // Si el bloqueo se hubiera quedado tomado, solo quedarían 474 lugares y esto fallaría
    const resultado = await autoridad.solicitarBloqueoCupo(new Date(FECHA), 500);
    expect(resultado.aprobado).toBe(true);
  });

  it("A1: el hotel se mira y se ocupa solo en las noches previas y posteriores del paquete", async () => {
    repo.buscarPaquete.mockResolvedValue({ ...paquete, nochesPrevias: 1, nochesPosteriores: 2 });
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([{ idservicio: 4, disponible: 16 }]);

    await new SalidaService().crearSalida(dto({ idalojamiento: 4 }));

    // Inicio en FECHA, 4 días: noche previa FECHA−1 y posteriores del último día (FECHA+3) al siguiente
    const rangos = [
      { desde: enDias(19), hasta: enDias(19) },
      { desde: enDias(23), hasta: enDias(24) },
    ];
    expect(repo.buscarAlojamientosConBloqueo).toHaveBeenCalledWith(expect.anything(), rangos);
    expect(repo.crearSalida).toHaveBeenCalledWith(expect.objectContaining({ idalojamiento: 4, rangosAlojamiento: rangos }));
  });

  it("A1: rechaza el hotel si no le alcanza lo disponible en esas noches", async () => {
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([{ idservicio: 4, disponible: 15 }]);

    await expect(new SalidaService().crearSalida(dto({ idalojamiento: 4 }))).rejects.toThrow("capacidad suficiente");
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("exige elegir alojamiento si hay alguno que confirma por bloqueo", async () => {
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([{ idservicio: 4, disponible: 20 }]);

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("elegí uno");
  });

  it("B4: guarda el corte del paquete, o 5 días si el hotel queda a solicitud; el admin lo puede cambiar", async () => {
    await new SalidaService().crearSalida(dto());
    expect(repo.crearSalida).toHaveBeenLastCalledWith(expect.objectContaining({ diasCierreVenta: 2 }));

    repo.buscarPaquete.mockResolvedValue({ ...paquete, nochesPrevias: 1, nochesPosteriores: 0 }); // noches sin hotel con bloqueo
    await new SalidaService().crearSalida(dto());
    expect(repo.crearSalida).toHaveBeenLastCalledWith(expect.objectContaining({ diasCierreVenta: 5 }));

    await new SalidaService().crearSalida(dto({ diasCierreVenta: 3 }));
    expect(repo.crearSalida).toHaveBeenLastCalledWith(expect.objectContaining({ diasCierreVenta: 3 }));
  });

  it("12.6: con el corte de 5 días a solicitud, rechaza una fecha que sí servía con 2", async () => {
    repo.buscarPaquete.mockResolvedValue({ ...paquete, nochesPrevias: 1, nochesPosteriores: 0 });
    await expect(new SalidaService().crearSalida(dto({ fechaInicio: enDias(4).toISOString().slice(0, 10) }))).rejects.toThrow(
      "la venta cierra 5 días antes del inicio"
    );
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });
});

describe("SalidaService.consultarOpcionesSalida (CU-36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autoridad = actual.autoridad = new AutoridadMock();
    repo.buscarPaquete.mockResolvedValue(paquete);
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([]);
    mocksDeAlta();
  });

  it("B3: lista solo el personal apto, por salidas en el mes y nombre, y si cada transporte alcanza (12.4)", async () => {
    repo.buscarPersonalLibre.mockResolvedValue([
      persona(1, { nombreCompleto: "Zoe", salidasEnElMes: 0 }),
      persona(2, { nombreCompleto: "Ana", salidasEnElMes: 2 }),
      persona(3, { nombreCompleto: "Beto", fechaVencimientoPasaporte: enDias(10) }), // vence antes del fin
      persona(4, { nombreCompleto: "Ceci", salidasEnElMes: 1 }),
    ]);
    const r = await new SalidaService().consultarOpcionesSalida(dto());
    expect(r.personal.guias.map((p) => p.nombreCompleto)).toEqual(["Zoe", "Ana"]);
    expect(r.personal.porteadores.map((p) => p.nombreCompleto)).toEqual(["Ceci"]);
    expect(r.transportes).toEqual([{ idservicio: 7, nombreServicio: "Bus", capacidadVehiculo: 30, delPaquete: false, libre: true, alcanza: true }]);
    expect(r.fechaFin).toBe(enDias(23).toISOString().slice(0, 10));
  });

  it("informa los lugares libres de la autoridad ese día y si alcanzan", async () => {
    await autoridad.solicitarBloqueoCupo(new Date(FECHA), 490);

    const r = await new SalidaService().consultarOpcionesSalida(dto());

    expect(r.cupoAutoridad).toEqual({ lugaresDisponibles: 10, alcanza: false });
  });

  it("con la autoridad caída no falla: cupoAutoridad queda en null", async () => {
    actual.autoridad = new AutoridadMock(true);

    const r = await new SalidaService().consultarOpcionesSalida(dto());

    expect(r.cupoAutoridad).toBeNull();
  });

  // FECHA es hoy + 20: se arma un paquete que no sale ese día de la semana
  const DIAS = ["D", "L", "M", "X", "J", "V", "S"];
  const diaDe = (f: string) => DIAS[new Date(f).getUTCDay()]!;
  const otroDia = (f: string) => DIAS[(new Date(f).getUTCDay() + 1) % 7]!;

  it("B9: rechaza un día que el paquete no tiene habilitado", async () => {
    repo.buscarPaquete.mockResolvedValue({ ...paquete, diasDisponibles: otroDia(FECHA) });
    await expect(new SalidaService().consultarOpcionesSalida(dto())).rejects.toThrow(/El paquete no sale los .*: los días habilitados son/);
  });

  it("B9: con tren, rechaza un día en que el tren no opera e informa el tren", async () => {
    const tren = (dias: string) => ({ servicio: { idservicio: 7, nombreServicio: "Expedition", tren: { horarioSalida: "06:10", horarioLlegada: "07:45", diasOperacion: dias } } });
    repo.buscarPaquete.mockResolvedValue({ ...paquete, servicios: [tren(otroDia(FECHA))] });
    await expect(new SalidaService().consultarOpcionesSalida(dto())).rejects.toThrow(`El tren Expedition no opera los`);

    repo.buscarPaquete.mockResolvedValue({ ...paquete, servicios: [tren(diaDe(FECHA))] });
    const r = await new SalidaService().consultarOpcionesSalida(dto());
    expect(r.tren).toMatchObject({ idservicio: 7, horarioSalida: "06:10", operaEseDia: true });
    expect(r.paquete.diasCierreVenta).toBe(2);
  });
});

describe("resumirSalida (CU-35, RF-50 y RF-61)", () => {
  const AHORA = new Date("2026-11-15T12:00:00Z");
  // Circuito de 4 días y 4 etapas; 1 reserva confirmada con 3 pasajeros, sin personal ni permisos
  const listada = (extra: Record<string, unknown> = {}, reserva: Record<string, unknown> = {}) =>
    ({
      idsalida: 1,
      estado: "PUBLICADA",
      fechaInicio: new Date("2026-11-20"),
      fechaFin: new Date("2026-11-23"),
      fechaHoraInicioReal: null,
      ultimaEtapaAlcanzada: null,
      avances: [],
      paquete: { nroPaquete: "PAQ-1", nombrePaquete: "Inca", circuito: { idcircuito: 1, nombreCircuito: "C", duracionDias: 4, _count: { etapas: 4 } } },
      diasCierreVenta: 2,
      tamanoMaximo: 8,
      definicionPaquete: null,
      personalAsignado: [],
      ocupaciones: [{ idsalida: 1, idservicio: 5, tipo: "TRANSPORTE", comprobanteReserva: null, servicio: { nombreServicio: "Bus", transporte: { capacidadVehiculo: 20 } } }],
      permisos: [],
      reservas: [{ _count: { pasajeros: 3 }, permisos: [], solicitudes: [], ...reserva }],
      ...extra,
    }) as unknown as Parameters<typeof resumirSalida>[0];

  it("cuenta pasajeros, personal, guías y permisos faltantes", () => {
    const r = resumirSalida(
      listada({
        personalAsignado: [{ personal: { nombreCompleto: "Rosa", rol: "Guía" } }, { personal: { nombreCompleto: "Juan", rol: "Porteador" } }],
        permisos: [{ idpermisopersonal: 1 }],
      }, { permisos: [{ idpermisopasajero: 1 }, { idpermisopasajero: 2 }] }),
      AHORA
    );
    expect(r).toMatchObject({ pasajerosConfirmados: 3, cantidadPersonal: 2, guias: ["Rosa"], permisosFaltantes: 2 });
    expect(r).not.toHaveProperty("reservas");
  });

  it("RF-61: a 7 días o menos alerta solicitudes pendientes y permisos sin emitir", () => {
    const r = resumirSalida(listada({}, { solicitudes: [{ idsolicitud: 1 }] }), AHORA);
    expect(r.alertas).toEqual(["SOLICITUD_PENDIENTE", "PERMISOS_SIN_CONFIRMAR"]);
  });

  it("RF-61: a más de 7 días no alerta", () => {
    expect(resumirSalida(listada({ fechaInicio: new Date("2026-12-20") }, { solicitudes: [{ idsolicitud: 1 }] }), AHORA).alertas).toEqual([]);
  });

  it("en curso: etapa esperada proporcional y desfasada si el guía informó menos", () => {
    // Día 3 de 4 con 4 etapas → etapa 3; el guía informó la 1
    const r = resumirSalida(listada({ estado: "EN_CURSO", fechaInicio: new Date("2026-11-13"), ultimaEtapaAlcanzada: 1 }), AHORA);
    expect(r).toMatchObject({ etapaEsperada: 3, etapaInformada: 1, etapaDesfasada: true, alertas: [] });
  });

  it("en curso al día: no está desfasada; después del último día queda en la última etapa", () => {
    expect(resumirSalida(listada({ estado: "EN_CURSO", fechaInicio: new Date("2026-11-13"), ultimaEtapaAlcanzada: 3 }), AHORA).etapaDesfasada).toBe(false);
    expect(resumirSalida(listada({ estado: "EN_CURSO", fechaInicio: new Date("2026-11-01"), ultimaEtapaAlcanzada: 4 }), AHORA).etapaEsperada).toBe(4);
  });

  it("recién iniciada: caminando la etapa 1 sin informar ninguna no está desfasada", () => {
    const r = resumirSalida(listada({ estado: "EN_CURSO", fechaInicio: new Date("2026-11-15"), ultimaEtapaAlcanzada: null }), AHORA);
    expect(r).toMatchObject({ etapaEsperada: 1, etapaInformada: null, etapaDesfasada: false });
  });

  it("si no está en curso no calcula etapa esperada", () => {
    expect(resumirSalida(listada(), AHORA)).toMatchObject({ etapaEsperada: null, etapaDesfasada: false });
  });

  it("SIN_INICIAR: llegó el día de inicio y el guía no la inició; el día antes, no", () => {
    expect(resumirSalida(listada({ estado: "CERRADA", fechaInicio: new Date("2026-11-15") }), AHORA).alertas).toContain("SIN_INICIAR");
    expect(resumirSalida(listada({ estado: "CERRADA", fechaInicio: new Date("2026-11-16") }), AHORA).alertas).not.toContain("SIN_INICIAR");
  });

  it("SIN_AVANCES: iniciada hace más de 12 horas sin ningún avance", () => {
    const enCurso = { estado: "EN_CURSO", fechaInicio: new Date("2026-11-14") };
    expect(resumirSalida(listada({ ...enCurso, fechaHoraInicioReal: new Date("2026-11-14T23:00:00Z") }), AHORA).alertas).toEqual(["SIN_AVANCES"]);
    expect(resumirSalida(listada({ ...enCurso, fechaHoraInicioReal: new Date("2026-11-15T01:00:00Z") }), AHORA).alertas).toEqual([]);
    const conAvance = resumirSalida(
      listada({ ...enCurso, fechaHoraInicioReal: new Date("2026-11-14T08:00:00Z"), avances: [{ fechaHoraLlegada: new Date("2026-11-14T15:00:00Z") }] }),
      AHORA
    );
    expect(conAvance).toMatchObject({ alertas: [], primerAvance: new Date("2026-11-14T15:00:00Z") });
  });

  it("B4: venta abierta hasta fechaInicio − diasCierreVenta − 1", () => {
    // AHORA es 15/11 (hora local); inicio 20/11 con corte 2 → último día 17/11
    expect(resumirSalida(listada(), AHORA)).toMatchObject({ diasCierreVenta: 2, ultimoDiaVenta: "2026-11-17", ventaAbierta: true });
    expect(resumirSalida(listada({ diasCierreVenta: 5 }), AHORA)).toMatchObject({ ultimoDiaVenta: "2026-11-14", ventaAbierta: false });
    expect(resumirSalida(listada({ estado: "CERRADA" }), AHORA).ventaAbierta).toBe(false);
  });

  it("servicios con la forma de SalidaServicio, desde Ocupacion: el hotel una vez aunque ocupe dos tramos", () => {
    const ocupacion = (idservicio: number, tipo: string, comprobanteReserva: string | null = null) =>
      ({ idsalida: 1, idservicio, tipo, comprobanteReserva, servicio: { nombreServicio: `S${idservicio}` } });
    const r = resumirSalida(listada({ ocupaciones: [ocupacion(4, "ALOJAMIENTO"), ocupacion(4, "ALOJAMIENTO"), ocupacion(5, "TRANSPORTE", "C-1")] }), AHORA);
    expect(r.servicios).toEqual([
      { idsalida: 1, idservicio: 4, tipo: "ALOJAMIENTO", comprobanteReserva: null, servicio: { nombreServicio: "S4" } },
      { idsalida: 1, idservicio: 5, tipo: "TRANSPORTE", comprobanteReserva: "C-1", servicio: { nombreServicio: "S5" } },
    ]);
    expect(r).not.toHaveProperty("ocupaciones");
  });

  it("SIN_FINALIZAR: sigue en curso pasado el día siguiente a su fin", () => {
    const enCurso = { estado: "EN_CURSO", fechaInicio: new Date("2026-11-10"), fechaHoraInicioReal: new Date("2026-11-10T08:00:00Z"), avances: [{ fechaHoraLlegada: new Date("2026-11-10T12:00:00Z") }] };
    expect(resumirSalida(listada({ ...enCurso, fechaFin: new Date("2026-11-13") }), AHORA).alertas).toEqual(["SIN_FINALIZAR"]);
    expect(resumirSalida(listada({ ...enCurso, fechaFin: new Date("2026-11-14") }), AHORA).alertas).toEqual([]);
  });

  const guia = (extra: Record<string, unknown> = {}) => ({
    personal: {
      idpersonal: 1, nombreCompleto: "Rosa", rol: "Guía", estado: "ACTIVO", fechaVencimientoPasaporte: new Date("2030-01-01"),
      guia: { fechaHabilitacion: new Date("2027-01-01"), usuario: { estado: "ACTIVO" } }, ...extra,
    },
  });

  it("12.3: PERSONAL_NO_APTO apenas vence una habilitación, con el detalle en avisos", () => {
    const vencida = guia({ guia: { fechaHabilitacion: new Date("2026-11-21"), usuario: { estado: "ACTIVO" } } });
    expect(resumirSalida(listada({ personalAsignado: [guia()] }), AHORA).alertas).not.toContain("PERSONAL_NO_APTO");
    expect(resumirSalida(listada({ personalAsignado: [vencida] }), AHORA)).toMatchObject({
      alertas: expect.arrayContaining(["PERSONAL_NO_APTO"]),
      avisos: [{ alerta: "PERSONAL_NO_APTO", mensaje: "Rosa: la habilitación vence el 21/11/2026" }],
    });
  });

  it("B4: PENDIENTE_CONFIRMAR y puedeConfirmar después del corte, mientras siga PUBLICADA", () => {
    const cerro = resumirSalida(listada({ diasCierreVenta: 5 }), AHORA);
    expect(cerro).toMatchObject({ puedeConfirmar: true, alertas: expect.arrayContaining(["PENDIENTE_CONFIRMAR"]) });
    expect(cerro.avisos[0]!.mensaje).toBe("La venta cerró el 14/11/2026: falta confirmar la salida");
    expect(resumirSalida(listada(), AHORA).puedeConfirmar).toBe(false);
    expect(resumirSalida(listada({ diasCierreVenta: 5, estado: "CERRADA" }), AHORA).alertas).not.toContain("PENDIENTE_CONFIRMAR");
  });

  it("FALTA_RECURSO sin transporte o si no alcanza para pasajeros y personal; RIESGO_STOCK si faltaría vendida completa", () => {
    expect(resumirSalida(listada({ ocupaciones: [] }), AHORA).avisos).toEqual([{ alerta: "FALTA_RECURSO", mensaje: "Falta el transporte" }]);
    const chico = [{ idsalida: 1, idservicio: 5, tipo: "TRANSPORTE", comprobanteReserva: null, servicio: { nombreServicio: "Van", transporte: { capacidadVehiculo: 8 } } }];
    expect(resumirSalida(listada({ ocupaciones: chico, personalAsignado: [guia()] }), AHORA).avisos).toEqual([
      { alerta: "FALTA_RECURSO", mensaje: "El transporte Van tiene 8 asientos y la salida necesita 9 lugares" },
    ]);

    // 1 carpa cada 2: vendidos 3 → 2 ocupadas de 3; completa (8) necesitaría 4
    const definicionPaquete = { servicios: [{ idservicio: 7, nombreServicio: "Carpa", tipo: "EQUIPAMIENTO", cantidad: 1, cadaPasajeros: 2 }] };
    const fila = { idsalida: 1, idservicio: 7, desde: new Date("2026-11-20"), hasta: new Date("2026-11-25"), cantidad: 2, proyectada: 4 };
    const r = resumirSalida(listada({ definicionPaquete }), AHORA, { totales: new Map([[7, 3]]), filas: [fila] });
    expect(r.avisos).toEqual([{ alerta: "RIESGO_STOCK", mensaje: "Si se vende completa faltarían hasta 1 de Carpa el 20/11/2026" }]);
    const otra = { ...fila, idsalida: 2, cantidad: 2, proyectada: 2 };
    const falta = resumirSalida(listada({ definicionPaquete }), AHORA, { totales: new Map([[7, 3]]), filas: [fila, otra] });
    expect(falta.avisos).toContainEqual({ alerta: "FALTA_RECURSO", mensaje: "Faltan 1 de Carpa el 20/11/2026" });
  });
});
