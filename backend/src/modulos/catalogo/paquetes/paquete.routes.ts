import { Router } from "express";
import { PaqueteController } from "./paquete.controller";

export class PaqueteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PaqueteController();

    // Consultar paquetes activos
    router.get("/", controller.consultarPaquetes);

    // Consultar paquete por ID
    router.get("/:id", controller.consultarPaquetePorId);

    // CU-10: Crear Paquete Turístico
    router.post("/", controller.confirmarCreacion);

    // CU-12: Modificar Paquete
    router.put("/:id", controller.modificarPaquete);

    // CU-13: Baja de Paquete
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
