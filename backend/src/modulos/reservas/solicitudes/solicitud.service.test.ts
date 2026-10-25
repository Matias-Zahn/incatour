import { describe, it, expect, vi, beforeEach } from "vitest";
import { SolicitudService } from "./solicitud.service";
import { ResolverSolicitudDto } from "./solicitud.dto";

const { repo, notificador } = vi.hoisted(() => ({
  repo: {
    findAllPendientes: vi.fn(),
    buscarPorId: vi.fn(),
    buscarServiciosCompatiblesExcluyendoRechazados: vi.fn(),
    resolverComoRechazada: vi.fn(),
    resolverComoAceptada: vi.fn(),
    contarPendientesPorSalida: vi.fn(),
    buscarServicio: vi.fn(),
  },
  notificador: { enviarEmailAlojamientoConfirmado: vi.fn() },
}));
vi.mock("./solicitud.repository", () => ({ SolicitudRepository: class { constructor() { return repo; } } }));
vi.mock("../../../integraciones/notificador/notificador.mock", () => ({ NotificadorMock: class { constructor() { return notificador; } } }));

const solicitud = (over: Record<string, unknown> = {}, paquete: Record<string, unknown> = {}) => ({
  idsolicitud: 5,
  idreserva: 20,
  estado: "PENDIENTE",
  cantidadPlazas: 2,
  reserva: {
    solicitudes: [] as { gestiones: { resultado: string; idservicio: number }[] }[],
    nroReserva: "RES-1",
    idsalida: 7,
    cliente: { nroCliente: "CLI-9", usuario: { email: "ana@mail.com" } },
    salida: {
      paquete: { categoriaGarantizada: "3 estrellas", localidadGarantizada: "Cusco", tipoHabitacionGarantizada: "Doble", ...paquete },
    },
  },
  ...over,
});

const hotel = (id: number, canalComunicacion = "WhatsApp") => ({
  idservicio: id,
  nombreServicio: `Hotel ${id}`,
  localidad: "Cusco",
  estado: "ACTIVO",
  alojamiento: { categoria: "3 estrellas", tipoHabitacion: "Doble" },
  proveedor: { razonSocial: `Proveedor ${id}`, canalComunicacion, datosContacto: `contacto${id}@hotel.com` },
});
const dto = (obj: Record<string, unknown>) => ResolverSolicitudDto.create(obj)[1]!;

