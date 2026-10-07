import { Router } from "express";
import { CircuitoController } from "./circuito.controller";

export class CircuitoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CircuitoController();

    // CU-01: Consultar circuitos
    router.get("/", controller.consultarCircuitos);

    // CU-02: Crear circuito
    router.post("/", controller.crearCircuito);

    // CU-03: Modificar circuito
    router.put("/:id", controller.modificarCircuito);

    // CU-04: Baja lógica de circuito
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
