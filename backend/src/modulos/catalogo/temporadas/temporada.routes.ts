import { Router } from "express";
import { TemporadaController } from "./temporada.controller";

/**
 * @swagger
 * tags:
 *   name: Temporadas
 *   description: Gestión de Temporadas (CU-06 a CU-09)
 *
 * components:
 *   schemas:
 *     Temporada:
 *       type: object
 *       properties:
 *         idtemporada:
 *           type: integer
 *           example: 1
 *         nombre:
 *           type: string
 *           example: Temporada alta 2026
 *         fechaInicio:
 *           type: string
 *           format: date-time
 *           example: 2026-05-01T00:00:00.000Z
 *         fechaFin:
 *           type: string
 *           format: date-time
 *           example: 2026-09-30T00:00:00.000Z
 *         estado:
 *           type: string
 *           enum: [ACTIVO, INACTIVO]
 *           example: ACTIVO
 *
 * /api/temporadas:
 *   get:
 *     summary: Consultar temporadas (CU-06)
 *     tags: [Temporadas]
 *     responses:
 *       200:
 *         description: Lista de temporadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Temporada'
 *   post:
 *     summary: Crear temporada (CU-07)
 *     tags: [Temporadas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, fechaInicio, fechaFin]
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Temporada alta 2026
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-01
 *               fechaFin:
 *                 type: string
 *                 format: date
 *                 description: Debe ser posterior a fechaInicio
 *                 example: 2026-09-30
 *     responses:
 *       201:
 *         description: Temporada creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Temporada creada exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/Temporada'
 *       400:
 *         description: Datos inválidos, fechas incoherentes o ya existe una temporada activa con ese nombre
 *
 * /api/temporadas/{id}:
 *   put:
 *     summary: Modificar temporada (CU-08)
 *     description: Debe enviarse al menos un campo. La fecha de inicio debe quedar anterior a la de fin.
 *     tags: [Temporadas]
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
 *             properties:
 *               nombre:
 *                 type: string
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *               fechaFin:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Temporada modificada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Temporada'
 *       400:
 *         description: ID o datos inválidos, fechas incoherentes o nombre duplicado
 *       404:
 *         description: Temporada no encontrada o inactiva
 *
 * /api/temporadas/{id}/baja:
 *   patch:
 *     summary: Baja temporada (CU-09)
 *     description: Baja lógica. No se permite si la temporada tiene tarifas de paquetes asociadas.
 *     tags: [Temporadas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Temporada dada de baja exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Temporada'
 *       400:
 *         description: ID inválido o temporada con tarifas de paquetes asociadas
 *       404:
 *         description: Temporada no encontrada o ya inactiva
 */
export class TemporadaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new TemporadaController();

    // CU-06: Consultar Temporadas
    router.get("/", controller.consultarTemporadas);

    // CU-07: Crear Temporada
    router.post("/", controller.crearTemporada);

    // CU-08: Modificar Temporada
    router.put("/:id", controller.modificarTemporada);

    // CU-09: Baja Temporada
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
