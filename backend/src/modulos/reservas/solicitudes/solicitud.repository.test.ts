import { describe, it, expect, vi, beforeEach } from "vitest";
import { SolicitudRepository } from "./solicitud.repository";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    solicitud: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    reserva: { update: vi.fn() },
  },
}));
vi.mock("../../../config/postgresDatabase", () => ({ db }));

describe("SolicitudRepository", () => {
  const repo = new SolicitudRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(db));
  });

  describe("resolverComoAceptada (RES-01, RES-05)", () => {
    it("RES-01: actualiza estadoAlojamiento en CONFIRMADO y no pisa estado de la reserva", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.solicitud.update.mockResolvedValue({ idsolicitud: 1, estado: "CONFIRMADA" });
      db.reserva.update.mockResolvedValue({ idreserva: 10, estadoAlojamiento: "CONFIRMADO" });

      await repo.resolverComoAceptada(1, 10, 40);

      expect(db.reserva.update).toHaveBeenCalledWith({
        where: { idreserva: 10 },
        data: { estadoAlojamiento: "CONFIRMADO" },
      });
      // Verifica que no se sobreescriba reserva.estado
      expect(db.reserva.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: "CONFIRMADA" }) })
      );
    });

    it("RES-05: rechaza si la reserva fue cancelada concurrentemente", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CANCELADA" },
      });

      await expect(repo.resolverComoAceptada(1, 10, 40)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("cancelada"),
      });
      expect(db.solicitud.update).not.toHaveBeenCalled();
      expect(db.reserva.update).not.toHaveBeenCalled();
    });

    it("RES-05: rechaza si la solicitud ya no está pendiente", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "CONFIRMADA",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });

      await expect(repo.resolverComoAceptada(1, 10, 40)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("no está pendiente"),
      });
    });
  });

  describe("resolverComoRechazada (RES-05, RES-09)", () => {
    it("RES-09: copia los criterios de alojamiento a la nueva solicitud -R", async () => {
      const criterios = "Localidad: Cusco | Categoría: 3 estrellas | Habitación: Doble";
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        nroSolicitud: "SOL-0001",
        estado: "PENDIENTE",
        criterios,
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.solicitud.update.mockResolvedValue({
        idsolicitud: 1,
        nroSolicitud: "SOL-0001",
        estado: "RECHAZADA",
      });
      db.solicitud.create.mockResolvedValue({
        idsolicitud: 2,
        nroSolicitud: "SOL-0001-R",
        criterios,
      });

      await repo.resolverComoRechazada(1, 10, 40, "Sin cupo", 2);

      expect(db.solicitud.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idreserva: 10,
          nroSolicitud: "SOL-0001-R",
          estado: "PENDIENTE",
          cantidadPlazas: 2,
          criterios,
        }),
      });
    });

    it("RES-05: rechaza si la reserva fue cancelada concurrentemente", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CANCELADA" },
      });

      await expect(repo.resolverComoRechazada(1, 10, 40, "Sin cupo", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("cancelada"),
      });
      expect(db.solicitud.create).not.toHaveBeenCalled();
    });
  });
});
