import { Router } from "express";
import { ProveedorController } from "./proveedor.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ProveedorRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ProveedorController();

    // Todo el módulo de proveedores es exclusivo del administrador
    router.use(autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * /api/proveedores:
     *   get:
     *     summary: Consultar proveedores (CU-14)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista los proveedores con su razón social, tipo,
     *       localidad, datos de contacto, canal habitual de comunicación y estado.
     *       Incluye inactivos salvo que se filtre por estado.
     *     tags: [Proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: tipoProveedor
     *         schema: { type: string, enum: [ALOJAMIENTO, TRANSPORTE, TREN, EQUIPAMIENTO] }
     *       - in: query
     *         name: localidad
     *         schema: { type: string }
     *         description: Coincidencia parcial, sin distinguir mayúsculas.
     *       - in: query
     *         name: estado
     *         schema: { type: string, enum: [ACTIVO, INACTIVO] }
     *     responses:
     *       200:
     *         description: Listado de proveedores.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/Proveedor' }
     *       400:
     *         description: Filtro inválido.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.get("/", controller.consultarProveedores);

    /**
     * @swagger
     * /api/proveedores/{id}:
     *   get:
     *     summary: Obtener un proveedor
     *     tags: [Proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Proveedor encontrado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data: { $ref: '#/components/schemas/Proveedor' }
     *       400:
     *         description: ID inválido.
     *       404:
     *         description: El proveedor no existe.
     */
    router.get("/:id", controller.obtenerProveedor);

    /**
     * @swagger
     * /api/proveedores:
     *   post:
     *     summary: Alta de proveedor (CU-15)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** El tipo (rubro) del proveedor define qué servicios
     *       podrá registrar después (CU-19). No puede haber dos proveedores activos con la misma
     *       razón social en la misma localidad.
     *     tags: [Proveedores]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ProveedorCrear' }
     *     responses:
     *       201:
     *         description: Proveedor registrado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Proveedor' }
     *       400:
     *         description: Datos inválidos o proveedor duplicado.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.post("/", controller.crearProveedor);

    /**
     * @swagger
     * /api/proveedores/{id}:
     *   put:
     *     summary: Modificar proveedor (CU-16)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Se envía solo lo que cambia. Reglas: no se puede
     *       cambiar el tipo si el proveedor ya tiene servicios, y pasar el estado a INACTIVO
     *       aplica las mismas validaciones que la baja (CU-17). Reactivar (INACTIVO a ACTIVO) está permitido.
     *     tags: [Proveedores]
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
     *           schema: { $ref: '#/components/schemas/ProveedorModificar' }
     *     responses:
     *       200:
     *         description: Proveedor modificado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Proveedor' }
     *       400:
     *         description: Datos inválidos, duplicado, cambio de tipo con servicios o baja bloqueada.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: El proveedor no existe.
     */
    router.put("/:id", controller.modificarProveedor);

    /**
     * @swagger
     * /api/proveedores/{id}/baja:
     *   patch:
     *     summary: Baja lógica de proveedor (CU-17)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Pasa el estado a INACTIVO sin borrar el registro ni
     *       alterar el historial. Se bloquea si el proveedor tiene solicitudes de alojamiento
     *       pendientes ("Error. El proveedor tiene solicitudes pendientes") o servicios asignados
     *       a salidas activas o en curso ("Error. El proveedor cuenta con salidas activas").
     *     tags: [Proveedores]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Proveedor dado de baja.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Proveedor' }
     *       400:
     *         description: Ya estaba dado de baja o tiene dependencias activas.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: El proveedor no existe.
     */
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}