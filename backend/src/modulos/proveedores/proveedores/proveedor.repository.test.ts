import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProveedorRepository } from "./proveedor.repository";

const { tx, db } = vi.hoisted(() => {
  const tx = {
    proveedor: { update: vi.fn() }, servicioBase: { updateMany: vi.fn() },
    $queryRaw: vi.fn(), salida: { count: vi.fn().mockResolvedValue(0) },
  };
  return { tx, db: { $transaction: vi.fn(async (fn: any) => fn(tx)) } };
});
vi.mock("../../../config/postgresDatabase", () => ({ db }));

describe("ProveedorRepository.update (CU-16)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("CAT-10: pasar a INACTIVO da de baja en cascada los servicios activos", async () => {
    await new ProveedorRepository().update(3, { estado: "INACTIVO" } as any);

    expect(tx.servicioBase.updateMany).toHaveBeenCalledWith({
      where: { idproveedor: 3, estado: "ACTIVO" },
      data: { estado: "INACTIVO" },
    });
    expect(tx.proveedor.update).toHaveBeenCalled();
  });

  it("CTA-09: bloquea los servicios y revalida las salidas activas dentro de la transacción", async () => {
    tx.salida.count.mockResolvedValueOnce(1);

    await expect(new ProveedorRepository().update(3, { estado: "INACTIVO" } as any)).rejects.toThrow("salidas activas");
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.servicioBase.updateMany).not.toHaveBeenCalled();
  });

  it("sin cambio de estado no toca los servicios", async () => {
    await new ProveedorRepository().update(3, { localidad: "Cusco" } as any);

    expect(tx.servicioBase.updateMany).not.toHaveBeenCalled();
  });
});
