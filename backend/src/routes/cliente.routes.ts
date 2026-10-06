import { Router } from "express";
import { PostgresDatabase } from "../config";
import { ClienteController } from "../controllers/cliente.controller";

export class ClienteRoutes {
  static get getRoutes(): Router {
    const router = Router();



    const dbPool = PostgresDatabase.getInstance().connect();

    const clienteController = new ClienteController;

    router.post("/registro", clienteController.registrar);

    return router;
  }
}
