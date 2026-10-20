import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuiaService } from "./guia.service";
import { RegistrarAvanceDto, RegistrarIncidenteDto } from "./guia.dto";

const { repo } = vi.hoisted(() => ({
  repo: { idPersonalDelUsuario: vi.fn(), salidasAsignadas: vi.fn(), detalleSalida: vi.fn(), registrarAvance: vi.fn(), registrarIncidente: vi.fn() },
}));
vi.mock("./guia.repository", () => ({ GuiaRepository: class { constructor() { return repo; } } }));

const salida = {
  idsalida: 2, nroSalida: "SAL-2026-002", estado: "CERRADA", fechaInicio: new Date(), fechaFin: new Date(),
  paquete: { nombrePaquete: "Inca", circuito: { nombreCircuito: "Camino", duracionDias: 4, etapas: [] } },
  avances: [], servicios: [], equipamientos: [], reservas: [],
  personalAsignado: [{ idpersonal: 7, personal: { idpersonal: 7, nombreCompleto: "Rosa", rol: "Guía" } }],
};

describe("GuiaService.consultarDetalleSalida (CU-48)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.detalleSalida.mockResolvedValue(salida);
  });

  it("el guía asignado ve el detalle de su salida", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(7);

    const r = await new GuiaService().consultarDetalleSalida(1, 2);

    expect(r.salida.nroSalida).toBe("SAL-2026-002");
  });

  it("un guía no asignado recibe 403", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(8);

    await expect(new GuiaService().consultarDetalleSalida(1, 2)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("una cuenta sin legajo de guía recibe 403", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(null);

    await expect(new GuiaService().consultarDetalleSalida(1, 2)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("GuiaService.registrarAvance (CU-49)", () => {
  const etapas = [1, 2, 3].map((n) => ({ idcircuito: 5, numeroOrden: n }));
  const enRecorrido = (extra = {}) => ({
    ...salida,
    estado: "CERRADA",
    fechaInicio: new Date("2026-01-10"),
    ultimaEtapaAlcanzada: null,
    paquete: { ...salida.paquete, circuito: { ...salida.paquete.circuito, etapas } },
    ...extra,
  });
  const avance = (numeroOrden: number, estadoTramo = "COMPLETADO", fechaHoraLlegada = "2026-01-11T15:00:00Z") =>
    RegistrarAvanceDto.create({ numeroOrden, estadoTramo, fechaHoraLlegada })[1]!;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.idPersonalDelUsuario.mockResolvedValue(7);
    repo.registrarAvance.mockImplementation(async (p) => p);
  });

  it("el primer avance pone la salida EN_CURSO y guarda la última etapa", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido());

    const r = await new GuiaService().registrarAvance(1, 2, avance(1));

    expect(r).toMatchObject({ idcircuito: 5, numeroOrden: 1, estadoSalida: "EN_CURSO", ultimaEtapaAlcanzada: 1 });
  });

  it("pasa al repositorio la etapa leída y rechaza con 409 si otro avance se coló (CTA-06)", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido());
    repo.registrarAvance.mockResolvedValue(null);

    await expect(new GuiaService().registrarAvance(1, 2, avance(1))).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.registrarAvance).toHaveBeenCalledWith(expect.objectContaining({ ultimaEtapaLeida: null }));
  });

  it("completar la última etapa finaliza la salida", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido({ estado: "EN_CURSO", ultimaEtapaAlcanzada: 2 }));

    const r = await new GuiaService().registrarAvance(1, 2, avance(3));

    expect(r).toMatchObject({ estadoSalida: "FINALIZADA", ultimaEtapaAlcanzada: 3 });
  });

  it("un tramo DEMORADO no avanza la última etapa", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido({ estado: "EN_CURSO", ultimaEtapaAlcanzada: 1 }));

    const r = await new GuiaService().registrarAvance(1, 2, avance(2, "DEMORADO"));

    expect(r).toMatchObject({ estadoSalida: "EN_CURSO", ultimaEtapaAlcanzada: 1 });
  });

  it("rechaza saltear etapas, repetir una completada o una etapa de otro circuito", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido({ estado: "EN_CURSO", ultimaEtapaAlcanzada: 1 }));
    const servicio = new GuiaService();

    await expect(servicio.registrarAvance(1, 2, avance(3))).rejects.toThrow("Antes hay que informar la etapa 2");
    await expect(servicio.registrarAvance(1, 2, avance(1))).rejects.toThrow("ya se informó");
    await expect(servicio.registrarAvance(1, 2, avance(9))).rejects.toThrow("no pertenece al circuito");
  });

  it("rechaza una llegada futura o anterior al inicio de la salida", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido());
    const servicio = new GuiaService();

    await expect(servicio.registrarAvance(1, 2, avance(1, "COMPLETADO", "2099-01-01T10:00:00Z"))).rejects.toThrow("futura");
    await expect(servicio.registrarAvance(1, 2, avance(1, "COMPLETADO", "2025-12-31T10:00:00Z"))).rejects.toThrow("anterior al inicio");
  });

  it("no registra avances en una salida cancelada", async () => {
    repo.detalleSalida.mockResolvedValue(enRecorrido({ estado: "CANCELADA" }));

    await expect(new GuiaService().registrarAvance(1, 2, avance(1))).rejects.toThrow("CANCELADA");
  });
});

