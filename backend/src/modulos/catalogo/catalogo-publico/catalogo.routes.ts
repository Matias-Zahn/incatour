import { Router } from "express";
import { CatalogoController } from "./catalogo.controller";

/**
 * @swagger
 * /api/catalogo:
 *   get:
 *     summary: Catálogo Público de Paquetes
 *     description: Retorna todos los paquetes vigentes optimizados para el Frontend (Escaparate).
 *     tags:
 *       - Catálogo Público
 *     parameters:
 *       - in: query
 *         name: dificultad
 *         schema:
 *           type: string
 *         description: Filtrar por dificultad (ej. Fácil, Moderada, Alta)
 *       - in: query
 *         name: duracionDias
 *         schema:
 *           type: integer
 *         description: Filtrar por duración en días
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha desde (YYYY-MM-DD)
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha hasta (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Lista de paquetes exitosa
 */
export class CatalogoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CatalogoController();

    // GET /api/catalogo
    router.get("/", controller.consultarCatalogoPublico);

    return router;
  }
}
