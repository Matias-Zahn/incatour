import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicioService } from "./servicio.service";
import { ModificarServicioDto } from "./servicio.dto";

const { repo } = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(), contarSolicitudesPendientes: vi.fn(), contarSalidasActivas: vi.fn(),
    contarGarantiasDePaquetesActivos: vi.fn(), contarPaquetesActivosQueLoIncluyen: vi.fn(), updateEstado: vi.fn(),
    existeNombre: vi.fn(), maxPasajerosConfirmadosEnSalidasActivas: vi.fn(), updateEnSitio: vi.fn(),
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
  const hotel = { idservicio: 6, idproveedor: 1, estado: "ACTIVO", nombreServicio: "Hotel", localidad: "Cusco", alojamiento: { idservicio: 6, categoria: "3 estrellas", tipoHabitacion: "Doble", modalidadConfirmacion: "BLOQUEO_PLAZAS", capacidadDisponible: 30 } };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.contarSalidasActivas.mockResolvedValue(1);
    repo.contarGarantiasDePaquetesActivos.mockResolvedValue(0);
    repo.maxPasajerosConfirmadosEnSalidasActivas.mockResolvedValue(30);
    repo.updateEnSitio.mockImplementation(async () => repo.findById.mock.results[0]!.value);
  });

  it("edita siempre en el lugar, sin versionar", async () => {
    repo.findById.mockResolvedValue(transporte);

    const r = await new ServicioService().modificarServicio(5, dto({ capacidadVehiculo: 50 }));

    expect(repo.updateEnSitio).toHaveBeenCalledWith(5, "TRANSPORTE", {}, { capacidadVehiculo: 50 });
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

    expect(repo.updateEnSitio).toHaveBeenCalledWith(6, "ALOJAMIENTO", { nombreServicio: "Hotel Sol" }, { capacidadDisponible: 25 });
  });

  it("un alojamiento sin salidas activas puede cambiar su categoría", async () => {
    repo.findById.mockResolvedValue(hotel);
    repo.contarSalidasActivas.mockResolvedValue(0);

    await new ServicioService().modificarServicio(6, dto({ categoria: "5 estrellas" }));

    expect(repo.updateEnSitio).toHaveBeenCalled();
  });
});
