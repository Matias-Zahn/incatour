import { Router } from "express";
import { PersonalController } from "./personal.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class PersonalRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PersonalController();

    /**
     * @swagger
     * /api/personal:
     *   post:
     *     summary: Registrar cuenta de Guía operativo
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.**
     *       Crea simultáneamente las credenciales de acceso (tabla Usuario con rol GUIA)
     *       y el legajo operativo (tabla Personal) dentro de una transacción atómica.
     *       Requiere un token JWT válido con perfil ADMIN en el header Authorization.
     *     tags: [Personal]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - nombre
     *               - apellido
     *               - email
     *               - contrasenia
     *               - nroPasaporte
     *               - nacionalidad
     *               - fechaVencimientoPasaporte
     *               - rolOperativo
     *             properties:
     *               nombre:
     *                 type: string
     *                 maxLength: 64
     *                 example: Carlos
     *                 description: Solo letras y espacios (sin números ni símbolos)
     *               apellido:
     *                 type: string
     *                 maxLength: 64
     *                 example: Mamani
     *                 description: Solo letras y espacios (sin números ni símbolos)
     *               email:
     *                 type: string
     *                 format: email
     *                 example: carlos.guia2@incatour.com
     *               contrasenia:
     *                 type: string
     *                 minLength: 8
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
     *                 description: No puede ser una fecha pasada
     *               rolOperativo:
     *                 type: string
     *                 enum: [Guía, Porteador]
     *                 example: Guía
     *     responses:
     *       201:
     *         description: Cuenta del guía y legajo operativo creados exitosamente.
     *       400:
     *         description: Error de validación (nombre con símbolos, pasaporte vencido, email o pasaporte duplicado, contraseña menor a 8 caracteres).
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere el perfil ADMIN.
     */
    router.post("/", autenticar, requierePerfil("ADMIN"), controller.crearPersonal);

    return router;
  }
}
