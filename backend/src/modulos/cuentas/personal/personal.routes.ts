import { Router } from "express";
import { PersonalController } from "./personal.controller";

export class PersonalRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PersonalController();

    /**
     * @swagger
     * /api/personal:
     *   post:
     *     summary: Registrar cuenta de Guía operativo (RESTRINGIDO A ADMINISTRADOR)
     *     tags: [Personal]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               nombre:
     *                 type: string
     *                 example: Carlos
     *               apellido:
     *                 type: string
     *                 example: Mamani
     *               email:
     *                 type: string
     *                 example: carlos.guia2@incatour.com
     *               contrasenia:
     *                 type: string
     *                 example: MiClaveSecreta123
     *               nroPasaporte:
     *                 type: string
     *                 example: PE-9876543
     *               nacionalidad:
     *                 type: string
     *                 example: Peruana
     *               fechaVencimientoPasaporte:
     *                 type: string
     *                 format: date
     *                 example: "2032-12-31"
     *               rolOperativo:
     *                 type: string
     *                 example: Guía
     *     responses:
     *       201:
     *         description: Cuenta del guía y legajo operativo creados exitosamente.
     *       400:
     *         description: Error de validación (pasaporte vencido, email o pasaporte duplicado).
     */
    router.post("/", controller.crearPersonal);

    return router;
  }
}
