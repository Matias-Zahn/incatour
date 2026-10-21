import { describe, it, expect, vi, beforeEach } from "vitest";
import { CancelacionSalidaService } from "./cancelacion-salida.service";

// vi.mock se ejecuta antes que los imports: lo que usan los mocks se declara con vi.hoisted
const { repo, autoridad, notificador } = vi.hoisted(() => ({
  repo: { findParaCancelar: vi.fn(), ejecutarCancelacion: vi.fn(), findAlternativas: vi.fn(), limpiarBloqueo: vi.fn() },
  autoridad: { liberarTotalidadCupos: vi.fn() },
  notificador: { enviarEmailCancelacionSalida: vi.fn() },
}));
vi.mock("./cancelacion-salida.repository", () => ({
  CancelacionSalidaRepository: class {
    constructor() {
      return repo;
    }
  },
}));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => autoridad }));
vi.mock("../../../integraciones/notificador/notificador.mock", () => ({
  NotificadorMock: class {
    constructor() {
      return notificador;
    }
  },
}));

const usuario = { idusuario: 1, email: "admin@mail.com" } as never;
const dto = { motivo: "Clima adverso" } as never;
const salida = (extra = {}) => ({
  idsalida: 5,
  nroSalida: "SAL-5",
  estado: "PUBLICADA",
  fechaInicio: new Date(Date.now() + 30 * 86400000),
  idbloqueo: "BLQ-1",
  idpaquete: 1,
  paquete: { nombrePaquete: "Inca Clásico" },
  reservas: [],
  permisos: [],
  personalAsignado: [],
  equipamientos: [],
  servicios: [],
  ...extra,
});

describe("CancelacionSalidaService.confirmarCancelacion (CU-37)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findParaCancelar.mockResolvedValue(salida());
    repo.ejecutarCancelacion.mockResolvedValue({
      reservas: [{ email: "ana@mail.com", montoReembolsado: 100, cantidadPasajeros: 2 }],
      reembolsoTotal: 100,
    });
    repo.findAlternativas.mockResolvedValue([]);
    notificador.enviarEmailCancelacionSalida.mockResolvedValue(true);
    autoridad.liberarTotalidadCupos.mockResolvedValue(undefined);
  });

  it("si la base falla, no libera los cupos de la autoridad", async () => {
    repo.ejecutarCancelacion.mockRejectedValue(new Error("fallo de la base"));

    await expect(new CancelacionSalidaService().confirmarCancelacion(5, dto, usuario)).rejects.toThrow("fallo de la base");
    expect(autoridad.liberarTotalidadCupos).not.toHaveBeenCalled();
  });

  it("libera los cupos después del commit y limpia el bloqueo", async () => {
    await new CancelacionSalidaService().confirmarCancelacion(5, dto, usuario);

    expect(repo.ejecutarCancelacion.mock.invocationCallOrder[0]).toBeLessThan(
      autoridad.liberarTotalidadCupos.mock.invocationCallOrder[0]!
    );
    expect(repo.limpiarBloqueo).toHaveBeenCalledWith(5, "BLQ-1");
  });

  it("si la autoridad falla responde 503 y reintentar solo libera", async () => {
    autoridad.liberarTotalidadCupos.mockRejectedValueOnce(new Error("caída"));
    const service = new CancelacionSalidaService();

    await expect(service.confirmarCancelacion(5, dto, usuario)).rejects.toMatchObject({ statusCode: 503 });
    expect(notificador.enviarEmailCancelacionSalida).toHaveBeenCalled();

    repo.findParaCancelar.mockResolvedValue(salida({ estado: "CANCELADA" }));
    const r = await service.confirmarCancelacion(5, dto, usuario);

    expect(r.estado).toBe("CANCELADA");
    expect(repo.limpiarBloqueo).toHaveBeenCalledWith(5, "BLQ-1");
    expect(repo.ejecutarCancelacion).toHaveBeenCalledTimes(1);
  });

  it("CANCELADA sin bloqueo pendiente: 400 ya cancelada", async () => {
    repo.findParaCancelar.mockResolvedValue(salida({ estado: "CANCELADA", idbloqueo: null }));

    await expect(new CancelacionSalidaService().confirmarCancelacion(5, dto, usuario)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("ya se encuentra cancelada"),
    });
  });
});
