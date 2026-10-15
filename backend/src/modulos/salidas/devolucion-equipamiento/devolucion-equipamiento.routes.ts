import { Router } from "express";
import { DevolucionEquipamientoController } from "./devolucion-equipamiento.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class DevolucionEquipamientoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new DevolucionEquipamientoController();

    // Solo el Administrador puede gestionar devoluciones de equipamiento
    router.use(autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * /api/salidas/{idsalida}/equipamiento-asignado:
     *   get:
     *     summary: Consultar equipamiento asignado a la salida para devolución (CU-41)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista los artículos de equipamiento de camping
     *       que fueron asignados a la salida para facilitar la carga de devolución e inspección.
     *     tags: [Devolución de Equipamiento]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID de la salida
     *     responses:
     *       200:
     *         description: Lista de equipamiento asignado
     *       401:
     *         description: No autenticado
     *       403:
     *         description: Requiere rol ADMIN
     *       404:
     *         description: Salida no encontrada
     */
    router.get("/:idsalida/equipamiento-asignado", controller.obtenerEquipamientoAsignado);

    /**
     * @swagger
     * /api/salidas/{idsalida}/devolucion-equipamiento:
     *   post:
     *     summary: Registrar devolución del equipamiento (CU-41)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Terminada la salida, registra qué equipamiento se devolvió
     *       y en qué estado (buen estado o dañado/extraviado).
     *       Reintegra atómicamente al stock del proveedor las unidades en buen estado
     *       y deja registro de trazabilidad en la auditoría del sistema (Cubre RF-56).
     *     tags: [Devolución de Equipamiento]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idsalida
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID de la salida
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - items
     *             properties:
     *               observacionesGenerales:
     *                 type: string
     *                 example: "Devolución recibida en depósito central sin novedades mayores."
     *               items:
     *                 type: array
     *                 items:
     *                   type: object
     *                   required:
     *                     - idservicio
     *                     - cantidadBuenEstado
     *                   properties:
     *                     idservicio:
     *                       type: integer
     *                       example: 5
     *                     cantidadBuenEstado:
     *                       type: integer
     *                       example: 4
     *                     cantidadDaniada:
     *                       type: integer
     *                       example: 1
     *                     observaciones:
     *                       type: string
     *                       example: "1 carpa con varilla doblada"
     *     responses:
     *       200:
     *         description: Devolución registrada y stock reintegrado con éxito.
     *       400:
     *         description: Salida aún no finalizada, cantidades inválidas o servicio no asignado.
     *       401:
     *         description: No autenticado.
     *       403:
     *         description: Requiere perfil ADMIN.
     *       404:
     *         description: Salida no encontrada.
     */
    router.post("/:idsalida/devolucion-equipamiento", controller.registrarDevolucion);

    return router;
  }
}
