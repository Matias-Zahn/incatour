import { Router } from "express";
import { ReemplazoController } from "./reemplazo.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ReemplazoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ReemplazoController();

    /**
     * @swagger
     * /api/salidas/{idsalida}/personal:
     *   get:
     *     summary: Personal asignado a la salida (CU-38, paso 4)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Muestra la logística y el personal asignado, con el permiso vigente
     *       de cada uno. Solo para salidas que todavía no iniciaron (FA2).
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Personal y logística de la salida.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 salida: { idsalida: 2, nroSalida: SAL-2026-002, estado: CERRADA }
     *                 personal: [{ idpersonal: 3, nombreCompleto: Rosa Prueba, rol: Guía, permiso: PER-1A2B3C4D }]
     *                 servicios: [{ tipo: TRANSPORTE, nombreServicio: Minibus Sprinter }]
     *                 equipamiento: [{ nombreServicio: Carpas Alta Montaña, cantidad: 2 }]
     *       400: { description: La salida ya inició o no está activa (FA2). }
     *       404: { description: La salida no existe. }
     */
    router.get("/:idsalida/personal", autenticar, requierePerfil("ADMIN"), controller.consultarPersonalSalida);

    /**
     * @swagger
     * /api/salidas/{idsalida}/personal/{idpersonal}/reemplazantes:
     *   get:
     *     summary: Reemplazantes disponibles (CU-38, paso 8)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Personal del mismo rol que el integrante a reemplazar, activo,
     *       sin otra salida superpuesta y, si es guía, con la habilitación vigente para las fechas.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *       - { in: path, name: idpersonal, required: true, schema: { type: integer }, description: Integrante a reemplazar. }
     *     responses:
     *       200: { description: Lista de reemplazantes posibles. }
     *       400: { description: La salida ya inició o esa persona no está asignada. }
     *       404: { description: La salida no existe. }
     */
    router.get(
      "/:idsalida/personal/:idpersonal/reemplazantes",
      autenticar,
      requierePerfil("ADMIN"),
      controller.consultarReemplazantesDisponibles
    );

    /**
     * @swagger
     * /api/salidas/{idsalida}/reemplazos:
     *   post:
     *     summary: Reemplazar personal asignado (CU-38)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Desvincula al integrante original y asigna al reemplazante. Si el original
     *       tenía permiso emitido, se da de baja ante la autoridad y se emite uno nuevo para el reemplazante sobre el
     *       mismo lugar. El motivo queda en la auditoría. Si la base falla después de emitir, el permiso nuevo se da de baja.
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
     *             required: [idoriginal, idreemplazante, motivo]
     *             properties:
     *               idoriginal: { type: integer, example: 3 }
     *               idreemplazante: { type: integer, example: 5 }
     *               motivo: { type: string, example: Licencia médica }
     *     responses:
     *       200:
     *         description: Reemplazo realizado.
     *         content:
     *           application/json:
     *             example:
     *               mensaje: Reemplazo realizado correctamente
     *               data:
     *                 sale: { idpersonal: 3, nombreCompleto: Rosa Prueba }
     *                 entra: { idpersonal: 5, nombreCompleto: Ana Prueba }
     *                 permisoDadoDeBaja: PER-1A2B3C4D
     *                 permisoNuevo: PER-9F8E7D6C
     *       400: { description: Reemplazante de otro rol, ocupado, sin habilitación o con pasaporte vencido (FA1), salida iniciada (FA2), o el original no está asignado. }
     *       404: { description: La salida o el reemplazante no existen. }
     *       503: { description: La autoridad no respondió. Si el permiso viejo ya se dio de baja, el reintento emite el nuevo. }
     */
    router.post("/:idsalida/reemplazos", autenticar, requierePerfil("ADMIN"), controller.confirmarReemplazo);

    return router;
  }
}
