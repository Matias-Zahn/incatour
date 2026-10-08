import { Router } from "express";
import { TemporadaController } from "./temporada.controller";

export class TemporadaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new TemporadaController();

    // CU-06: Consultar Temporadas
    router.get("/", controller.consultarTemporadas);

    // CU-07: Crear Temporada
    router.post("/", controller.crearTemporada);

    // CU-08: Modificar Temporada
    router.put("/:id", controller.modificarTemporada);

    // CU-09: Baja Temporada
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
