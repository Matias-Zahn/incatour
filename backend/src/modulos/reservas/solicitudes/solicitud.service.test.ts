import { describe, it, expect, vi, beforeEach } from "vitest";
import { SolicitudService } from "./solicitud.service";
import { ResolverSolicitudDto } from "./solicitud.dto";

const { repo } = vi.hoisted(() => ({
  repo: {
    findAllPendientes: vi.fn(),
    buscarPorId: vi.fn(),
    buscarServiciosCompatiblesExcluyendoRechazados: vi.fn(),
    resolverComoRechazada: vi.fn(),
    resolverComoAceptada: vi.fn(),
    contarPendientesPorSalida: vi.fn(),
  },
}));
vi.mock("./solicitud.repository", () => ({ SolicitudRepository: class { constructor() { return repo; } } }));

const solicitud = (over: Record<string, unknown> = {}, paquete: Record<string, unknown> = {}) => ({
  idsolicitud: 5,
  idreserva: 20,
  estado: "PENDIENTE",
  cantidadPlazas: 2,
  reserva: {
    solicitudes: [] as { gestiones: { resultado: string; idservicio: number }[] }[],
    nroReserva: "RES-1",
    idsalida: 7,
    cliente: { nroCliente: "CLI-9" },
    salida: {
      paquete: { categoriaGarantizada: "3 estrellas", localidadGarantizada: "Cusco", tipoHabitacionGarantizada: "Doble", ...paquete },
    },
  },
  ...over,
});

const hotel = (id: number) => ({ idservicio: id, nombreServicio: `Hotel ${id}`, proveedor: { razonSocial: `Proveedor ${id}` } });
const dto = (obj: Record<string, unknown>) => ResolverSolicitudDto.create(obj)[1]!;

describe("SolicitudService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    repo.buscarPorId.mockResolvedValue(solicitud());
  });

  describe("consultarPendientes (CU-33)", () => {
    it("devuelve las solicitudes pendientes del repositorio", async () => {
      repo.findAllPendientes.mockResolvedValue([{ idsolicitud: 1 }, { idsolicitud: 2 }]);

      await expect(new SolicitudService().consultarPendientes()).resolves.toHaveLength(2);
    });
  });

  describe("buscarServiciosCompatibles (CU-34, fase 1)", () => {
    it("busca hoteles con los criterios garantizados del paquete y arma las opciones de contacto", async () => {
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([hotel(40), hotel(41)]);

      const r = await new SolicitudService().buscarServiciosCompatibles(5);

      expect(repo.buscarServiciosCompatiblesExcluyendoRechazados).toHaveBeenCalledWith("Doble", "3 estrellas", "Cusco", []);
      expect(r).toMatchObject({ solicitudId: 5, reserva: "RES-1", cliente: "CLI-9" });
      expect(r.opcionesContacto).toEqual([
        { servicioId: 40, hotel: "Hotel 40", proveedor: "Proveedor 40", canalContacto: "Por fuera del sistema" },
        { servicioId: 41, hotel: "Hotel 41", proveedor: "Proveedor 41", canalContacto: "Por fuera del sistema" },
      ]);
    });

    it("excluye los hoteles que ya rechazaron, también en solicitudes anteriores de la reserva (-R)", async () => {
      const s = solicitud();
      s.reserva.solicitudes = [
        { gestiones: [{ resultado: "Rechazada", idservicio: 40 }] }, // la original
        { gestiones: [{ resultado: "Rechazada", idservicio: 43 }, { resultado: "Aceptada", idservicio: 41 }] }, // el reintento
      ];
      repo.buscarPorId.mockResolvedValue(s);
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([hotel(42)]);

      await new SolicitudService().buscarServiciosCompatibles(5);

      expect(repo.buscarServiciosCompatiblesExcluyendoRechazados).toHaveBeenCalledWith("Doble", "3 estrellas", "Cusco", [40, 43]);
    });

    it("404 si la solicitud no existe", async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(new SolicitudService().buscarServiciosCompatibles(5)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza una solicitud que no está pendiente", async () => {
      repo.buscarPorId.mockResolvedValue(solicitud({ estado: "CONFIRMADA" }));

      await expect(new SolicitudService().buscarServiciosCompatibles(5)).rejects.toThrow("no está PENDIENTE");
    });

    it("rechaza si el paquete no garantiza los criterios de alojamiento", async () => {
      repo.buscarPorId.mockResolvedValue(solicitud({}, { localidadGarantizada: null }));

      await expect(new SolicitudService().buscarServiciosCompatibles(5)).rejects.toThrow("no garantiza");
      expect(repo.buscarServiciosCompatiblesExcluyendoRechazados).not.toHaveBeenCalled();
    });

    it("FA2: avisa que la salida no podrá consolidarse si no hay hoteles compatibles", async () => {
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([]);

      await expect(new SolicitudService().buscarServiciosCompatibles(5)).rejects.toThrow("no podrá consolidarse");
    });
  });

  describe("procesarResolucion (CU-34, fase 2)", () => {
    it("aceptada: confirma el alojamiento e informa cuántas pendientes quedan en la salida", async () => {
      repo.contarPendientesPorSalida.mockResolvedValue(3);

      const r = await new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }));

      expect(repo.resolverComoAceptada).toHaveBeenCalledWith(5, 20, 40);
      expect(repo.contarPendientesPorSalida).toHaveBeenCalledWith(7);
      expect(repo.resolverComoRechazada).not.toHaveBeenCalled();
      expect(r).toEqual({ mensaje: "Solicitud Confirmada exitosamente.", solicitudesPendientesRestantesEnSalida: 3 });
    });

    it("FA1 rechazada: registra el rechazo con su motivo y devuelve la nueva solicitud pendiente", async () => {
      repo.resolverComoRechazada.mockResolvedValue({ idsolicitud: 6 });

      const r = await new SolicitudService().procesarResolucion(
        5,
        dto({ servicioId: 40, resolucion: "RECHAZADA", motivo: "Sin habitaciones dobles" })
      );

      expect(repo.resolverComoRechazada).toHaveBeenCalledWith(5, 20, 40, "Sin habitaciones dobles", 2);
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
      expect(r.nuevaSolicitudId).toBe(6);
    });

    it("rechaza resolver una solicitud inexistente", async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toThrow("inválida o ya resuelta");
    });

    it("no permite resolver dos veces la misma solicitud", async () => {
      repo.buscarPorId.mockResolvedValue(solicitud({ estado: "CONFIRMADA" }));

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toThrow("inválida o ya resuelta");
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
    });
  });
});
