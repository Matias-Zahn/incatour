import { Router } from "express";
import { ReseniaController } from "./resenia.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ReseniaRoutes {
  /** En app.ts: app.use("/api/resenias", ReseniaRoutes.getRoutes) */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ReseniaController();

    /**
     * @swagger
     * /api/resenias/historial-reservas:
     *   get:
     *     summary: Historial de reservas del cliente para reseñar (CU-47, pasos 1 a 4)
     *     description: >
     *       **RESTRINGIDO A CLIENTE.** Lista las reservas del cliente con los datos de su salida y la
     *       reseña ya publicada (si existe). `puedeResenar` es true cuando la reserva está Confirmada,
     *       la salida está Finalizada y todavía no hay reseña del cliente para esa salida.
     *     tags: [Reseñas]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Historial de reservas.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       idreserva: { type: integer }
     *                       nroReserva: { type: string }
     *                       estadoReserva: { type: string }
     *                       puedeResenar: { type: boolean }
     *                       resenia: { nullable: true, allOf: [ { $ref: '#/components/schemas/Resenia' } ] }
     *                       salida:
     *                         type: object
     *                         properties:
     *                           idsalida: { type: integer }
     *                           nroSalida: { type: string }
     *                           estado: { type: string }
     *                           fechaInicio: { type: string, format: date-time }
     *                           fechaFin: { type: string, format: date-time }
     *                           paquete:
     *                             type: object
     *                             properties:
     *                               idpaquete: { type: integer }
     *                               nombrePaquete: { type: string }
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil CLIENTE.
     */
    router.get("/historial-reservas", autenticar, requierePerfil("CLIENTE"), controller.consultarHistorialReservas);

    /**
     * @swagger
     * /api/resenias:
     *   post:
     *     summary: Publicar reseña de la experiencia (CU-47)
     *     description: >
     *       **RESTRINGIDO A CLIENTE.** La reseña queda asociada al cliente y a la salida. Reglas: el cliente
     *       participó con una reserva Confirmada, la salida está Finalizada, la valoración es de 1 a 5
     *       y cada cliente puede publicar una única reseña por salida.
     *     tags: [Reseñas]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [idsalida, valoracion]
     *             properties:
     *               idsalida: { type: integer, example: 1 }
     *               valoracion: { type: integer, minimum: 1, maximum: 5, example: 5 }
     *               comentario: { type: string, maxLength: 1000, example: Una experiencia inolvidable. }
     *     responses:
     *       201:
     *         description: Reseña publicada.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Resenia' }
     *       400:
     *         description: Datos inválidos, salida no finalizada o reseña duplicada.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       403:
     *         description: El cliente no participó en la salida con una reserva confirmada.
     *       404:
     *         description: La salida no existe.
     */
    router.post("/", autenticar, requierePerfil("CLIENTE"), controller.publicarResenia);

    /**
     * @swagger
     * /api/resenias:
     *   get:
     *     summary: Consultar evaluaciones y reseñas (CU-43)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista las reseñas de los clientes con un resumen (cantidad y promedio) y
     *       las evaluaciones del administrador al personal y a los proveedores (CU-42). Los filtros se aplican a las
     *       dos: el rango de valoración filtra también el puntaje.
     *     tags: [Reseñas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: idsalida
     *         schema: { type: integer }
     *       - in: query
     *         name: idpaquete
     *         schema: { type: integer }
     *       - in: query
     *         name: valoracionMin
     *         schema: { type: integer, minimum: 1, maximum: 5 }
     *       - in: query
     *         name: valoracionMax
     *         schema: { type: integer, minimum: 1, maximum: 5 }
     *       - in: query
     *         name: fechaDesde
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: fechaHasta
     *         schema: { type: string, format: date }
     *     responses:
     *       200:
     *         description: Reseñas y resumen.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     resumen:
     *                       type: object
     *                       properties:
     *                         cantidad: { type: integer }
     *                         promedio: { type: number, nullable: true, example: 4.5 }
     *                     resenias:
     *                       type: array
     *                       items: { $ref: '#/components/schemas/Resenia' }
     *                     evaluaciones:
     *                       type: object
     *                       description: Evaluaciones del CU-42.
     *                       properties:
     *                         personal: { type: array, items: { type: object } }
     *                         proveedores: { type: array, items: { type: object } }
     *       400:
     *         description: Filtro inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarResenias);

    return router;
  }
}