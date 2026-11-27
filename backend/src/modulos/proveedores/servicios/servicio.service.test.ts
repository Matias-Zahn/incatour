import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicioService } from "./servicio.service";
import { ModificarServicioDto } from "./servicio.dto";
import { hoyUTC } from "../../../shared/fechas";

const { repo } = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(), contarSolicitudesPendientes: vi.fn(), contarSalidasActivas: vi.fn(),
    contarGarantiasDePaquetesActivos: vi.fn(), contarPaquetesActivosQueLoIncluyen: vi.fn(), updateEstado: vi.fn(),
    existeNombre: vi.fn(), maxPasajerosConfirmadosEnSalidasActivas: vi.fn(), updateEnSitio: vi.fn(), ocupacionesDesdeHoy: vi.fn(),
    historialOcupacion: vi.fn(),
  },
}));
vi.mock("./servicio.repository", () => ({ ServicioRepository: class { constructor() { return repo; } } }));

describe("ServicioService.darDeBaja (CU-21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue({ idservicio: 5, estado: "ACTIVO" });
    repo.contarSolicitudesPendientes.mockResolvedValue(0);
    repo.contarSalidasActivas.mockResolvedValue(0);
    repo.contarGarantiasDePaquetesActivos.mockResolvedValue(0);
    repo.contarPaquetesActivosQueLoIncluyen.mockResolvedValue(0);
  });

  it("CAT-09: rechaza la baja si el servicio está incluido en paquetes activos", async () => {
    repo.contarPaquetesActivosQueLoIncluyen.mockResolvedValue(2);

    await expect(new ServicioService().darDeBaja(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.updateEstado).not.toHaveBeenCalled();
  });
});

