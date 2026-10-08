import { Router } from "express";
import { AuthController } from "./auth.controller";

export class AuthRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new AuthController();

    /**
     * @swagger
     * /api/auth/login:
     *   post:
     *     summary: Iniciar sesión en el sistema
     *     tags: [Autenticación]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email:
     *                 type: string
     *                 example: admin@incatour.com
     *               contrasenia:
     *                 type: string
     *                 example: AdminIncaTour123
     *     responses:
     *       200:
     *         description: Autenticación exitosa. Devuelve el JWT.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 usuario:
     *                   type: object
     *                 token:
     *                   type: string
     *       401:
     *         description: Credenciales inválidas o cuenta inactiva.
     */
    router.post("/login", controller.login);

    return router;
  }
}
