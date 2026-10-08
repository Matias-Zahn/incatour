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
