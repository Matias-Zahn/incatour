import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReservaService } from "./reserva.service";
import { CrearReservaDto } from "./reserva.dto";

// Repositorio, pasarela y notificador mockeados: el test no toca la base ni espera la latencia simulada
const { repo, pasarela, notificador } = vi.hoisted(() => ({
  repo: {
    obtenerClientePorUsuario: vi.fn(),
    obtenerSalidaParaCompra: vi.fn(),
    reservarCupos: vi.fn(),
    liberarCupos: vi.fn(),
    confirmarReserva: vi.fn(),
    registrarReembolsoPendiente: vi.fn(),
    buscarPasajerosPorPasaporte: vi.fn(),
  },
  pasarela: { procesarPago: vi.fn(), reembolsar: vi.fn() },
  notificador: { enviarEmailConfirmacion: vi.fn(), enviarEmailRechazo: vi.fn() },
}));
vi.mock("./reserva.repository", () => ({ ReservaRepository: class { constructor() { return repo; } } }));
vi.mock("../../../integraciones/pasarela/pasarela.mock", () => ({ PasarelaMock: class { constructor() { return pasarela; } } }));
vi.mock("../../../integraciones/notificador/notificador.mock", () => ({ NotificadorMock: class { constructor() { return notificador; } } }));

const INICIO = new Date("2030-06-10");
const FIN = new Date("2030-06-13");

const pasajero = (n: number, vence = "2031-01-01") => ({
  nombreCompleto: `Pasajero ${n}`,
  nroPasaporte: `P${n}`,
  nacionalidad: "Argentina",
  fechaVencimientoPasaporte: vence,
});

const crearDto = (over: Record<string, unknown> = {}) =>
  CrearReservaDto.create({
    idsalida: 7,
    medioPago: "TARJETA",
    pasajeros: [pasajero(1), pasajero(2)],
    tarjeta: { numero: "4111222233334444", titular: "Ana", vencimiento: "12/30", cvv: "123" },
    ...over,
  })[1]!;

const temporada = (fechaInicio: string, fechaFin: string, estado = "ACTIVO", nombre = "Alta") => ({
  nombre, estado, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin),
});

const salida = (over: Record<string, unknown> = {}) => ({
  idsalida: 7,
  estado: "PUBLICADA",
  fechaInicio: INICIO,
  fechaFin: FIN,
  stockLocal: 10,
  servicios: [] as unknown[],
  paquete: {
    condiciones: "Sin reembolso a menos de 30 días",
    diasMinimosReintegro: 15,
    localidadGarantizada: "Cusco",
    categoriaGarantizada: "3 estrellas",
    tipoHabitacionGarantizada: "Doble",
    garantiasEstablecimiento: [{ idservicio: 40 }],
    servicios: [] as unknown[],
    tarifas: [
      { monto: 500, moneda: "USD", temporada: temporada("2030-01-01", "2030-04-30") }, // baja: no aplica
      { monto: 800, moneda: "USD", temporada: temporada("2030-05-01", "2030-09-30") }, // alta: vigente
    ],
  },
  ...over,
});

const servicioTransporte = (pesoEquipajeIncluido: number, costoPorKgExcedente: number) => ({
  servicio: { transporte: { pesoEquipajeIncluido, costoPorKgExcedente } },
});

