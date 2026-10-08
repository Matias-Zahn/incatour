import { Router } from "express";
import { ClienteController } from "./cliente.controller";

export class ClienteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ClienteController();

    router.get("/", controller.consultarClientes);
    router.get("/:id", controller.consultarClientePorId);
    router.post("/", controller.crearCliente);
    router.put("/:id", controller.modificarCliente);
    router.patch("/:id/baja", controller.darDeBajaCliente);

    return router;
  }
}
