import { Router } from "express";
import { SalidaController } from "./salida.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class SalidaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new SalidaController();

    // CU-35: Consultar salidas
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarSalidas);

    return router;
  }
}