describe("GuiaService.registrarIncidente (CU-50)", () => {
  const conPasajeros = (estado = "EN_CURSO") => ({
    ...salida,
    estado,
    fechaInicio: new Date("2026-01-10"),
    reservas: [{ pasajeros: [{ idpasajero: 2, pasajero: { idpasajero: 2 } }, { idpasajero: 3, pasajero: { idpasajero: 3 } }] }],
  });
  const incidente = (extra = {}) =>
    RegistrarIncidenteDto.create({
      tipoIncidente: "SALUD",
      descripcion: "Pasajero con mal de altura",
      nivelGravedad: "MEDIO",
      fechaHoraOcurrencia: "2026-01-11T10:00:00Z",
      ...extra,
    })[1]!;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.idPersonalDelUsuario.mockResolvedValue(7);
    repo.detalleSalida.mockResolvedValue(conPasajeros());
    repo.registrarIncidente.mockImplementation(async (p) => p);
  });

  it("registra el incidente con los pasajeros afectados (FA1)", async () => {
    const r = await new GuiaService().registrarIncidente(1, 2, incidente({ pasajerosAfectados: [3] }));

    expect(r).toMatchObject({ idsalida: 2, tipoIncidente: "SALUD", nivelGravedad: "MEDIO", pasajerosAfectados: [3] });
  });

  it("rechaza pasajeros que no viajan en la salida", async () => {
    await expect(new GuiaService().registrarIncidente(1, 2, incidente({ pasajerosAfectados: [2, 99] }))).rejects.toThrow("99");
  });

  it("rechaza una fecha futura y una salida no activa", async () => {
    await expect(new GuiaService().registrarIncidente(1, 2, incidente({ fechaHoraOcurrencia: "2099-01-01T00:00:00Z" }))).rejects.toThrow("futura");

    repo.detalleSalida.mockResolvedValue(conPasajeros("FINALIZADA"));
    await expect(new GuiaService().registrarIncidente(1, 2, incidente())).rejects.toThrow("FINALIZADA");
  });

  it("el DTO exige tipo, descripción y gravedad válidos", () => {
    const crear = (extra: object) =>
      RegistrarIncidenteDto.create({ tipoIncidente: "SALUD", descripcion: "Algo pasó", nivelGravedad: "BAJO", fechaHoraOcurrencia: "2026-01-11T10:00:00Z", ...extra })[0];

    expect(crear({ tipoIncidente: "TERREMOTO" })).toMatch("tipoIncidente");
    expect(crear({ descripcion: "" })).toMatch("descripción");
    expect(crear({ nivelGravedad: "ALTO" })).toMatch("nivelGravedad");
    expect(crear({ pasajerosAfectados: [2, 2] })).toMatch("sin repetir");
  });
});
