import { describe, it, expect } from "vitest";
import { AutoridadMock } from "./autoridad.mock";
import { TitularPermiso } from "./autoridad.interface";

const DIA = new Date("2026-11-15");

const titular = (id: number): TitularPermiso => ({
  tipo: "PASAJERO",
  id,
  nombreCompleto: "Test",
  nacionalidad: "Peruana",
  nroPasaporte: `P${id}`,
  fechaVencimientoPasaporte: new Date("2030-01-01"),
});

// Bloquea lugares y devuelve el idBloqueo, o falla el test si la autoridad rechaza
const bloquear = async (autoridad: AutoridadMock, lugares: number) => {
  const resultado = await autoridad.solicitarBloqueoCupo(DIA, lugares);
  if (!resultado.aprobado) throw new Error("El bloqueo debía aprobarse");
  return resultado.idBloqueo;
};

describe("AutoridadMock", () => {
  it("rechaza el bloqueo si no alcanza el cupo diario y dice cuántos lugares quedan", async () => {
    const autoridad = new AutoridadMock();
    await autoridad.solicitarBloqueoCupo(DIA, 490);

    const resultado = await autoridad.solicitarBloqueoCupo(DIA, 16);

    expect(resultado).toEqual({ aprobado: false, lugaresDisponibles: 10 });
  });

  it("al liberar sobrantes, esos lugares vuelven a estar disponibles", async () => {
    const autoridad = new AutoridadMock();
    const idBloqueo = await bloquear(autoridad, 490);

    await autoridad.liberarLugaresSobrantes(idBloqueo, 6);
    const resultado = await autoridad.solicitarBloqueoCupo(DIA, 16);

    expect(resultado.aprobado).toBe(true);
  });

  it("no emite el permiso del reemplazante si el anterior sigue vigente", async () => {
    const autoridad = new AutoridadMock();
    const idBloqueo = await bloquear(autoridad, 2);
    const [anterior] = await autoridad.solicitarEmisionNominal(idBloqueo, [titular(1), titular(2)]);

    const reemplazo = autoridad.solicitarPermisoIndividual(idBloqueo, titular(3), anterior!.nroPermiso);

    await expect(reemplazo).rejects.toThrow("vigente");
  });

  it("con el permiso anterior dado de baja, emite uno nuevo para el reemplazante", async () => {
    const autoridad = new AutoridadMock();
    const idBloqueo = await bloquear(autoridad, 2);
    const [anterior] = await autoridad.solicitarEmisionNominal(idBloqueo, [titular(1), titular(2)]);
    await autoridad.darDeBajaPermiso(idBloqueo, anterior!.nroPermiso);

    const nuevo = await autoridad.solicitarPermisoIndividual(idBloqueo, titular(3), anterior!.nroPermiso);

    expect(nuevo.titular).toEqual({ tipo: "PASAJERO", id: 3 });
    expect(nuevo.nroPermiso).not.toBe(anterior!.nroPermiso);
  });

  it("si la autoridad está caída, tira error", async () => {
    const autoridad = new AutoridadMock(true);

    await expect(autoridad.solicitarBloqueoCupo(DIA, 1)).rejects.toThrow("no responde");
  });
});
