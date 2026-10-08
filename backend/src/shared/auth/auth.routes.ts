import { Router } from "express";
import { AuthController } from "./auth.controller";

export class AuthRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new AuthController();

    router.post("/login", controller.login);

    return router;
  }
}
