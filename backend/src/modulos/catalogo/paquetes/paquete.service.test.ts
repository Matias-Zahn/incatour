import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { PaqueteService } from "./paquete.service";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";

// El servicio valida contra Prisma directamente (circuito, etapas, servicios, temporadas): se mockea `db`
const { repo, db } = vi.hoisted(() => ({
  repo: {
    findAll: vi.fn(), findById: vi.fn(), guardar: vi.fn(), update: vi.fn(), updateEstado: vi.fn(),
    reemplazarTarifas: vi.fn(), tieneSalidasActivas: vi.fn(), tieneSalidasNoCanceladas: vi.fn(), contarPaquetes: vi.fn(),
  },
  db: {
    circuito: { findUnique: vi.fn() },
    etapaRuta: { count: vi.fn() },
    servicioBase: { findUnique: vi.fn() },
    temporada: { findUnique: vi.fn() },
  },
}));
vi.mock("./paquete.repository", () => ({ PaqueteRepository: class { constructor() { return repo; } } }));
vi.mock("../../../config/postgresDatabase", () => ({ db }));

const precios = [{ idtemporada: 1, monto: 800, moneda: "USD" }];
const porCategoria = {
  idcircuito: 1, nombrePaquete: "Inca Clásico", tipoGarantia: "POR_CATEGORIA",
  localidadGarantizada: "Cusco", categoriaGarantizada: "3 estrellas", tipoHabitacionGarantizada: "Doble",
  idtransporte: 11, matrizPrecios: precios,
};
const crear = (obj: Record<string, unknown> = {}) => CrearPaqueteDto.create({ ...porCategoria, ...obj })[1]!;
const porEstablecimiento = (obj: Record<string, unknown> = {}) =>
  crear({ tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: 40, categoriaGarantizada: undefined, tipoHabitacionGarantizada: undefined, ...obj });
const hotel = (modalidadConfirmacion = "BLOQUEO_PLAZAS", estado = "ACTIVO", proveedorEstado = "ACTIVO") => ({
  idservicio: 40, estado, localidad: "Cusco", alojamiento: { modalidadConfirmacion }, proveedor: { estado: proveedorEstado },
});
// B2: un servicio de cada tipo (el subtipo dice el tipo, como en Prisma)
const activo = { estado: "ACTIVO", proveedor: { estado: "ACTIVO" } };
const servicios: Record<number, unknown> = {
  11: { idservicio: 11, ...activo, transporte: { capacidadVehiculo: 20 } },
  12: { idservicio: 12, ...activo, tren: { diasOperacion: "L-M-X-J-V-S-D" } },
  7: { idservicio: 7, ...activo, equipamiento: { tipoEquipamiento: "Carpa" } },
};