describe("SolicitudService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    repo.buscarPorId.mockResolvedValue(solicitud());
    repo.buscarServicio.mockResolvedValue(hotel(40));
    notificador.enviarEmailAlojamientoConfirmado.mockResolvedValue(true);
  });

  describe("consultarPendientes (CU-33)", () => {
    it("devuelve las solicitudes pendientes del repositorio", async () => {
      repo.findAllPendientes.mockResolvedValue([{ idsolicitud: 1 }, { idsolicitud: 2 }]);

      await expect(new SolicitudService().consultarPendientes()).resolves.toHaveLength(2);
    });
  });

  describe("buscarServiciosCompatibles (CU-34, fase 1)", () => {
    it("busca hoteles con los criterios garantizados del paquete y arma las opciones de contacto", async () => {
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([
        hotel(40, "WhatsApp"),
        hotel(41, "Correo electrónico"),
      ]);

      const r = await new SolicitudService().buscarServiciosCompatibles(5);

      expect(repo.buscarServiciosCompatiblesExcluyendoRechazados).toHaveBeenCalledWith("Doble", "3 estrellas", "Cusco", []);
      expect(r).toMatchObject({ solicitudId: 5, reserva: "RES-1", cliente: "CLI-9" });
      expect(r.opcionesContacto).toEqual([
        { servicioId: 40, hotel: "Hotel 40", proveedor: "Proveedor 40", canalContacto: "WhatsApp" },
        { servicioId: 41, hotel: "Hotel 41", proveedor: "Proveedor 41", canalContacto: "Correo electrónico" },
      ]);
    });

    it("BE-04: usa datosContacto o 'Por fuera del sistema' si canalComunicacion está ausente", async () => {
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([
        {
          idservicio: 50,
          nombreServicio: "Hotel 50",
          localidad: "Cusco",
          estado: "ACTIVO",
          alojamiento: { categoria: "3 estrellas", tipoHabitacion: "Doble" },
          proveedor: { razonSocial: "Proveedor 50", canalComunicacion: null, datosContacto: "+51 84 123456" },
        },
        {
          idservicio: 51,
          nombreServicio: "Hotel 51",
          localidad: "Cusco",
          estado: "ACTIVO",
          alojamiento: { categoria: "3 estrellas", tipoHabitacion: "Doble" },
          proveedor: { razonSocial: "Proveedor 51", canalComunicacion: "", datosContacto: "" },
        },
      ]);

      const r = await new SolicitudService().buscarServiciosCompatibles(5);

      expect(r.opcionesContacto).toEqual([
        { servicioId: 50, hotel: "Hotel 50", proveedor: "Proveedor 50", canalContacto: "+51 84 123456" },
        { servicioId: 51, hotel: "Hotel 51", proveedor: "Proveedor 51", canalContacto: "Por fuera del sistema" },
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

    const porEstablecimiento = (rechazados: number[] = []) => {
      const sol = solicitud({}, { categoriaGarantizada: null, localidadGarantizada: null, tipoHabitacionGarantizada: null, garantiasEstablecimiento: [{ servicio: { idservicio: 40, nombreServicio: "Hotel 40", localidad: "Cusco", alojamiento: { categoria: "3 estrellas" } } }] });
      sol.reserva.solicitudes = [{ gestiones: rechazados.map((idservicio) => ({ resultado: "Rechazada", idservicio })) }];
      repo.buscarPorId.mockResolvedValue(sol);
    };

    it("RES-04: garantía por establecimiento devuelve como única opción el hotel garantizado", async () => {
      porEstablecimiento();
      const r = await new SolicitudService().buscarServiciosCompatibles(5);
      expect(repo.buscarServicio).toHaveBeenCalledWith(40);
      expect(repo.buscarServiciosCompatiblesExcluyendoRechazados).not.toHaveBeenCalled();
      expect(r.opcionesContacto).toEqual([{ servicioId: 40, hotel: "Hotel 40", proveedor: "Proveedor 40", canalContacto: "WhatsApp" }]);
    });

    it("RES-04: garantía por establecimiento con el hotel ya rechazado devuelve lista vacía", async () => {
      porEstablecimiento([40]);
      const r = await new SolicitudService().buscarServiciosCompatibles(5);
      expect(r.opcionesContacto).toEqual([]);
    });

    it("FA2: avisa que la salida no podrá consolidarse si no hay hoteles compatibles", async () => {
      repo.buscarServiciosCompatiblesExcluyendoRechazados.mockResolvedValue([]);

      await expect(new SolicitudService().buscarServiciosCompatibles(5)).rejects.toThrow("no podrá consolidarse");
    });
  });

  describe("procesarResolucion (CU-34, fase 2)", () => {
    const porEstablecimiento = () =>
      repo.buscarPorId.mockResolvedValue(
        solicitud({}, { categoriaGarantizada: null, localidadGarantizada: null, tipoHabitacionGarantizada: null, garantiasEstablecimiento: [{ servicio: { idservicio: 40, nombreServicio: "Hotel 40", localidad: "Cusco", alojamiento: { categoria: "3 estrellas" } } }] })
      );

    it("RES-04: garantía por establecimiento acepta el hotel garantizado", async () => {
      porEstablecimiento();
      repo.contarPendientesPorSalida.mockResolvedValue(0);
      await new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }));
      expect(repo.resolverComoAceptada).toHaveBeenCalledWith(5, 20, 40);
    });

    it("RES-04: garantía por establecimiento rechaza otro hotel aunque cumpla categoría y localidad", async () => {
      porEstablecimiento();
      repo.buscarServicio.mockResolvedValue(hotel(41));
      await expect(new SolicitudService().procesarResolucion(5, dto({ servicioId: 41, resolucion: "ACEPTADA" }))).rejects.toMatchObject({ statusCode: 400 });
    });

    it("aceptada: confirma el alojamiento e informa cuántas pendientes quedan en la salida", async () => {
      repo.contarPendientesPorSalida.mockResolvedValue(3);

      const r = await new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }));

      expect(repo.resolverComoAceptada).toHaveBeenCalledWith(5, 20, 40);
      expect(repo.contarPendientesPorSalida).toHaveBeenCalledWith(7);
      expect(repo.resolverComoRechazada).not.toHaveBeenCalled();
      expect(r).toEqual({ mensaje: "Solicitud Confirmada exitosamente.", solicitudesPendientesRestantesEnSalida: 3 });
    });

    it("aceptada: avisa al titular el establecimiento asignado", async () => {
      repo.contarPendientesPorSalida.mockResolvedValue(0);

      await new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }));

      await vi.waitFor(() =>
        expect(notificador.enviarEmailAlojamientoConfirmado).toHaveBeenCalledWith("ana@mail.com", "RES-1", "Hotel 40", "Cusco")
      );
    });

    it("aceptada: si el aviso falla, la aceptación sigue firme", async () => {
      repo.contarPendientesPorSalida.mockResolvedValue(0);
      vi.spyOn(console, "error").mockImplementation(() => {});
      notificador.enviarEmailAlojamientoConfirmado.mockImplementation(() => Promise.reject(new Error("smtp caído")));

      const r = await new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }));

      expect(r.mensaje).toBe("Solicitud Confirmada exitosamente.");
      await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
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
      expect(notificador.enviarEmailAlojamientoConfirmado).not.toHaveBeenCalled();
    });

    it("404 al resolver una solicitud inexistente (RES-10)", async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("no permite resolver dos veces la misma solicitud", async () => {
      repo.buscarPorId.mockResolvedValue(solicitud({ estado: "CONFIRMADA" }));

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toThrow("no está PENDIENTE");
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
    });

    it("RES-04: rechaza si el servicio no es de alojamiento o no está activo", async () => {
      repo.buscarServicio.mockResolvedValue({ idservicio: 40, estado: "ACTIVO", alojamiento: null });

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("alojamiento"),
      });
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
    });

    it("RES-04: rechaza si el servicio no cumple con los criterios de localidad/categoría/habitación", async () => {
      repo.buscarServicio.mockResolvedValue({
        idservicio: 40,
        estado: "ACTIVO",
        localidad: "Lima", // El paquete pide Cusco
        alojamiento: { categoria: "3 estrellas", tipoHabitacion: "Doble" },
      });

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("criterios"),
      });
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
    });

    it("RES-04: rechaza al aceptar si el servicio ya fue rechazado anteriormente en esta reserva", async () => {
      const s = solicitud();
      s.reserva.solicitudes = [
        { gestiones: [{ resultado: "Rechazada", idservicio: 40 }] },
      ];
      repo.buscarPorId.mockResolvedValue(s);

      await expect(
        new SolicitudService().procesarResolucion(5, dto({ servicioId: 40, resolucion: "ACEPTADA" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("ya fue rechazado"),
      });
      expect(repo.resolverComoAceptada).not.toHaveBeenCalled();
    });
  });
});
