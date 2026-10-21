import { Router } from "express";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";
import { CircuitoController } from "./circuito.controller";

/**
 * @swagger
 * tags:
 *   name: Circuitos
 *   description: Gestión de Circuitos Turísticos (CU-01 a CU-04)
 *
 * components:
 *   schemas:
 *     Circuito:
 *       type: object
 *       properties:
 *         idcircuito:
 *           type: integer
 *           example: 1
 *         nombreCircuito:
 *           type: string
 *           example: Camino Inca Clásico
 *         duracionDias:
 *           type: integer
 *           example: 4
 *         dificultad:
 *           type: string
 *           example: MEDIA
 *         minimoGuias:
 *           type: integer
 *           example: 1
 *         parametrosPorteadores:
 *           type: string
 *           nullable: true
 *           example: 1 porteador cada 2 pasajeros
 *         estado:
 *           type: string
 *           enum: [ACTIVO, INACTIVO]
 *           example: ACTIVO
 *
 * /api/circuitos:
 *   get:
 *     summary: Consultar circuitos turísticos (CU-01)
 *     tags: [Circuitos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: duracionDias
 *         schema:
 *           type: integer
 *         description: Filtrar por duración en días
 *       - in: query
 *         name: dificultad
 *         schema:
 *           type: string
 *         description: Filtrar por dificultad (ej. Fácil, Moderada, Alta)
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [ACTIVO, INACTIVO]
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de circuitos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Circuito'
 *   post:
 *     summary: Crear circuito turístico (CU-02)
 *     tags: [Circuitos]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombreCircuito, duracionDias, dificultad, minimoGuias]
 *             properties:
 *               nombreCircuito:
 *                 type: string
 *                 example: Camino Inca Clásico
 *               duracionDias:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *               dificultad:
 *                 type: string
 *                 example: MEDIA
 *               minimoGuias:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               parametrosPorteadores:
 *                 type: string
 *                 example: 1 porteador cada 2 pasajeros
 *     responses:
 *       201:
 *         description: Circuito creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: Circuito creado exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/Circuito'
 *       400:
 *         description: Datos inválidos o ya existe un circuito activo con ese nombre
 *
 * /api/circuitos/{id}:
 *   put:
 *     summary: Modificar circuito turístico (CU-03)
 *     description: Debe enviarse al menos un campo. Solo se pueden modificar circuitos activos.
 *     tags: [Circuitos]
 *     security:
 *       - BearerAuth: []
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
 *               nombreCircuito:
 *                 type: string
 *               duracionDias:
 *                 type: integer
 *                 minimum: 1
 *               dificultad:
 *                 type: string
 *               minimoGuias:
 *                 type: integer
 *                 minimum: 1
 *               parametrosPorteadores:
 *                 type: string
 *     responses:
 *       200:
 *         description: Circuito modificado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Circuito'
 *       400:
 *         description: ID o datos inválidos, circuito inactivo o nombre duplicado
 *       404:
 *         description: Circuito no encontrado
 *
 * /api/circuitos/{id}/baja:
 *   patch:
 *     summary: Baja circuito turístico (CU-04)
 *     description: Baja lógica. No se permite si el circuito tiene paquetes activos asociados.
 *     tags: [Circuitos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Circuito dado de baja exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Circuito'
 *       400:
 *         description: ID inválido, circuito ya inactivo o con paquetes activos
 *       404:
 *         description: Circuito no encontrado
 */
export class CircuitoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CircuitoController();

    // Gestión interna: solo el administrador (el catálogo público va por /api/catalogo)
    router.use(autenticar, requierePerfil("ADMIN"));

    // CU-01: Consultar circuitos
    router.get("/", controller.consultarCircuitos);

    // CU-02: Crear circuito
    router.post("/", controller.crearCircuito);

    // CU-03: Modificar circuito
    router.put("/:id", controller.modificarCircuito);

    // CU-04: Baja lógica de circuito
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
