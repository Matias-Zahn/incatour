import { Router } from "express";
import { CancelacionSalidaController } from "./cancelacion-salida.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class CancelacionSalidaRoutes {
  /**
   * En app.ts: app.use("/api/salidas", CancelacionSalidaRoutes.getRoutes)
   * Comparte el prefijo con el router de salidas del rol 3 (CU-35, 36, 40): no hay rutas repetidas.
   */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CancelacionSalidaController();

    /**
     * @swagger
     * /api/salidas/{idsalida}/cancelacion:
     *   get:
     *     summary: Impacto de cancelar una salida (CU-37, antes de confirmar)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** No modifica nada. Informa las reservas afectadas, el total a
     *       reembolsar (100% de lo abonado), los permisos que pasarían a Perdido y los recursos que se liberan.
     *       Se rechaza si la salida ya está cancelada o su recorrido comenzó.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Resumen de impacto.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: object
     *                   properties:
     *                     idsalida: { type: integer }
     *                     nroSalida: { type: string }
     *                     paquete: { type: string }
     *                     fechaInicio: { type: string, format: date-time }
     *                     reservasAfectadas: { type: integer }
     *                     totalAReembolsar: { type: number }
     *                     permisosQuePasanAPerdido: { type: integer }
     *                     notificaAClientes: { type: boolean }
     *                     recursosQueSeLiberan:
     *                       type: object
     *                       properties:
     *                         personal: { type: integer }
     *                         equipamiento: { type: integer }
     *                         servicios: { type: integer }
     *       400:
     *         description: La salida ya está cancelada o su recorrido comenzó.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: La salida no existe.
     */
    router.get("/:idsalida/cancelacion", autenticar, requierePerfil("ADMIN"), controller.solicitarCancelacion);

    /**
     * @swagger
     * /api/salidas/{idsalida}/cancelar:
     *   post:
     *     summary: Cancelar una salida (CU-37)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Primero libera ante la autoridad la totalidad de los cupos
     *       bloqueados; si la autoridad no responde, **la salida no se cancela**. Luego, en una única transacción:
     *       los permisos emitidos pasan a Perdido, se reintegra el stock de equipamiento, se dan de baja las
     *       solicitudes de alojamiento pendientes, todas las reservas pasan a Cancelada con su reembolso del
     *       100% de lo abonado y la salida queda Cancelada, con el motivo en el registro de auditoría.
     *       Por último se avisa por correo a los titulares con el motivo, el importe y salidas alternativas.
     *       Solo procede si el recorrido no comenzó. El dinero se acredita por fuera del sistema.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [motivo]
     *             properties:
     *               motivo: { type: string, minLength: 5, maxLength: 300, example: Condiciones climáticas adversas en el recorrido }
     *     responses:
     *       200:
     *         description: Salida cancelada.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data:
     *                   type: object
     *                   properties:
     *                     idsalida: { type: integer }
     *                     nroSalida: { type: string }
     *                     estado: { type: string, example: CANCELADA }
     *                     reservasCanceladas: { type: integer }
     *                     reembolsoTotal: { type: number }
     *                     notificaciones:
     *                       type: object
     *                       properties:
     *                         enviadas: { type: integer }
     *                         fallidas: { type: integer }
     *                         salidasAlternativasOfrecidas: { type: integer }
     *       400:
     *         description: Motivo inválido, salida ya cancelada o recorrido comenzado.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: La salida no existe.
     *       500:
     *         description: La autoridad no respondió; la salida no se canceló. Reintentar más tarde.
     */
    router.post("/:idsalida/cancelar", autenticar, requierePerfil("ADMIN"), controller.confirmarCancelacionSalida);

    return router;
  }
}