describe("ServicioService.modificarServicio (CU-20, CAT-31/32/33)", () => {
  const dto = (obj: Record<string, unknown>) => ModificarServicioDto.create(obj)[1]!;
  const transporte = { idservicio: 5, idproveedor: 1, estado: "ACTIVO", nombreServicio: "Bus", localidad: "Cusco", transporte: { idservicio: 5, capacidadVehiculo: 40 } };
  const hotel = { idservicio: 6, idproveedor: 1, estado: "ACTIVO", nombreServicio: "Hotel", localidad: "Cusco", alojamiento: { idservicio: 6, categoria: "3 estrellas", tipoHabitacion: "Doble", modalidadConfirmacion: "BLOQUEO_PLAZAS", plazasTotales: 30 } };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.contarSalidasActivas.mockResolvedValue(1);
    repo.contarGarantiasDePaquetesActivos.mockResolvedValue(0);
    repo.maxPasajerosConfirmadosEnSalidasActivas.mockResolvedValue(30);
    repo.updateEnSitio.mockImplementation(async (_id: number, _t: string, _b: object, _e: object, controlarTotal?: (o: unknown) => void) => {
      controlarTotal?.(await repo.ocupacionesDesdeHoy());
      return repo.findById.mock.results[0]!.value;
    });
    repo.ocupacionesDesdeHoy.mockResolvedValue([]);
  });

  it("edita siempre en el lugar, sin versionar", async () => {
    repo.findById.mockResolvedValue(transporte);

    const r = await new ServicioService().modificarServicio(5, dto({ capacidadVehiculo: 50 }));

    expect(repo.updateEnSitio).toHaveBeenCalledWith(5, "TRANSPORTE", {}, { capacidadVehiculo: 50 }, undefined);
    expect(r).not.toHaveProperty("versionado");
  });

  it("CAT-33: rechaza bajar la capacidad del vehículo por debajo de los pasajeros confirmados", async () => {
    repo.findById.mockResolvedValue(transporte);

    await expect(new ServicioService().modificarServicio(5, dto({ capacidadVehiculo: 20 }))).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.updateEnSitio).not.toHaveBeenCalled();
  });

  it("CAT-33: acepta una capacidad igual a los pasajeros confirmados", async () => {
    repo.findById.mockResolvedValue(transporte);

    await new ServicioService().modificarServicio(5, dto({ capacidadVehiculo: 30 }));

    expect(repo.updateEnSitio).toHaveBeenCalled();
  });

  it("CAT-31: rechaza cambiar la categoría de un alojamiento en salidas activas", async () => {
    repo.findById.mockResolvedValue(hotel);

    await expect(new ServicioService().modificarServicio(6, dto({ categoria: "5 estrellas" }))).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.updateEnSitio).not.toHaveBeenCalled();
  });

  it("CAT-31: rechaza cambiar la localidad o la modalidad de un alojamiento en salidas activas", async () => {
    repo.findById.mockResolvedValue(hotel);

    await expect(new ServicioService().modificarServicio(6, dto({ localidad: "Lima" }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(new ServicioService().modificarServicio(6, dto({ modalidadConfirmacion: "A_SOLICITUD" }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("CAT-31: nombre, costo y capacidad de un alojamiento en salidas activas se editan en el lugar", async () => {
    repo.findById.mockResolvedValue(hotel);

    await new ServicioService().modificarServicio(6, dto({ nombreServicio: "Hotel Sol", capacidadDisponible: 25 }));

    expect(repo.updateEnSitio).toHaveBeenCalledWith(6, "ALOJAMIENTO", { nombreServicio: "Hotel Sol" }, { capacidadDisponible: 25 }, expect.any(Function));
  });

  it("A1: rechaza bajar el total del equipo por debajo del día más comprometido y avisa la fecha", async () => {
    const carpas = { idservicio: 7, idproveedor: 1, estado: "ACTIVO", nombreServicio: "Carpas", localidad: "Cusco", equipamiento: { idservicio: 7, tipoEquipamiento: "Carpa", cantidadTotal: 30 } };
    repo.findById.mockResolvedValue(carpas);
    const dia = (n: number) => new Date(hoyUTC().getTime() + n * 24 * 60 * 60 * 1000);
    // Dos salidas que se tocan un día: 18 + 10 = 28 ese día
    repo.ocupacionesDesdeHoy.mockResolvedValue([
      { idservicio: 7, desde: dia(5), hasta: dia(10), cantidad: 18 },
      { idservicio: 7, desde: dia(10), hasta: dia(14), cantidad: 10 },
    ]);
    const fecha = dia(10).toISOString();

    await expect(new ServicioService().modificarServicio(7, dto({ inventarioTotal: 27 }))).rejects.toThrow(
      `Hay 28 unidades comprometidas el ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
    );
    await new ServicioService().modificarServicio(7, dto({ inventarioTotal: 28 }));
    expect(repo.updateEnSitio).toHaveBeenCalledWith(7, "EQUIPAMIENTO", {}, { inventarioTotal: 28 }, expect.any(Function));
  });

  it("bloque 8: un hotel a solicitud sin plazas no puede pasar a bloqueo sin indicarlas", async () => {
    repo.findById.mockResolvedValue({ ...hotel, alojamiento: { ...hotel.alojamiento, modalidadConfirmacion: "A_SOLICITUD", plazasTotales: null } });
    repo.contarSalidasActivas.mockResolvedValue(0);

    await expect(new ServicioService().modificarServicio(6, dto({ modalidadConfirmacion: "BLOQUEO_PLAZAS" }))).rejects.toThrow("necesita la capacidad");
    await new ServicioService().modificarServicio(6, dto({ modalidadConfirmacion: "BLOQUEO_PLAZAS", capacidadDisponible: 12 }));
    expect(repo.updateEnSitio).toHaveBeenCalledOnce();
  });

  it("un alojamiento sin salidas activas puede cambiar su categoría", async () => {
    repo.findById.mockResolvedValue(hotel);
    repo.contarSalidasActivas.mockResolvedValue(0);

    await new ServicioService().modificarServicio(6, dto({ categoria: "5 estrellas" }));

    expect(repo.updateEnSitio).toHaveBeenCalled();
  });

  it("bloque 8: al pasar un alojamiento a solicitud se limpian sus plazas fijas (null)", async () => {
    repo.findById.mockResolvedValue(hotel);
    repo.contarSalidasActivas.mockResolvedValue(0);

    await new ServicioService().modificarServicio(6, dto({ modalidadConfirmacion: "A_SOLICITUD" }));

    expect(repo.updateEnSitio).toHaveBeenCalledWith(
      6,
      "ALOJAMIENTO",
      {},
      { modalidadConfirmacion: "A_SOLICITUD", capacidadDisponible: null },
      undefined
    );
  });

  it("bloque 8: consultarOcupacion de un alojamiento a solicitud devuelve total y disponible en null", async () => {
    repo.findById.mockResolvedValue({
      ...hotel,
      alojamiento: { ...hotel.alojamiento, modalidadConfirmacion: "A_SOLICITUD", plazasTotales: null },
    });
    repo.historialOcupacion.mockResolvedValue([]);
    const desde = new Date("2026-12-01T00:00:00.000Z");
    const hasta = new Date("2026-12-02T00:00:00.000Z");

    const r = await new ServicioService().consultarOcupacion(6, { desde, hasta });

    expect(r.total).toBeNull();
    expect(r.dias).toEqual([
      { fecha: "2026-12-01", ocupado: 0, disponible: null },
      { fecha: "2026-12-02", ocupado: 0, disponible: null },
    ]);
  });
});
