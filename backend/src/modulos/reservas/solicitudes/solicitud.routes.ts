import { Router } from "express";
import { SolicitudController } from "./solicitud.controller";

export class SolicitudRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new SolicitudController();

    // CU-33
    router.get("/", controller.consultarPendientes);

    // CU-34
    router.get("/:id/opciones", controller.obtenerOpcionesAlojamiento);
    router.post("/:id/resolver", controller.resolverSolicitud);

    return router;
  }
}
