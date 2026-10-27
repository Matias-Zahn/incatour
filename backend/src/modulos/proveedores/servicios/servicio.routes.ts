import { Router } from "express";
import { ServicioController } from "./servicio.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ServicioRoutes {
  /**
   * Rutas anidadas bajo el proveedor.
   * En app.ts: app.use("/api/proveedores/:idproveedor/servicios", ServicioRoutes.getRoutesPorProveedor)
   * (mergeParams permite leer :idproveedor, igual que en etapas de circuito).
   */
  static get getRoutesPorProveedor(): Router {
    const router = Router({ mergeParams: true });
    const controller = new ServicioController();

    router.use(autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * /api/proveedores/{idproveedor}/servicios:
     *   get:
     *     summary: Consultar servicios de un proveedor (CU-18)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista los servicios del proveedor con las condiciones
     *       propias de su rubro y su disponibilidad. Para EQUIPAMIENTO la disponibilidad informa
     *       `cantidadDisponible` (libre), `cantidadComprometida` (en salidas activas) e `inventarioTotal`.
     *     tags: [Servicios de proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idproveedor
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: estado
     *         schema: { type: string, enum: [ACTIVO, INACTIVO] }
     *     responses:
     *       200:
     *         description: Servicios del proveedor.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/Servicio' }
     *       400:
     *         description: ID o filtro inválido.
     *       404:
     *         description: El proveedor no existe.
     */
    router.get("/", controller.consultarServiciosProveedor);

    /**
     * @swagger
     * /api/proveedores/{idproveedor}/servicios:
     *   post:
     *     summary: Registrar servicio de un proveedor (CU-19)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** El `tipo` debe coincidir con el rubro del proveedor,
     *       que además debe estar ACTIVO. Alojamiento: localidad, categoría, tipo de habitación,
     *       capacidad y modalidad de confirmación. Transporte: capacidad, peso de equipaje incluido
     *       y costo por kg excedente. Tren: horarios y días de operación. Equipamiento: tipo y cantidad disponible.
     *     tags: [Servicios de proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idproveedor
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ServicioCrear' }
     *     responses:
     *       201:
     *         description: Servicio registrado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Servicio' }
     *       400:
     *         description: Datos inválidos, tipo distinto al del proveedor, proveedor inactivo o nombre duplicado.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: El proveedor no existe.
     */
    router.post("/", controller.registrarServicio);

    return router;
  }

  /** En app.ts: app.use("/api/servicios", ServicioRoutes.getRoutes) */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ServicioController();

    router.use(autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * /api/servicios/{id}:
     *   get:
     *     summary: Obtener servicio para su edición (CU-20, solicitarEdicionServicio)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Devuelve los datos actuales y un bloque `edicion` con los
     *       campos editables según el tipo, si el servicio está en uso en salidas activas y si garantiza
     *       a un paquete activo. Si `aplicaSoloAFuturasSalidas` es true, un cambio estructural generará
     *       una versión nueva del servicio.
     *     tags: [Servicios de proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Servicio con su información de edición.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   allOf:
     *                     - $ref: '#/components/schemas/Servicio'
     *                     - type: object
     *                       properties:
     *                         edicion:
     *                           type: object
     *                           properties:
     *                             camposEditables: { type: array, items: { type: string } }
     *                             enUsoEnSalidasActivas: { type: boolean }
     *                             garantizaPaquetesActivos: { type: boolean }
     *                             aplicaSoloAFuturasSalidas: { type: boolean }
     *       404:
     *         description: El servicio no existe.
     */
    router.get("/:id", controller.solicitarEdicionServicio);

    /**
     * @swagger
     * /api/servicios/{id}:
     *   put:
     *     summary: Modificar servicio de un proveedor (CU-20)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Se envía solo lo que cambia.
     *
     *       Reglas: (1) siempre se edita en el lugar (sin versionar): lo ofrecido en cada salida
     *       está en su foto del paquete. Un transporte asignado a salidas activas no puede quedar con capacidad
     *       menor a sus pasajeros confirmados y un alojamiento en salidas activas no puede cambiar localidad,
     *       categoría, tipo de habitación ni modalidad de confirmación. (2) En equipamiento se
     *       edita `inventarioTotal` (inventario físico real) y no puede quedar por debajo de lo comprometido
     *       en salidas activas. (3) Un alojamiento garantizado por un paquete activo no puede cambiar
     *       localidad, categoría ni tipo de habitación, y debe mantener el bloqueo de plazas.
     *       Las reservas ya contratadas no se alteran: conservan su precio congelado.
     *     tags: [Servicios de proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ServicioModificar' }
     *     responses:
     *       200:
     *         description: Servicio modificado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Servicio' }
     *       400:
     *         description: Datos inválidos, campo ajeno al tipo, stock inferior al comprometido o garantía en riesgo.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: El servicio no existe.
     */
    router.put("/:id", controller.modificarServicio);

    /**
     * @swagger
     * /api/servicios/{id}/baja:
     *   patch:
     *     summary: Baja lógica de servicio (CU-21)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Pasa el servicio a INACTIVO sin borrarlo. Se bloquea si
     *       tiene solicitudes de alojamiento pendientes, si está asignado a salidas activas o en curso,
     *       o si es el establecimiento garantizado por un paquete activo.
     *     tags: [Servicios de proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Servicio dado de baja.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Servicio' }
     *       400:
     *         description: Ya estaba dado de baja o tiene dependencias activas.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: El servicio no existe.
     */
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}