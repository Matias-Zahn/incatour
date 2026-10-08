import { Router } from "express";
import { CatalogoController } from "./catalogo.controller";

export class CatalogoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CatalogoController();

    // GET /api/catalogo
    router.get("/", controller.consultarCatalogoPublico);

    return router;
  }
}
