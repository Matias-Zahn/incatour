import { Router } from "express";
import { PostgresDatabase } from "../config";

export class ClienteRoutes {
  static getRoutes(): Router {
    const router = Router();

    const dbPool = PostgresDatabase.getInstance().connect();

    router.post("/registro", () => {
      "CONTROLADOR";
    });

    return router;
  }
}
