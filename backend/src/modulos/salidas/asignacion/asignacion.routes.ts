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
     *     summary: Panel para confirmar la salida (CU-40, pasos 2 y 3)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Funciona en cualquier momento antes del inicio. Muestra los pasajeros, el personal
     *       asignado con su aptitud (12.3), el hotel, el transporte, el equipo (necesita, ocupado y falta), los porteadores que
     *       sobran, las reservas con el alojamiento pendiente y los faltantes. `puedeConfirmar` es true después del corte de venta
     *       y sin faltantes; si no, `motivoNoConfirmable` dice por qué. Forma completa en docs/contratos-viernes.md, sección 9.1.
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
     *                 salida: { idsalida: 2, nroSalida: SAL-2026-002, estado: PUBLICADA, ultimoDiaVenta: "2026-11-17", ventaAbierta: false }
     *                 puedeConfirmar: true
     *                 motivoNoConfirmable: null
     *                 pasajerosConfirmados: 3
     *                 dotacionRequerida: { guias: 2, porteadores: 2 }
     *                 personal: [{ idpersonal: 1, nombreCompleto: Carlos Mamani, rol: Guía, apto: true, motivo: null }]
     *                 porteadoresSobrantes: 2
     *                 porteadoresSugeridosALiberar: [12, 15]
     *                 transporte: { idservicio: 3, nombreServicio: Minibus Sprinter, capacidadVehiculo: 15, alcanza: true }
     *                 equipo: [{ idservicio: 5, nombreServicio: Carpas, tipoEquipamiento: Carpa, necesita: 2, ocupado: 2, falta: 0 }]
     *                 faltantes: []
     *                 bloqueoInicial: 14
     *                 lugaresSobrantes: 5
     *       400: { description: Salida que ya inició o no está activa, o sin bloqueo. }
     *       404: { description: La salida no existe. }
     *   post:
     *     summary: Confirmar la salida y emitir permisos (CU-40)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Body vacío: no asigna nada (todo se asignó al crear la salida). Solo después del
     *       corte de venta y sin faltantes. Emite los permisos de toda la nómina (pasajeros y personal), devuelve al hotel las
     *       plazas no vendidas, libera los lugares sobrantes del bloqueo y pasa la salida a CERRADA. Si la base falla después de emitir, los permisos se dan de baja.
     *       Si la autoridad rechaza a alguien (RF-47), la asignación se confirma igual: ese permiso queda registrado como
     *       "Rechazado", sin número, y la respuesta lo informa en `rechazados`. El lugar de un pasajero rechazado se libera
     *       con los sobrantes; el de un personal rechazado queda reservado para su reemplazo (CU-38).
     *       Una salida creada sin personal (antes de la etapa 3) lo recibe en `personalIds` (aptos y libres); con personal, 400.
     *       Si sobran porteadores para lo vendido, `porteadoresALiberar` dice cuáles se desasignan (exactamente los que sobran);
     *       sin él se liberan los que más salidas tienen en el mes. Los liberados no llevan permiso y su lugar se libera.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               personalIds: { type: array, items: { type: integer }, example: [1, 4, 5], description: "Solo para una salida sin personal." }
     *               porteadoresALiberar: { type: array, items: { type: integer }, example: [12], description: "Los porteadores que sobran para lo vendido y se desasignan." }
     *     responses:
     *       200: { description: "Asignación confirmada. Informa los permisos emitidos, los rechazados (`rechazados`: tipo, id, nombreCompleto y motivo), que son los que rechazó la autoridad y los pasajeros con el pasaporte vencido antes del fin del recorrido (SAL-21), y los lugares liberados. Si la autoridad no liberó los sobrantes, trae `advertencia` y se reintenta con POST /liberar-sobrantes." }
     *       400: { description: La venta sigue abierta, la salida ya está confirmada, ya inició o no tiene pasajeros. }
     *       404: { description: La salida no existe. }
     *       409: { description: "Hay reservas con el alojamiento pendiente (FA5) o faltantes (equipo, transporte, personal no apto o dotación), con detalle: { reservasSinAlojamiento, faltantes }; o la salida cambió mientras se confirmaba." }
     *       503: { description: La autoridad no pudo emitir los permisos. No se modificó nada. }
     *
     * /api/salidas/{idsalida}/asignacion/liberar-sobrantes:
     *   post:
     *     summary: Reintentar la liberación de lugares sobrantes (CU-40 paso 12)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Si al confirmar la asignación la autoridad no liberó los lugares
     *       sobrantes, la cantidad queda guardada en la salida y se libera con esta petición. Es idempotente:
     *       si no queda nada pendiente responde lugaresLiberados 0.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Sobrantes liberados (o nada pendiente).
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data: { type: object, properties: { lugaresLiberados: { type: integer, example: 7 } } }
     *       400: { description: La salida no está cerrada o no tiene bloqueo ante la autoridad. }
     *       404: { description: La salida no existe. }
     *       503: { description: La autoridad no respondió; la cantidad sigue pendiente. Reintentar más tarde. }
     */
    router.get("/:idsalida/asignacion", autenticar, requierePerfil("ADMIN"), controller.obtenerPanelAsignacion);
    router.post("/:idsalida/asignacion", autenticar, requierePerfil("ADMIN"), controller.confirmarAsignacion);
    router.post("/:idsalida/asignacion/liberar-sobrantes", autenticar, requierePerfil("ADMIN"), controller.liberarSobrantes);

    return router;
  }
}
