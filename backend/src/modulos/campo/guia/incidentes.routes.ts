import { Router } from "express";
import { GuiaController } from "./guia.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

// CU-50 paso 17: panel de alertas del administrador. Va aparte porque el resto del módulo es solo para guías.
export class IncidenteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new GuiaController();

    /**
     * @swagger
     * /api/incidentes:
     *   get:
     *     summary: Alertas de incidentes (CU-50, panel del administrador)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Incidentes informados por los guías, del más reciente al más viejo,
     *       con la salida y los pasajeros afectados. Filtros opcionales por salida y gravedad.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: query, name: idsalida, schema: { type: integer } }
     *       - { in: query, name: nivelGravedad, schema: { type: string, enum: [BAJO, MEDIO, CRITICO] } }
     *     responses:
     *       200: { description: Lista de incidentes. }
     *       400: { description: Filtro inválido. }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.listarIncidentes);

    return router;
  }
}
