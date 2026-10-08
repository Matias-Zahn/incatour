import { Router } from "express";
import { PaqueteController } from "./paquete.controller";

/**
 * @swagger
 * tags:
 *   name: Paquetes
 *   description: Gestión del CRUD de Paquetes Turísticos
 * 
 * /api/paquetes:
 *   get:
 *     summary: Listar paquetes activos
 *     tags: [Paquetes]
 *     responses:
 *       200:
 *         description: Lista de paquetes obtenida exitosamente
 *   post:
 *     summary: Crear Paquete Turístico (CU-10)
 *     tags: [Paquetes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idcircuito:
 *                 type: integer
 *               nombrePaquete:
 *                 type: string
 *               tipoGarantia:
 *                 type: string
 *               idservicioGarantizado:
 *                 type: integer
 *               nochesPrevias:
 *                 type: integer
 *               nochesPosteriores:
 *                 type: integer
 *               matrizPrecios:
 *                 type: array
 *                 items:
 *                   type: object
 *               serviciosIncluidos:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Paquete creado exitosamente
 * 
 * /api/paquetes/{id}:
 *   get:
 *     summary: Obtener paquete por ID
 *     tags: [Paquetes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paquete encontrado
 *   put:
 *     summary: Modificar Paquete (CU-12)
 *     tags: [Paquetes]
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
 *     responses:
 *       200:
 *         description: Paquete modificado exitosamente
 * 
 * /api/paquetes/{id}/baja:
 *   patch:
 *     summary: Dar de baja Paquete (CU-13)
 *     tags: [Paquetes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paquete dado de baja exitosamente
 */
export class PaqueteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PaqueteController();

    // Consultar paquetes activos
    router.get("/", controller.consultarPaquetes);

    // Consultar paquete por ID
    router.get("/:id", controller.consultarPaquetePorId);

    // CU-10: Crear Paquete Turístico
    router.post("/", controller.confirmarCreacion);

    // CU-12: Modificar Paquete
    router.put("/:id", controller.modificarPaquete);

    // CU-13: Baja de Paquete
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
