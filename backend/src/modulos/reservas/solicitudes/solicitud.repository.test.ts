import { describe, it, expect, vi, beforeEach } from "vitest";
import { SolicitudRepository } from "./solicitud.repository";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    solicitud: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    reserva: { updateMany: vi.fn(), count: vi.fn() },
    gestionSolicitud: { create: vi.fn() },
  },
}));
vi.mock("../../../config/postgresDatabase", () => ({ db }));

describe("SolicitudRepository", () => {
  const repo = new SolicitudRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(db));
    db.solicitud.updateMany.mockResolvedValue({ count: 1 });
    db.reserva.updateMany.mockResolvedValue({ count: 1 });
    db.reserva.count.mockResolvedValue(1);
    db.gestionSolicitud.create.mockResolvedValue({});
  });

  describe("resolverComoAceptada (RES-01, RES-05)", () => {
    it("RES-01 y RES-05: actualiza solicitud y reserva atómicamente con updateMany condicionando el estado", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });

      await repo.resolverComoAceptada(1, 10, 40);

      expect(db.solicitud.updateMany).toHaveBeenCalledWith({
        where: { idsolicitud: 1, estado: "PENDIENTE" },
        data: { estado: "CONFIRMADA" },
      });
      expect(db.reserva.updateMany).toHaveBeenCalledWith({
        where: { idreserva: 10, estado: { not: "CANCELADA" } },
        data: { estadoAlojamiento: "CONFIRMADO" },
      });
      expect(db.gestionSolicitud.create).toHaveBeenCalledWith({
        data: {
          idsolicitud: 1,
          idservicio: 40,
          resultado: "Aceptada",
        },
      });
    });

    it("RES-05: rechaza si la reserva ya estaba cancelada en la lectura inicial", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CANCELADA" },
      });

      await expect(repo.resolverComoAceptada(1, 10, 40)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("cancelada"),
      });
      expect(db.solicitud.updateMany).not.toHaveBeenCalled();
      expect(db.reserva.updateMany).not.toHaveBeenCalled();
    });

    it("RES-05: carrera en aceptación: rechaza si la solicitud ya no está pendiente al ejecutar updateMany", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.solicitud.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.resolverComoAceptada(1, 10, 40)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("no está pendiente"),
      });
      expect(db.gestionSolicitud.create).not.toHaveBeenCalled();
    });

    it("RES-05: carrera en aceptación: rechaza si la reserva fue cancelada concurrentemente antes de updateMany", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.solicitud.updateMany.mockResolvedValue({ count: 1 });
      db.reserva.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.resolverComoAceptada(1, 10, 40)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("cancelada"),
      });
      // La reserva se bloquea antes que la solicitud (mismo orden que la cancelación)
      expect(db.solicitud.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("resolverComoRechazada (RES-05, RES-09)", () => {
    it("RES-09 y RES-05: actualiza atómicamente con updateMany y genera solicitud -R con criterios", async () => {
      const criterios = "Localidad: Cusco | Categoría: 3 estrellas | Habitación: Doble";
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        nroSolicitud: "SOL-0001",
        estado: "PENDIENTE",
        criterios,
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.solicitud.create.mockResolvedValue({
        idsolicitud: 2,
        nroSolicitud: "SOL-0001-R",
        criterios,
      });

      await repo.resolverComoRechazada(1, 10, 40, "Sin cupo", 2);

      expect(db.reserva.updateMany).toHaveBeenCalledWith({
        where: { idreserva: 10, estado: { not: "CANCELADA" } },
        data: { estadoAlojamiento: "PENDIENTE" },
      });
      expect(db.solicitud.updateMany).toHaveBeenCalledWith({
        where: { idsolicitud: 1, estado: "PENDIENTE" },
        data: { estado: "RECHAZADA" },
      });
      expect(db.gestionSolicitud.create).toHaveBeenCalledWith({
        data: {
          idsolicitud: 1,
          idservicio: 40,
          resultado: "Rechazada",
          motivoRechazo: "Sin cupo",
        },
      });
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

    it("RES-05: carrera en rechazo: rechaza si la reserva fue cancelada concurrentemente y no crea la solicitud -R", async () => {
      db.solicitud.findUnique.mockResolvedValue({
        idsolicitud: 1,
        nroSolicitud: "SOL-0001",
        estado: "PENDIENTE",
        reserva: { idreserva: 10, estado: "CONFIRMADA" },
      });
      db.reserva.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.resolverComoRechazada(1, 10, 40, "Sin cupo", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("cancelada"),
      });
      expect(db.solicitud.create).not.toHaveBeenCalled();
    });
  });
});
