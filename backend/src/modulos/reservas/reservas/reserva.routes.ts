import { Router } from "express";
import { ReservaController } from "./reserva.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ReservaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ReservaController();

    // Acceso restringido exclusivamente a Clientes validados y Administradores corporativos
    router.post(
      "/comprar",
      [autenticar, requierePerfil("CLIENTE", "ADMIN")],
      controller.comprarPaquete
    );

    return router;
  }
}
