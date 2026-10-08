import { Router } from "express";
import { EtapaController } from "./etapa.controller";

/**
 * @swagger
 * tags:
 *   name: Etapas
 *   description: Gestión de etapas de circuitos (Bulk Replace)
 * 
 * /api/circuitos/{idcircuito}/etapas:
 *   get:
 *     summary: Listar etapas de un circuito
 *     tags: [Etapas]
 *     parameters:
 *       - in: path
 *         name: idcircuito
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de etapas obtenida exitosamente
 *   put:
 *     summary: Reemplazo masivo de etapas (CU-05)
 *     description: Borra las etapas actuales y las reemplaza por las nuevas provistas, validando correlatividad.
 *     tags: [Etapas]
 *     parameters:
 *       - in: path
 *         name: idcircuito
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 numeroOrden:
 *                   type: integer
 *                 puntoInicio:
 *                   type: string
 *                 puntoFin:
 *                   type: string
 *     responses:
 *       200:
 *         description: Secuencia de etapas actualizada exitosamente
 *       400:
 *         description: Error de validación de correlatividad
 */
export class EtapaRoutes {
  static get getRoutes(): Router {
    // mergeParams: true es crucial para que podamos leer el :idcircuito 
    // cuando este router se monta desde app.ts o circuito.routes.ts
    const router = Router({ mergeParams: true });
    const controller = new EtapaController();

    // GET /api/circuitos/:idcircuito/etapas
    router.get("/", controller.consultarEtapas);

    // PUT /api/circuitos/:idcircuito/etapas (DSS: Bulk Replace)
    router.put("/", controller.confirmarSecuenciaCompleta);

    return router;
  }
}