describe("ReservaService.crearReserva (CU-30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.obtenerClientePorUsuario.mockResolvedValue({ idcliente: 3, estado: "ACTIVO", usuario: { email: "ana@mail.com" } });
    repo.obtenerSalidaParaCompra.mockResolvedValue(salida());
    repo.buscarPasajerosPorPasaporte.mockResolvedValue([]);
    repo.reservarCupos.mockResolvedValue({ alojamientoReservado: true });
    repo.liberarCupos.mockResolvedValue(undefined);
    repo.confirmarReserva.mockImplementation(async (d) => ({
      idreserva: 99, nroReserva: d.nroReserva, estado: "CONFIRMADA",
      estadoAlojamiento: d.estadoAlojamiento, cantidadPasajeros: d.pasajeros.length, precioCongelado: d.precioCongelado,
    }));
    pasarela.procesarPago.mockResolvedValue({ aprobado: true, transaccionId: "TXN-1", mensaje: "ok" });
    pasarela.reembolsar.mockResolvedValue({ aprobado: true, transaccionId: "TXN-1", mensaje: "ok" });
    repo.registrarReembolsoPendiente.mockResolvedValue({});
    notificador.enviarEmailConfirmacion.mockResolvedValue(true);
    notificador.enviarEmailRechazo.mockResolvedValue(true);
  });

  describe("flujo normal", () => {
    it("reserva cupos, cobra la tarifa vigente y confirma la reserva", async () => {
      const r = await new ReservaService().crearReserva(crearDto(), 1);

      expect(repo.reservarCupos).toHaveBeenCalledWith(7, 2);
      expect(pasarela.procesarPago).toHaveBeenCalledWith(expect.objectContaining({ monto: 1600, moneda: "USD" }));
      expect(r).toMatchObject({ idreserva: 99, precioCongelado: 1600, moneda: "USD", transaccionPasarela: "TXN-1", estadoAlojamiento: "CONFIRMADO" });
      expect(r.nroReserva).toMatch(/^RES-/);
      expect(repo.liberarCupos).not.toHaveBeenCalled();
      expect(notificador.enviarEmailConfirmacion).toHaveBeenCalledWith("ana@mail.com", 99, 1600);
    });

    it("el cliente sale del usuario autenticado, no del body", async () => {
      await new ReservaService().crearReserva(crearDto(), 42);

      expect(repo.obtenerClientePorUsuario).toHaveBeenCalledWith(42);
      expect(repo.confirmarReserva).toHaveBeenCalledWith(expect.objectContaining({ idcliente: 3, condicionesComerciales: "Sin reembolso a menos de 30 días", diasMinimosReintegro: 15 }));
    });

    it("CU-30 usa la foto de la salida y no el paquete vivo (CAT-05)", async () => {
      const foto = {
        condiciones: "Condiciones de la foto", localidadGarantizada: "Urubamba", categoriaGarantizada: "5 estrellas",
        tipoHabitacionGarantizada: "Suite", diasMinimosReintegro: 7,
        servicios: [{ idservicio: 1, nombreServicio: "Bus", transporte: { pesoEquipajeIncluido: 15, costoPorKgExcedente: 10 } }],
      };
      repo.obtenerSalidaParaCompra.mockResolvedValue(salida({ definicionPaquete: foto }));
      repo.reservarCupos.mockResolvedValue({ alojamientoReservado: false });
      const dto = crearDto({ equipaje: [{ pesoDeclarado: 20 }, { pesoDeclarado: 10 }] });

      const r = await new ReservaService().crearReserva(dto, 1);

      expect(r.precioCongelado).toBe(1650); // el transporte sale de la foto: 800*2 + 5*10
      const datos = repo.confirmarReserva.mock.calls[0]![0];
      expect(datos).toMatchObject({ condicionesComerciales: "Condiciones de la foto", diasMinimosReintegro: 7 });
      expect(datos.solicitud.criterios).toContain("Urubamba");
    });

    it("congela el desglose del precio en la reserva (RES-07)", async () => {
      const dto = crearDto({ equipaje: [{ pesoDeclarado: 20 }, { pesoDeclarado: 10 }] });
      const s = salida();
      s.paquete.servicios = [servicioTransporte(15, 10)];
      repo.obtenerSalidaParaCompra.mockResolvedValue(s);

      await new ReservaService().crearReserva(dto, 1);

      expect(repo.confirmarReserva).toHaveBeenCalledWith(expect.objectContaining({
        precioCongelado: 1650, temporadaAplicada: "Alta", precioPaquetePorPersona: 800, adicionalesEquipaje: 50, moneda: "USD",
      }));
    });

    it("CAT-33: la franquicia sale de la foto aunque la salida tenga otro transporte asignado", async () => {
      const s = salida({ servicios: [servicioTransporte(50, 0)] });
      s.paquete.servicios = [servicioTransporte(15, 10)];
      repo.obtenerSalidaParaCompra.mockResolvedValue(s);
      const dto = crearDto({ equipaje: [{ pesoDeclarado: 20 }, { pesoDeclarado: 10 }] });

      const r = await new ReservaService().crearReserva(dto, 1);

      expect(r.precioCongelado).toBe(1650); // 800*2 + (20-15)*10
    });

    it("sin transporte asignado, usa el incluido en el paquete", async () => {
      const s = salida();
      s.paquete.servicios = [{ servicio: { transporte: null } }, servicioTransporte(10, 2.5)];
      repo.obtenerSalidaParaCompra.mockResolvedValue(s);
      const dto = crearDto({ equipaje: [{ pesoDeclarado: 13 }, { pesoDeclarado: 5 }] });

      const r = await new ReservaService().crearReserva(dto, 1);

      expect(r.precioCongelado).toBe(1607.5); // 800*2 + 3*2.5
    });

    it("sin alojamiento disponible, deja la reserva PENDIENTE con su solicitud de alojamiento", async () => {
      repo.reservarCupos.mockResolvedValue({ alojamientoReservado: false });

      const r = await new ReservaService().crearReserva(crearDto(), 1);

      expect(r.estadoAlojamiento).toBe("PENDIENTE");
      const datos = repo.confirmarReserva.mock.calls[0]![0];
      expect(datos.solicitud).toMatchObject({ nroSolicitud: expect.stringMatching(/^SOL-RES-/) });
      expect(datos.solicitud.criterios).toContain("Cusco");
    });

    it("si falla el email de confirmación, la reserva sigue siendo válida", async () => {
      notificador.enviarEmailConfirmacion.mockRejectedValue(new Error("SMTP caído"));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).resolves.toMatchObject({ idreserva: 99 });
    });
  });

  describe("validaciones previas (no reservan cupos ni cobran)", () => {
    const sinEfectos = () => {
      expect(repo.reservarCupos).not.toHaveBeenCalled();
      expect(pasarela.procesarPago).not.toHaveBeenCalled();
    };

    it("RES-15: rechaza con 409 un pasaporte registrado a nombre de otra persona", async () => {
      repo.buscarPasajerosPorPasaporte.mockResolvedValue([{ nroPasaporte: "P2", nombreCompleto: "Otra Persona" }]);

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 409 });
      sinEfectos();
    });

    it("RES-15: acepta un pasaporte registrado con el mismo nombre (sin distinguir mayúsculas ni espacios)", async () => {
      repo.buscarPasajerosPorPasaporte.mockResolvedValue([{ nroPasaporte: "P2", nombreCompleto: " pasajero 2 " }]);

      await expect(new ReservaService().crearReserva(crearDto(), 1)).resolves.toBeDefined();
    });

    it("rechaza si el usuario no es un cliente activo", async () => {
      repo.obtenerClientePorUsuario.mockResolvedValue({ idcliente: 3, estado: "INACTIVO", usuario: { email: "x" } });

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 403 });
      sinEfectos();
    });

    it("rechaza si la salida no existe", async () => {
      repo.obtenerSalidaParaCompra.mockResolvedValue(null);

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 404 });
      sinEfectos();
    });

    it("rechaza si la salida no está publicada", async () => {
      repo.obtenerSalidaParaCompra.mockResolvedValue(salida({ estado: "CERRADA" }));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("no está disponible");
      sinEfectos();
    });

    it("rechaza si la salida ya comenzó", async () => {
      repo.obtenerSalidaParaCompra.mockResolvedValue(salida({ fechaInicio: new Date("2020-01-01") }));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("ya comenzó");
      sinEfectos();
    });

    it("rechaza si se piden más lugares que el stock", async () => {
      repo.obtenerSalidaParaCompra.mockResolvedValue(salida({ stockLocal: 1 }));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("Solo quedan 1 lugares");
      sinEfectos();
    });

    it("rechaza pasaportes repetidos", async () => {
      const dto = crearDto({ pasajeros: [pasajero(1), pasajero(1)] });

      await expect(new ReservaService().crearReserva(dto, 1)).rejects.toThrow("mismo número de pasaporte");
      sinEfectos();
    });

    it("rechaza un pasaporte que vence antes de terminar el recorrido", async () => {
      const dto = crearDto({ pasajeros: [pasajero(1), pasajero(2, "2030-06-12")] });

      await expect(new ReservaService().crearReserva(dto, 1)).rejects.toThrow("antes de que termine el recorrido");
      sinEfectos();
    });

    it("rechaza si no hay tarifa activa para la fecha de la salida", async () => {
      const s = salida();
      s.paquete.tarifas = [{ monto: 800, moneda: "USD", temporada: temporada("2030-05-01", "2030-09-30", "INACTIVO") }];
      repo.obtenerSalidaParaCompra.mockResolvedValue(s);

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("tarifa vigente");
      sinEfectos();
    });
  });

  describe("concurrencia y compensaciones", () => {
    it("si la reserva atómica de cupos falla (otro compró antes), corta sin cobrar", async () => {
      repo.reservarCupos.mockResolvedValue(null);

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("No hay lugares suficientes");
      expect(pasarela.procesarPago).not.toHaveBeenCalled();
      expect(repo.confirmarReserva).not.toHaveBeenCalled();
    });

    it("pago rechazado: libera los cupos, avisa al cliente y no registra la reserva", async () => {
      repo.reservarCupos.mockResolvedValue({ alojamientoReservado: true });
      pasarela.procesarPago.mockResolvedValue({ aprobado: false, mensaje: "Fondos insuficientes" });

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 400, message: "Pago rechazado: Fondos insuficientes" });
      expect(repo.liberarCupos).toHaveBeenCalledWith(7, 2, true);
      expect(notificador.enviarEmailRechazo).toHaveBeenCalledWith("ana@mail.com", "Fondos insuficientes");
      expect(repo.confirmarReserva).not.toHaveBeenCalled();
    });

    it("pasarela caída: libera los cupos y responde 503", async () => {
      pasarela.procesarPago.mockRejectedValue(new Error("timeout"));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 503, message: expect.stringContaining("pasarela") });
      expect(repo.liberarCupos).toHaveBeenCalledWith(7, 2, true);
      expect(repo.confirmarReserva).not.toHaveBeenCalled();
    });

    describe("pago aprobado pero falla la base", () => {
      beforeEach(() => {
        repo.reservarCupos.mockResolvedValue({ alojamientoReservado: false });
        repo.confirmarReserva.mockRejectedValue(new Error("fallo de la base"));
      });

      it("libera los cupos y reembolsa el cobro", async () => {
        await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining("anulado") });
        expect(repo.liberarCupos).toHaveBeenCalledWith(7, 2, false);
        expect(pasarela.reembolsar).toHaveBeenCalledWith("TXN-1", 1600);
        expect(repo.registrarReembolsoPendiente).not.toHaveBeenCalled();
        expect(notificador.enviarEmailConfirmacion).not.toHaveBeenCalled();
      });

      it("si el reembolso falla, queda registrado como pendiente e informa la transacción", async () => {
        pasarela.reembolsar.mockRejectedValue(new Error("timeout"));

        await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining("TXN-1") });
        expect(repo.registrarReembolsoPendiente).toHaveBeenCalledWith(
          expect.objectContaining({ idsalida: 7, transaccionId: "TXN-1", monto: 1600, email: "ana@mail.com" })
        );
      });

      it("si el reembolso es rechazado, también queda registrado", async () => {
        pasarela.reembolsar.mockResolvedValue({ aprobado: false, mensaje: "no" });

        await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 500 });
        expect(repo.registrarReembolsoPendiente).toHaveBeenCalledTimes(1);
      });

      it("si fallan el reembolso y el registro, igual informa la transacción", async () => {
        pasarela.reembolsar.mockRejectedValue(new Error("timeout"));
        repo.registrarReembolsoPendiente.mockRejectedValue(new Error("base caída"));

        await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining("TXN-1") });
      });
    });

    it("si también falla la liberación de cupos, se conserva el error original", async () => {
      pasarela.procesarPago.mockResolvedValue({ aprobado: false, mensaje: "Tarjeta robada" });
      repo.liberarCupos.mockRejectedValue(new Error("base caída"));

      await expect(new ReservaService().crearReserva(crearDto(), 1)).rejects.toThrow("Pago rechazado: Tarjeta robada");
    });
  });
});
