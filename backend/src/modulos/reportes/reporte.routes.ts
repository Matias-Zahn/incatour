import { Router } from "express";
import { autenticar, requierePerfil } from "../../shared/auth/auth.middleware";
import { ReporteController } from "./reporte.controller";

/**
 * @swagger
 * /api/reportes/ventas:
 *   get:
 *     summary: Ventas del período por paquete y por mes
 *     tags:
 *       - Reportes
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: Reporte generado
 *       400:
 *         description: Período inválido
 * /api/reportes/ocupacion:
 *   get:
 *     summary: Ocupación de las salidas por fecha de inicio
 *     tags:
 *       - Reportes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte generado
 * /api/reportes/cancelaciones:
 *   get:
 *     summary: Cancelaciones y reintegros del período
 *     tags:
 *       - Reportes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte generado
 * /api/reportes/solicitudes:
 *   get:
 *     summary: Historial de solicitudes a hoteles, con cada respuesta de los proveedores
 *     tags:
 *       - Reportes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte generado
 * /api/reportes/calidad:
 *   get:
 *     summary: Reseñas, incidentes y evaluaciones de proveedores y personal
 *     tags:
 *       - Reportes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte generado
 */
export class ReporteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ReporteController();

    router.use(autenticar, requierePerfil("ADMIN"));

    router.get("/ventas", controller.generar("ventas"));
    router.get("/ocupacion", controller.generar("ocupacion"));
    router.get("/cancelaciones", controller.generar("cancelaciones"));
    router.get("/solicitudes", controller.generar("solicitudes"));
    router.get("/calidad", controller.generar("calidad"));

    return router;
  }
}
