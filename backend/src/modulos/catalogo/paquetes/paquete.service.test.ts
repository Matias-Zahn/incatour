import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaqueteService } from "./paquete.service";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";

// El servicio valida contra Prisma directamente (circuito, etapas, servicios, temporadas): se mockea `db`
const { repo, db } = vi.hoisted(() => ({
  repo: {
    findAll: vi.fn(), findById: vi.fn(), guardar: vi.fn(), update: vi.fn(), updateEstado: vi.fn(),
    reemplazarTarifas: vi.fn(), tieneSalidasActivas: vi.fn(), contarPaquetes: vi.fn(),
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
  matrizPrecios: precios,
};
const crear = (obj: Record<string, unknown> = {}) => CrearPaqueteDto.create({ ...porCategoria, ...obj })[1]!;
const porEstablecimiento = () =>
  crear({ tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: 40, localidadGarantizada: undefined, categoriaGarantizada: undefined, tipoHabitacionGarantizada: undefined });
const hotel = (modalidadConfirmacion = "BLOQUEO_PLAZAS", estado = "ACTIVO", proveedorEstado = "ACTIVO") => ({
  idservicio: 40, estado, alojamiento: { modalidadConfirmacion }, proveedor: { estado: proveedorEstado },
});

describe("PaqueteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.circuito.findUnique.mockResolvedValue({ idcircuito: 1, estado: "ACTIVO" });
    db.etapaRuta.count.mockResolvedValue(3);
    db.temporada.findUnique.mockResolvedValue({ idtemporada: 1, estado: "ACTIVO" });
    db.servicioBase.findUnique.mockResolvedValue(hotel());
    repo.contarPaquetes.mockResolvedValue(6);
    repo.guardar.mockImplementation(async (datos) => ({ idpaquete: 10, ...datos }));
    repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO" });
    repo.tieneSalidasActivas.mockResolvedValue(false);
  });

  describe("consultarPaquetes (CU-10)", () => {
    it("lista los paquetes y pasa filtros (CAT-13)", async () => {
      repo.findAll.mockResolvedValue([{ idpaquete: 1 }]);

      const filtros = { estado: "INACTIVO", idcircuito: 1 };
      await expect(new PaqueteService().consultarPaquetes(filtros)).resolves.toHaveLength(1);
      expect(repo.findAll).toHaveBeenCalledWith(filtros);
    });

    it("404 al pedir un paquete inactivo", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "INACTIVO" });

      await expect(new PaqueteService().consultarPaquetePorId(10)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("registrarNuevoPaquete (CU-11)", () => {
    it("guarda el paquete activo con número correlativo, tarifas y servicios", async () => {
      const p = await new PaqueteService().registrarNuevoPaquete(crear({ serviciosIncluidos: [40, 41] }));

      expect(p).toMatchObject({ nroPaquete: "PKG-0007", estado: "ACTIVO", nochesPrevias: 0, nochesPosteriores: 0 });
      expect(repo.guardar).toHaveBeenCalledWith(expect.objectContaining({ idcircuito: 1, tipoGarantia: "POR_CATEGORIA" }), precios, [40, 41]);
    });

    it("con garantía por categoría no consulta ningún establecimiento", async () => {
      await new PaqueteService().registrarNuevoPaquete(crear());

      expect(db.servicioBase.findUnique).not.toHaveBeenCalled();
    });

    it("acepta garantía por establecimiento si el hotel confirma por bloqueo de plazas", async () => {
      await new PaqueteService().registrarNuevoPaquete(porEstablecimiento());

      expect(db.servicioBase.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idservicio: 40 } }));
      expect(repo.guardar).toHaveBeenCalled();
    });

    it("FA2: rechaza garantía por establecimiento si el hotel confirma a solicitud", async () => {
      db.servicioBase.findUnique.mockResolvedValue(hotel("A_SOLICITUD"));

      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento())).rejects.toThrow("bloqueo de plazas");
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it("rechaza garantizar un servicio que no es de alojamiento", async () => {
      db.servicioBase.findUnique.mockResolvedValue({ idservicio: 40, estado: "ACTIVO", alojamiento: null, proveedor: { estado: "ACTIVO" } });

      await expect(new PaqueteService().registrarNuevoPaquete(porEstablecimiento())).rejects.toThrow("no es un servicio de alojamiento");
    });

    it("rechaza garantizar un hotel inactivo", async () => {
      db.servicioBase.findUnique.mockResolvedValue(hotel("BLOQUEO_PLAZAS", "INACTIVO"));

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

    it("rechaza un servicio incluido inexistente", async () => {
      db.servicioBase.findUnique.mockResolvedValueOnce(hotel()).mockResolvedValueOnce(null);

      await expect(new PaqueteService().registrarNuevoPaquete(crear({ serviciosIncluidos: [40, 99] }))).rejects.toThrow("servicio con ID 99");
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

      expect(repo.update).toHaveBeenCalledWith(10, { nombrePaquete: "Nuevo", nochesPrevias: 1 }, undefined, undefined, undefined);
      expect(repo.reemplazarTarifas).not.toHaveBeenCalled();
    });

    it("rechaza cambiar el circuito si el paquete tiene salidas activas (CAT-05)", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, idcircuito: 1, estado: "ACTIVO" });
      repo.tieneSalidasActivas.mockResolvedValue(true);

      await expect(new PaqueteService().modificarPaquete(10, modificar({ idcircuito: 2 }))).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("permite modificar circuito, garantía y servicios incluidos (CAT-14)", async () => {
      db.circuito.findUnique.mockResolvedValue({ idcircuito: 2, estado: "ACTIVO" });

      await new PaqueteService().modificarPaquete(10, modificar({
        idcircuito: 2,
        serviciosIncluidos: [40],
        tipoGarantia: "POR_ESTABLECIMIENTO",
        idservicioGarantizado: 40,
      }));

      expect(repo.update).toHaveBeenCalledWith(
        10,
        { idcircuito: 2, tipoGarantia: "POR_ESTABLECIMIENTO" },
        [40],
        40,
        "POR_ESTABLECIMIENTO"
      );
    });

    it("CAT-08: rechaza idservicioGarantizado en un paquete que queda por categoría", async () => {
      repo.findById.mockResolvedValue({ ...paqueteCategoria, idpaquete: 10 });

      await expect(new PaqueteService().modificarPaquete(10, modificar({ idservicioGarantizado: 40 }))).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-14: pasar a POR_CATEGORIA sin criterios (ni enviados ni previos) es 400", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", tipoGarantia: "POR_ESTABLECIMIENTO", garantiasEstablecimiento: [{ idservicio: 40 }] });

      await expect(new PaqueteService().modificarPaquete(10, modificar({ tipoGarantia: "POR_CATEGORIA" }))).rejects.toThrow("localidadGarantizada");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("CAT-14: pasar a POR_CATEGORIA con criterios completos actualiza (el repo borra la garantía)", async () => {
      repo.findById.mockResolvedValue({ idpaquete: 10, estado: "ACTIVO", tipoGarantia: "POR_ESTABLECIMIENTO", garantiasEstablecimiento: [{ idservicio: 40 }] });

      await new PaqueteService().modificarPaquete(10, modificar({
        tipoGarantia: "POR_CATEGORIA", localidadGarantizada: "Cusco", categoriaGarantizada: "3 estrellas", tipoHabitacionGarantizada: "Doble",
      }));

      expect(repo.update).toHaveBeenCalledWith(10, expect.objectContaining({ tipoGarantia: "POR_CATEGORIA" }), undefined, undefined, "POR_CATEGORIA");
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
        new PaqueteService().modificarPaquete(10, modificar({ nombrePaquete: "Otro", serviciosIncluidos: [], matrizPrecios: precios }))
      ).rejects.toThrow("no existe o no está activa");
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
