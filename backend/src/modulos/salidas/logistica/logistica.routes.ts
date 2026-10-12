import { Router } from "express";
import { LogisticaController } from "./logistica.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class LogisticaRoutes {
  /** En app.ts: app.use("/api/salidas", LogisticaRoutes.getRoutes) */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new LogisticaController();

    // Toda la logística es exclusiva del administrador
    router.use("/:idsalida/logistica", autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * /api/salidas/{idsalida}/logistica:
     *   get:
     *     summary: Panel de logística de una salida (CU-39, paso 2)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Muestra el equipamiento y el transporte asignados con su proveedor
     *       y la lista de requerimientos sin asignar (`TRANSPORTE` si la salida no tiene transporte).
     *     tags: [Logística de salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Panel de logística.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data: { $ref: '#/components/schemas/PanelLogistica' }
     *       404:
     *         description: La salida no existe.
     */
    router.get("/:idsalida/logistica", controller.obtenerPanelLogistica);

    /**
     * @swagger
     * /api/salidas/{idsalida}/logistica/disponibles:
     *   get:
     *     summary: Proveedores disponibles para reasignar (CU-39, paso 5)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** EQUIPAMIENTO: servicios activos con stock. TRANSPORTE: servicios
     *       activos, de proveedores activos, con capacidad para los pasajeros confirmados y sin otra salida
     *       activa en las mismas fechas. Solo para salidas que no comenzaron.
     *     tags: [Logística de salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: tipo
     *         required: true
     *         schema: { type: string, enum: [EQUIPAMIENTO, TRANSPORTE] }
     *     responses:
     *       200:
     *         description: Servicios disponibles.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       idservicio: { type: integer }
     *                       nombreServicio: { type: string }
     *                       localidad: { type: string }
     *                       costoBase: { type: number }
     *                       proveedor: { type: object, properties: { idproveedor: { type: integer }, razonSocial: { type: string } } }
     *                       disponibilidad: { type: object }
     *       400:
     *         description: Tipo inválido o salida que ya comenzó.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: La salida no existe.
     */
    router.get("/:idsalida/logistica/disponibles", controller.consultarDisponibles);

    /**
     * @swagger
     * /api/salidas/{idsalida}/logistica:
     *   put:
     *     summary: Modificar la logística de una salida (CU-39)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** En una única transacción primero **desasigna** (reintegra al stock
     *       del proveedor original) y luego **asigna** (descuenta del stock del nuevo proveedor, de forma
     *       atómica), de modo que si algo falla no se aplica nada. Cambiar la cantidad de un equipamiento
     *       equivale a desasignarlo y volver a asignarlo. El transporte nuevo requiere el comprobante de la
     *       reserva externa. El motivo es opcional y, junto con el antes y el después, queda en la auditoría.
     *       Si se desasigna el transporte sin reemplazo, la respuesta lo informa como "Sin asignar".
     *       Solo procede en salidas que no comenzaron. El personal se reemplaza por el CU-38.
     *     tags: [Logística de salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               itemsDesasignar:
     *                 type: array
     *                 items:
     *                   type: object
     *                   required: [tipo, idservicio]
     *                   properties:
     *                     tipo: { type: string, enum: [EQUIPAMIENTO, TRANSPORTE] }
     *                     idservicio: { type: integer, example: 7 }
     *               itemsNuevos:
     *                 type: array
     *                 items:
     *                   type: object
     *                   required: [tipo, idservicio]
     *                   properties:
     *                     tipo: { type: string, enum: [EQUIPAMIENTO, TRANSPORTE] }
     *                     idservicio: { type: integer, example: 9 }
     *                     cantidad: { type: integer, minimum: 1, description: Obligatoria para EQUIPAMIENTO. }
     *                     comprobanteReserva: { type: string, description: Obligatorio para TRANSPORTE. , example: RES-EXT-2291 }
     *               motivo: { type: string, maxLength: 300, example: El proveedor original canceló el servicio }
     *     responses:
     *       200:
     *         description: Logística modificada.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data:
     *                   type: object
     *                   properties:
     *                     panel: { $ref: '#/components/schemas/PanelLogistica' }
     *                     advertencias: { type: array, items: { type: string } }
     *       400:
     *         description: Datos inválidos, stock insuficiente, transporte no disponible o salida que ya comenzó.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: La salida no existe.
     */
    router.put("/:idsalida/logistica", controller.confirmarModificacion);

    return router;
  }
}