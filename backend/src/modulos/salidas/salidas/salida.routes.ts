import { Router } from "express";
import { SalidaController } from "./salida.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class SalidaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new SalidaController();

    // CU-35: Consultar salidas
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarSalidas);

    // CU-36: Crear salida planificada (primero las opciones, después la confirmación)
    router.get("/opciones", autenticar, requierePerfil("ADMIN"), controller.consultarOpcionesSalida);
    router.post("/", autenticar, requierePerfil("ADMIN"), controller.confirmarCreacionSalida);

    return router;
  }
}
