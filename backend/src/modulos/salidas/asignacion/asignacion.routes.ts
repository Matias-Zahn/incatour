import { Router } from "express";
import { AsignacionController } from "./asignacion.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class AsignacionRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new AsignacionController();

    /**
     * @swagger
     * /api/salidas/{idsalida}/asignacion:
     *   get:
     *     summary: Panel de asignación de recursos (CU-40, pasos 2 y 3)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Calcula la dotación definitiva según los pasajeros confirmados y los
     *       lugares sobrantes del bloqueo, y lista el personal, los transportes y el equipamiento disponibles.
     *       Responde 409 si alguna reserva tiene el alojamiento pendiente (FA5, se resuelve con el CU-34).
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Panel de asignación.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 salida: { idsalida: 2, nroSalida: SAL-2026-002 }
     *                 pasajerosConfirmados: 3
     *                 dotacionRequerida: { guias: 2, porteadores: 2 }
     *                 bloqueoInicial: 14
     *                 lugaresSobrantes: 7
     *                 personalDisponible: [{ idpersonal: 1, nombreCompleto: Carlos Mamani, rol: Guía }]
     *                 transportesDisponibles: [{ idservicio: 3, nombreServicio: Minibus Sprinter, capacidadVehiculo: 15 }]
     *                 stockCamping: [{ idservicio: 5, nombreServicio: Carpas, tipoEquipamiento: Carpa, cantidadDisponible: 20 }]
     *       400: { description: Salida en un estado que no admite asignación, sin bloqueo, ya asignada o sin pasajeros. }
     *       404: { description: La salida no existe. }
     *       409: { description: Hay reservas con el alojamiento pendiente (FA5). }
     *   post:
     *     summary: Confirmar asignación de recursos y emitir permisos (CU-40)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Asigna personal, transporte y equipamiento, emite los permisos de
     *       toda la nómina (pasajeros y personal), devuelve al hotel las plazas no vendidas, libera los lugares
     *       sobrantes del bloqueo y cierra la venta. Si la base falla después de emitir, los permisos se dan de baja.
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
     *             required: [personalIds, idtransporte]
     *             properties:
     *               personalIds: { type: array, items: { type: integer }, example: [1, 2, 4, 5] }
     *               idtransporte: { type: integer, example: 3 }
     *               itemsCamping:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     idservicio: { type: integer, example: 5 }
     *                     cantidad: { type: integer, example: 4 }
     *     responses:
     *       200: { description: Asignación confirmada. Informa los permisos emitidos y los lugares liberados. }
     *       400: { description: Personal ocupado, dado de baja o sin habilitación (FA1), stock insuficiente (FA2), transporte sin cupo (FA3), pasaportes vencidos (FA4) o dotación incompleta. }
     *       404: { description: La salida no existe. }
     *       409: { description: Hay reservas con el alojamiento pendiente (FA5). }
     *       503: { description: La autoridad no pudo emitir los permisos. No se modificó nada. }
     */
    router.get("/:idsalida/asignacion", autenticar, requierePerfil("ADMIN"), controller.obtenerPanelAsignacion);
    router.post("/:idsalida/asignacion", autenticar, requierePerfil("ADMIN"), controller.confirmarAsignacion);

    return router;
  }
}
