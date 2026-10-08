import { Router } from "express";
import { EtapaController } from "./etapa.controller";

export class EtapaRoutes {
  static get getRoutes(): Router {
    // mergeParams: true es crucial para que podamos leer el :idcircuito 
    // cuando este router se monta desde app.ts o circuito.routes.ts
    const router = Router({ mergeParams: true });
    const controller = new EtapaController();

    // GET /api/circuitos/:idcircuito/etapas
    router.get("/", controller.consultarEtapas);

    // PUT /api/circuitos/:idcircuito/etapas (DSS: Bulk Replace)
    router.put("/", controller.confirmarSecuenciaCompleta);

    return router;
  }
}
