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
     *                 data:
     *                   type: object
     *                   properties:
     *                     usuario:
     *                       type: object
     *                       properties:
     *                         idusuario: { type: integer, example: 1 }
     *                         email: { type: string, example: admin@incatour.com }
     *                         nombre: { type: string }
     *                         apellido: { type: string }
     *                         rol: { type: string, enum: [ADMIN, CLIENTE, GUIA] }
     *                     token:
     *                       type: string
     *                       description: JWT de 8 horas. Va en cada pedido como Authorization Bearer.
     *       401:
     *         description: Credenciales inválidas o cuenta inactiva.
     */
    router.post("/login", controller.login);

    return router;
  }
}