describe("PaqueteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.circuito.findUnique.mockResolvedValue({ idcircuito: 1, estado: "ACTIVO" });
    db.etapaRuta.count.mockResolvedValue(3);
    db.temporada.findUnique.mockResolvedValue({ idtemporada: 1, estado: "ACTIVO" });
    db.servicioBase.findUnique.mockImplementation(async ({ where }) => (where.idservicio === 40 ? hotel() : (servicios[where.idservicio] ?? null)));
    repo.contarPaquetes.mockResolvedValue(6);
    repo.guardar.mockImplementation(async (datos) => ({ idpaquete: 10, servicios: [], ...datos }));
    repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", servicios: [] });
    repo.tieneSalidasActivas.mockResolvedValue(false);
    repo.tieneSalidasNoCanceladas.mockResolvedValue(false);
  });

  describe("consultarPaquetes (CU-10)", () => {
    it("lista los paquetes y pasa filtros (CAT-13)", async () => {
      repo.findAll.mockResolvedValue([{ idpaquete: 1, servicios: [] }]);

      const filtros = { estado: "INACTIVO", idcircuito: 1 };
      await expect(new PaqueteService().consultarPaquetes(filtros)).resolves.toHaveLength(1);
      expect(repo.findAll).toHaveBeenCalledWith(filtros);
    });

    it("B2: cada servicio lleva su tipo, y un paquete viejo sin transporte avisa faltaTransporte", async () => {
      repo.findAll.mockResolvedValue([
        { idpaquete: 1, servicios: [{ idservicio: 12, cantidad: null, servicio: servicios[12] }] },
        { idpaquete: 2, servicios: [{ idservicio: 11, servicio: servicios[11] }, { idservicio: 7, cantidad: 1, cadaPasajeros: 2, servicio: servicios[7] }] },
      ]);

      const [viejo, nuevo] = await new PaqueteService().consultarPaquetes();

      expect(viejo).toMatchObject({ faltaTransporte: true, servicios: [{ tipo: "TREN" }] });
      expect(nuevo).toMatchObject({ faltaTransporte: false, servicios: [{ tipo: "TRANSPORTE" }, { tipo: "EQUIPAMIENTO", cantidad: 1, cadaPasajeros: 2 }] });
    });

    it("B9 y 12.6: el detalle trae los días en que puede salir (paquete ∩ tren) y la fecha mínima", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(2026, 10, 21, 10));
        const tren = { ...servicios[12] as object, nombreServicio: "Expedition", tren: { diasOperacion: "L-V-S" } };
        repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", diasDisponibles: "L-X-V", diasCierreVenta: 2, servicios: [{ servicio: tren }] });

        const p = await new PaqueteService().consultarPaquetePorId(10);

        expect(p.calendarioSalidas).toEqual({ diasHabilitados: ["L", "V"], fechaMinima: "2026-11-24" });
      } finally {
        vi.useRealTimers();
      }
    });

    it("404 al pedir un paquete inactivo", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "INACTIVO" });

      await expect(new PaqueteService().consultarPaquetePorId(10)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("CAT-24: el admin ve el detalle de un paquete inactivo", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "INACTIVO", diasCierreVenta: 2, servicios: [] });

      await expect(new PaqueteService().consultarPaquetePorId(10, true)).resolves.toMatchObject({ estado: "INACTIVO" });
    });
  });

  describe("registrarNuevoPaquete (CU-11)", () => {
    it("guarda el paquete activo con número correlativo, tarifas y servicios (B2: transporte, tren y equipo con su regla)", async () => {
      const p = await new PaqueteService().registrarNuevoPaquete(
        crear({ idtren: 12, equipo: [{ idservicio: 7, cantidad: 1, cadaPasajeros: 2 }], diasCierreVenta: 3 })
      );

      expect(p).toMatchObject({ nroPaquete: "PKG-0007", estado: "ACTIVO", nochesPrevias: 0, nochesPosteriores: 0 });
      expect(repo.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ idcircuito: 1, tipoGarantia: "POR_CATEGORIA", localidadGarantizada: "Cusco", diasCierreVenta: 3 }),
        precios,
        [{ idservicio: 11 }, { idservicio: 12 }, { idservicio: 7, cantidad: 1, cadaPasajeros: 2 }]
      );
    });

    it.each([
      [{ idtransporte: 12 }, "El servicio con ID 12 no es un transporte."],
      [{ idtren: 11 }, "El servicio con ID 11 no es un tren."],
      [{ equipo: [{ idservicio: 11, cantidad: 1, cadaPasajeros: 1 }] }, "El servicio con ID 11 no es un equipamiento."],
      [{ idtren: 99 }, "El servicio con ID 99 no existe o no está activo."],
    ])("B2: rechaza un servicio de otro tipo o inexistente %o", async (cambio, mensaje) => {
      await expect(new PaqueteService().registrarNuevoPaquete(crear(cambio))).rejects.toThrow(mensaje);
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("B2: el hotel garantizado tiene que estar en la ciudad de Sale desde", async () => {
      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento({ localidadGarantizada: "Aguas Calientes" }))).rejects.toThrow(
        "El hotel garantizado está en Cusco y el paquete sale desde Aguas Calientes."
      );
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("CAT-23: si el número ya lo tomó otro alta, reintenta con el siguiente", async () => {
      repo.contarPaquetes.mockResolvedValue(3);
      repo.guardar
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "5" }))
        .mockResolvedValueOnce({ idpaquete: 9, servicios: [] });

      await expect(new PaqueteService().registrarNuevoPaquete(crear())).resolves.toMatchObject({ idpaquete: 9 });
      expect(repo.guardar.mock.calls.map(([d]) => d.nroPaquete)).toEqual(["PKG-0004", "PKG-0005"]);
    });

    it("con garantía por categoría no consulta ningún establecimiento", async () => {
      await new PaqueteService().registrarNuevoPaquete(crear());

      expect(db.servicioBase.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { idservicio: 40 } }));
    });

    it("acepta garantía por establecimiento si el hotel confirma por bloqueo de plazas", async () => {
      await new PaqueteService().registrarNuevoPaquete(porEstablecimiento());

      expect(db.servicioBase.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idservicio: 40 } }));
      expect(repo.guardar).toHaveBeenCalled();
    });

    it("FA2: rechaza garantía por establecimiento si el hotel confirma a solicitud", async () => {
      db.servicioBase.findUnique.mockResolvedValueOnce(hotel("A_SOLICITUD"));

      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento())).rejects.toThrow("bloqueo de plazas");
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("rechaza garantizar un servicio que no es de alojamiento", async () => {
      db.servicioBase.findUnique.mockResolvedValueOnce({ idservicio: 40, estado: "ACTIVO", alojamiento: null, proveedor: { estado: "ACTIVO" } });

      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento())).rejects.toThrow("no es un servicio de alojamiento");
    });

    it("rechaza garantizar un hotel inactivo", async () => {
      db.servicioBase.findUnique.mockResolvedValueOnce(hotel("BLOQUEO_PLAZAS", "INACTIVO"));

      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento())).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza un circuito inexistente o inactivo", async () => {
      db.circuito.findUnique.mockResolvedValue({ idcircuito: 1, estado: "INACTIVO" });

      await expect(new PaqueteService().registrarNuevoPaquete(crear())).rejects.toThrow("circuito no existe o no está activo");
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("precondición: el circuito debe tener etapas", async () => {
      db.etapaRuta.count.mockResolvedValue(0);

      await expect(new PaqueteService().registrarNuevoPaquete(crear())).rejects.toThrow("etapas establecidas");
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("viabilidad comercial: rechaza tarifas de una temporada inactiva", async () => {
      db.temporada.findUnique.mockResolvedValue({ idtemporada: 1, estado: "INACTIVO" });

      await expect(new PaqueteService().registrarNuevoPaquete(crear())).rejects.toThrow("temporada con ID 1");
      expect(repo.guardar).not.toHaveBeenCalled();
    });

  });

  describe("modificarPaquete (CU-12)", () => {
    const paqueteCategoria = {
      estado: "ACTIVO", tipoGarantia: "POR_CATEGORIA",
      localidadGarantizada: "Cusco", categoriaGarantizada: "3 estrellas", tipoHabitacionGarantizada: "Doble",
    };
    const modificar = (obj: Record<string, unknown>) => ModificarPaqueteDto.create(obj)[1]!;

    it("actualiza solo los campos enviados", async () => {
      await new PaqueteService().modificarPaquete(10, modificar({ nombrePaquete: "Nuevo", nochesPrevias: 1 }));

      expect(repo.update).toHaveBeenCalledWith(10, { nombrePaquete: "Nuevo", nochesPrevias: 1 }, {}, undefined, undefined);
      expect(repo.reemplazarTarifas).not.toHaveBeenCalled();
    });

    it("rechaza cambiar el circuito si el paquete tiene salidas programadas o realizadas (CAT-05, CAT-35)", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, idcircuito: 1, estado: "ACTIVO" });
      repo.tieneSalidasNoCanceladas.mockResolvedValue(true);

      await expect(new PaqueteService().modificarPaquete(10, modificar({ idcircuito: 2 }))).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("permite modificar circuito, garantía y servicios por tipo (CAT-14, B2): reemplaza solo los tipos que vienen", async () => {
      db.circuito.findUnique.mockResolvedValue({ idcircuito: 2, estado: "ACTIVO" });
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", localidadGarantizada: "Cusco", servicios: [] });

      await new PaqueteService().modificarPaquete(10, modificar({
        idcircuito: 2,
        idtren: null,
        equipo: [{ idservicio: 7, cantidad: 2, cadaPasajeros: 3 }],
        tipoGarantia: "POR_ESTABLECIMIENTO",
        idservicioGarantizado: 40,
        diasCierreVenta: 4,
      }));

      expect(repo.update).toHaveBeenCalledWith(
        10,
        { idcircuito: 2, tipoGarantia: "POR_ESTABLECIMIENTO", diasCierreVenta: 4 },
        { tren: [], equipamiento: [{ idservicio: 7, cantidad: 2, cadaPasajeros: 3 }] },
        40,
        "POR_ESTABLECIMIENTO"
      );
    });

    it("B2: cambiar el Sale desde valida que el hotel garantizado esté en esa ciudad", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", tipoGarantia: "POR_ESTABLECIMIENTO", localidadGarantizada: "Cusco", garantiasEstablecimiento: [{ idservicio: 40 }], servicios: [] });

      await expect(new PaqueteService().modificarPaquete(10, modificar({ localidadGarantizada: "Pisac" }))).rejects.toThrow(
        "El hotel garantizado está en Cusco y el paquete sale desde Pisac."
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-08: rechaza idservicioGarantizado en un paquete que queda por categoría", async () => {
      repo.findById.mockResolvedValue({ ...paqueteCategoria, idpaquete: 10 });

      await expect(new PaqueteService().modificarPaquete(10, modificar({ idservicioGarantizado: 40 }))).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-14: pasar a POR_CATEGORIA sin criterios (ni enviados ni previos) es 400", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", tipoGarantia: "POR_ESTABLECIMIENTO", localidadGarantizada: "Cusco", garantiasEstablecimiento: [{ idservicio: 40 }] });

      await expect(new PaqueteService().modificarPaquete(10, modificar({ tipoGarantia: "POR_CATEGORIA" }))).rejects.toThrow("categoriaGarantizada");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-14: pasar a POR_CATEGORIA con criterios completos actualiza (el repo borra la garantía)", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", tipoGarantia: "POR_ESTABLECIMIENTO", garantiasEstablecimiento: [{ idservicio: 40 }], servicios: [] });

      await new PaqueteService().modificarPaquete(10, modificar({
        tipoGarantia: "POR_CATEGORIA", localidadGarantizada: "Cusco", categoriaGarantizada: "3 estrellas", tipoHabitacionGarantizada: "Doble",
      }));

      expect(repo.update).toHaveBeenCalledWith(10, expect.objectContaining({ tipoGarantia: "POR_CATEGORIA" }), {}, undefined, "POR_CATEGORIA");
    });

    it("con matriz nueva valida las temporadas y reemplaza las tarifas", async () => {
      const nuevas = [{ idtemporada: 2, monto: 900, moneda: "USD" }];

      await new PaqueteService().modificarPaquete(10, modificar({ matrizPrecios: nuevas }));

      expect(db.temporada.findUnique).toHaveBeenCalledWith({ where: { idtemporada: 2 } });
      expect(repo.reemplazarTarifas).toHaveBeenCalledWith(10, nuevas);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("no reemplaza tarifas si alguna temporada no está activa", async () => {
      db.temporada.findUnique.mockResolvedValue(null);

      await expect(
        new PaqueteService().modificarPaquete(10, modificar({ matrizPrecios: precios }))
      ).rejects.toThrow("no existe o no está activa");
      expect(repo.reemplazarTarifas).not.toHaveBeenCalled();
    });

    it("CAT-16: con una temporada inactiva no guarda ningún otro cambio", async () => {
      db.temporada.findUnique.mockResolvedValue(null);

      await expect(
        new PaqueteService().modificarPaquete(10, modificar({ nombrePaquete: "Otro", idtransporte: 11, matrizPrecios: precios }))
      ).rejects.toThrow("no existe o no está activa");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-17: rechaza pasar a un circuito sin etapas", async () => {
      repo.findById.mockResolvedValue({ ...paqueteCategoria, idcircuito: 1 });
      repo.tieneSalidasActivas.mockResolvedValue(false);
      db.etapaRuta.count.mockResolvedValue(0);

      await expect(new PaqueteService().modificarPaquete(10, modificar({ idcircuito: 2 }))).rejects.toThrow("etapas");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("404 si el paquete no existe", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(new PaqueteService().modificarPaquete(10, modificar({ nombrePaquete: "X" }))).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("darDeBajaPaquete (CU-13)", () => {
    it("hace la baja lógica", async () => {
      await new PaqueteService().darDeBajaPaquete(10);

      expect(repo.updateEstado).toHaveBeenCalledWith(10, "INACTIVO");
    });

    it("no permite la baja con salidas activas (CAT-02)", async () => {
      repo.tieneSalidasActivas.mockResolvedValue(true);

      await expect(new PaqueteService().darDeBajaPaquete(10)).rejects.toThrow("salidas activas");
      expect(repo.updateEstado).not.toHaveBeenCalled();
    });

    it("404 si ya estaba inactivo", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "INACTIVO" });

      await expect(new PaqueteService().darDeBajaPaquete(10)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
