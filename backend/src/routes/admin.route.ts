import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";

export class AdminRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const adminController = new AdminController();

    router.post("/registro", adminController.registrar);

    return router;
  }
}