import { Router } from "express";
import { SolicitudController } from "./solicitud.controller";

/**
 * @swagger
 * /api/solicitudes:
 *   get:
 *     summary: Consultar Solicitudes Pendientes (CU-33)
 *     description: Retorna todas las solicitudes de alojamiento que están pendientes de confirmación.
 *     tags:
 *       - Solicitudes de Alojamiento
 *     responses:
 *       200:
 *         description: Lista de solicitudes pendientes
 * 
 * /api/solicitudes/{id}/opciones:
 *   get:
 *     summary: Obtener Opciones de Alojamiento (CU-34 Fase 1)
 *     description: Busca hoteles compatibles con las garantías del paquete, excluyendo los ya rechazados.
 *     tags:
 *       - Solicitudes de Alojamiento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Opciones de contacto para la solicitud
 *       400:
 *         description: Error en la solicitud o ID inválido
 *       409:
 *         description: No hay hoteles compatibles (bloquea consolidación)
 * 
 * /api/solicitudes/{id}/resolver:
 *   post:
 *     summary: Resolver Solicitud (CU-34 Fase 2)
 *     description: Registra la aceptación o rechazo por parte del proveedor. Si es rechazada, genera un reintento automático.
 *     tags:
 *       - Solicitudes de Alojamiento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - servicioId
 *               - resolucion
 *             properties:
 *               servicioId:
 *                 type: integer
 *               resolucion:
 *                 type: string
 *                 enum: [ACEPTADA, RECHAZADA]
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resolución procesada exitosamente
 */
export class SolicitudRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new SolicitudController();

    // CU-33
    router.get("/", controller.consultarPendientes);

    // CU-34
    router.get("/:id/opciones", controller.obtenerOpcionesAlojamiento);
    router.post("/:id/resolver", controller.resolverSolicitud);

    return router;
  }
}
