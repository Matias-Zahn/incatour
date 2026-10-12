import { Router } from "express";
import { GestionReservaController } from "./gestion-reserva.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class GestionReservaRoutes {
  /**
   * En app.ts: app.use("/api/reservas", GestionReservaRoutes.getRoutes)
   * Comparte el prefijo con el router de compra (CU-30, rol 1): no hay rutas repetidas.
   * IMPORTANTE: "/mis-reservas" va antes de "/:idreserva" para que no se lea como un ID.
   */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new GestionReservaController();

    /**
     * @swagger
     * /api/reservas/mis-reservas:
     *   get:
     *     summary: Consultar mis reservas (CU-31, cliente)
     *     description: >
     *       **RESTRINGIDO A CLIENTE.** Lista las reservas del cliente autenticado con su estado,
     *       salida, paquete, cantidad de pasajeros y situación de pago (`pagado` y `reintegro`).
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: estado
     *         schema: { type: string, enum: [CONFIRMADA, CANCELADA] }
     *     responses:
     *       200:
     *         description: Reservas del cliente.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/ReservaResumen' }
     *       400:
     *         description: Filtro inválido.
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil CLIENTE.
     */
    router.get("/mis-reservas", autenticar, requierePerfil("CLIENTE"), controller.consultarMisReservas);

    /**
     * @swagger
     * /api/reservas:
     *   get:
     *     summary: Listar y filtrar reservas (CU-31, administrador)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Filtra por titular (nombre, apellido o email), pasajero
     *       (nombre o pasaporte), paquete, rango de fecha de inicio de la salida y estado.
     *       Las más recientes primero.
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: titular
     *         schema: { type: string }
     *       - in: query
     *         name: pasajero
     *         schema: { type: string }
     *       - in: query
     *         name: idpaquete
     *         schema: { type: integer }
     *       - in: query
     *         name: fechaDesde
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: fechaHasta
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: estado
     *         schema: { type: string, enum: [CONFIRMADA, CANCELADA] }
     *       - in: query
     *         name: limite
     *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
     *     responses:
     *       200:
     *         description: Reservas que cumplen el filtro.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     allOf:
     *                       - $ref: '#/components/schemas/ReservaResumen'
     *                       - type: object
     *                         properties:
     *                           titular:
     *                             type: object
     *                             properties:
     *                               nombre: { type: string }
     *                               apellido: { type: string }
     *                               email: { type: string }
     *       400:
     *         description: Filtro inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarReservas);

    /**
     * @swagger
     * /api/reservas/{idreserva}:
     *   get:
     *     summary: Detalle de una reserva (CU-31)
     *     description: >
     *       **CLIENTE (solo la propia) o ADMINISTRADOR.** Incluye itinerario (etapas del circuito),
     *       pasajeros, pagos, reembolsos, solicitudes de alojamiento y estado de los permisos.
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idreserva
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Detalle de la reserva.
     *       403:
     *         description: La reserva pertenece a otro cliente.
     *       404:
     *         description: La reserva no existe.
     */
    router.get("/:idreserva", autenticar, requierePerfil("CLIENTE", "ADMIN"), controller.obtenerReserva);

    /**
     * @swagger
     * /api/reservas/{idreserva}/comprobante:
     *   get:
     *     summary: Descargar resumen y comprobantes de la reserva (CU-31)
     *     description: >
     *       **CLIENTE (solo la propia) o ADMINISTRADOR.** Devuelve el comprobante con
     *       `Content-Disposition: attachment` para su descarga.
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idreserva
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Comprobante (JSON descargable).
     *       403:
     *         description: La reserva pertenece a otro cliente.
     *       404:
     *         description: La reserva no existe.
     */
    router.get("/:idreserva/comprobante", autenticar, requierePerfil("CLIENTE", "ADMIN"), controller.obtenerComprobante);

    /**
     * @swagger
     * /api/reservas/{idreserva}/cancelacion:
     *   get:
     *     summary: Resumen de liquidación antes de cancelar (CU-32, pasos 2 a 4)
     *     description: >
     *       **CLIENTE (solo la propia) o ADMINISTRADOR.** No modifica nada. Informa el importe abonado,
     *       el monto a reintegrar y si los lugares volverán a la venta. Si hay permisos emitidos el
     *       reintegro es de $0 y los lugares no vuelven a la venta (flujo alternativo 2).
     *       Se rechaza si la reserva no está Confirmada o si la salida ya comenzó (flujo alternativo 1).
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idreserva
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Resumen de liquidación.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data: { $ref: '#/components/schemas/ResumenCancelacion' }
     *       400:
     *         description: La reserva no está Confirmada o la salida ya comenzó.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       403:
     *         description: La reserva pertenece a otro cliente.
     *       404:
     *         description: La reserva no existe.
     */
    router.get("/:idreserva/cancelacion", autenticar, requierePerfil("CLIENTE", "ADMIN"), controller.solicitarCancelacion);

    /**
     * @swagger
     * /api/reservas/{idreserva}/cancelar:
     *   post:
     *     summary: Confirmar la cancelación de una reserva (CU-32)
     *     description: >
     *       **CLIENTE (solo la propia) o ADMINISTRADOR.** Cancela la reserva y asienta el reembolso
     *       (usuario, motivo, importe y fecha). Reintegra el 100% de lo abonado; con permisos emitidos
     *       el importe es $0, los permisos pasan a Perdido y el stock local no se repone. Libera las plazas
     *       de alojamiento o cancela la solicitud vinculada y envía la constancia al titular.
     *       No interactúa con la autoridad ni mueve dinero: la acreditación es externa al sistema.
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idreserva
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               motivo:
     *                 type: string
     *                 maxLength: 300
     *                 example: Cambio de planes
     *                 description: Opcional.
     *     responses:
     *       200:
     *         description: Reserva cancelada.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data:
     *                   type: object
     *                   properties:
     *                     idreserva: { type: integer }
     *                     nroReserva: { type: string }
     *                     estado: { type: string, example: CANCELADA }
     *                     lugaresVuelvenALaVenta: { type: boolean }
     *                     reembolso:
     *                       type: object
     *                       properties:
     *                         idreembolso: { type: integer }
     *                         montoReembolsado: { type: number }
     *                         motivo: { type: string }
     *                         fechaReembolso: { type: string, format: date-time }
     *                         nota: { type: string }
     *       400:
     *         description: Reserva no confirmada, salida iniciada o ya cancelada.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       403:
     *         description: La reserva pertenece a otro cliente.
     *       404:
     *         description: La reserva no existe.
     */
    router.post("/:idreserva/cancelar", autenticar, requierePerfil("CLIENTE", "ADMIN"), controller.confirmarCancelacion);

    return router;
  }
}