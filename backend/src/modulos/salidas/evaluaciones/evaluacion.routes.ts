import { Router } from "express";
import { EvaluacionController } from "./evaluacion.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class EvaluacionRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new EvaluacionController();

    /**
     * @swagger
     * /api/salidas/evaluaciones-pendientes:
     *   get:
     *     summary: Evaluaciones que le faltan a cada salida finalizada (CU-42)
     *     description: "**RESTRINGIDO A ADMINISTRADOR.** Cuenta el personal y los proveedores sin evaluar de cada salida FINALIZADA."
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Pendientes por salida.
     *         content:
     *           application/json:
     *             example:
     *               data: [{ idsalida: 1, pendientes: 3 }]
     */
    router.get("/evaluaciones-pendientes", autenticar, requierePerfil("ADMIN"), controller.consultarPendientes);

    /**
     * @swagger
     * /api/salidas/{idsalida}/evaluaciones:
     *   get:
     *     summary: Personal y proveedores evaluables de una salida (CU-42)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista el personal que participó de la salida y los proveedores que dieron
     *       algún servicio (alojamiento, transporte, tren o equipamiento), con su evaluación si ya la tienen.
     *       Solo para salidas FINALIZADAS.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Evaluables de la salida.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 salida: { idsalida: 1, nroSalida: SAL-2026-001 }
     *                 personal: [{ idpersonal: 1, nombreCompleto: Carlos Mamani, rol: Guía, evaluacion: null }]
     *                 proveedores: [{ idproveedor: 1, razonSocial: Andes Travel, evaluacion: { puntaje: 4, comentario: Puntual } }]
     *       400: { description: La salida no está finalizada. }
     *       404: { description: La salida no existe. }
     *   post:
     *     summary: Evaluar personal o proveedor (CU-42)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Califica de 1 a 5 a una persona que participó de la salida o a un proveedor
     *       que dio servicio en ella. Una sola evaluación por salida y por evaluado. Las evaluaciones se consultan en
     *       GET /api/resenias (CU-43).
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [tipo, id, puntaje]
     *             properties:
     *               tipo: { type: string, enum: [PERSONAL, PROVEEDOR] }
     *               id: { type: integer, example: 1, description: idpersonal o idproveedor según el tipo. }
     *               puntaje: { type: integer, minimum: 1, maximum: 5, example: 4 }
     *               comentario: { type: string, example: Muy buena atención al grupo, description: Opcional, hasta 500 caracteres. }
     *     responses:
     *       201: { description: Evaluación registrada. }
     *       400: { description: Datos inválidos, salida no finalizada, evaluado que no participó o ya evaluado. }
     *       404: { description: La salida no existe. }
     */
    router.get("/:idsalida/evaluaciones", autenticar, requierePerfil("ADMIN"), controller.consultarEvaluables);
    router.post("/:idsalida/evaluaciones", autenticar, requierePerfil("ADMIN"), controller.evaluar);

    return router;
  }
}
