import { Router } from "express";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";
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
 *     security:
 *       - BearerAuth: []
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
 *     security:
 *       - BearerAuth: []
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
 *             type: object
 *             required: [etapas]
 *             properties:
 *               etapas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [numeroOrden, puntoInicio, puntoFin]
 *                   properties:
 *                     numeroOrden: { type: integer, example: 1 }
 *                     puntoInicio: { type: string, example: "Km 82" }
 *                     puntoFin: { type: string, example: "Wayllabamba" }
 *                     campamentoPrevisto: { type: string, example: "Camp 1" }
 *     responses:
 *       200:
 *         description: Secuencia de etapas actualizada exitosamente
 *       400:
 *         description: Error de validación de correlatividad, paquetes activos sobre el circuito o etapas con avances registrados
 */
export class EtapaRoutes {
  static get getRoutes(): Router {
    // mergeParams: true es crucial para que podamos leer el :idcircuito 
    // cuando este router se monta desde app.ts o circuito.routes.ts
    const router = Router({ mergeParams: true });
    const controller = new EtapaController();

    // Gestión interna: solo el administrador (el catálogo público va por /api/catalogo)
    router.use(autenticar, requierePerfil("ADMIN"));

    // GET /api/circuitos/:idcircuito/etapas
    router.get("/", controller.consultarEtapas);

    // PUT /api/circuitos/:idcircuito/etapas (DSS: Bulk Replace)
    router.put("/", controller.confirmarSecuenciaCompleta);

    return router;
  }
}
