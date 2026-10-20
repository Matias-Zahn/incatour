import { Router } from "express";
import { CuentaGuiaController } from "./cuenta-guia.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class CuentaGuiaRoutes {
  /** En app.ts: app.use("/api/cuentas-guia", CuentaGuiaRoutes.getRoutes) */
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CuentaGuiaController();

    // Las cuentas de guía las gestiona solo el administrador
    router.use(autenticar, requierePerfil("ADMIN"));

    /**
     * @swagger
     * components:
     *   schemas:
     *     CuentaGuia:
     *       type: object
     *       properties:
     *         idusuario: { type: integer, example: 4 }
     *         email: { type: string, example: guia@incatour.com }
     *         nombre: { type: string }
     *         apellido: { type: string }
     *         rol: { type: string, example: GUIA }
     *         estado: { type: string, enum: [ACTIVO, INACTIVO], description: Estado de la CUENTA de acceso. }
     *         creadoEn: { type: string, format: date-time }
     *         guia:
     *           type: object
     *           description: Guía asociado a la cuenta (legajo del personal operativo).
     *           properties:
     *             idpersonal: { type: integer }
     *             nombreCompleto: { type: string }
     *             nroPasaporte: { type: string }
     *             estadoPersonal: { type: string, enum: [ACTIVO, INACTIVO] }
     *         habilitacion:
     *           type: object
     *           properties:
     *             nroHabilitacion: { type: string, nullable: true }
     *             fechaHabilitacion: { type: string, format: date-time, nullable: true }
     *             situacion: { type: string, enum: [VIGENTE, VENCIDA, SIN_DATOS] }
     *         salidasPendientes:
     *           type: integer
     *           description: Salidas asignadas al guía cuyo recorrido todavía no finalizó.
     *         puedeDarseDeBaja:
     *           type: boolean
     *           description: Cuenta ACTIVA y sin salidas pendientes.
     */

    /**
     * @swagger
     * /api/cuentas-guia:
     *   get:
     *     summary: Consultar usuarios guía (CU-44)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista las cuentas de acceso de los guías con el guía asociado,
     *       la situación de su habilitación y las salidas que tiene pendientes.
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Cuentas de guía obtenidas exitosamente.
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.get("/", controller.consultarUsuariosGuia);

    /**
     * @swagger
     * /api/cuentas-guia:
     *   post:
     *     summary: Alta de cuenta de acceso para un guía ya registrado (CU-45)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Crea las credenciales de acceso para un personal guía existente.
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - idpersonal
     *               - email
     *               - contrasenia
     *             properties:
     *               idpersonal: { type: integer, example: 1 }
     *               email: { type: string, example: nuevo.guia@incatour.com }
     *               contrasenia: { type: string, example: password123 }
     *               nroHabilitacion: { type: string, example: HAB-2026-99 }
     *               fechaHabilitacion: { type: string, format: date, example: "2027-12-31" }
     *     responses:
     *       201:
     *         description: Cuenta de guía creada exitosamente.
     *       400:
     *         description: Error de validación o el guía ya tiene cuenta.
     *       404:
     *         description: Personal guía no encontrado.
     */
    router.post("/", controller.crearCuentaGuia);

    /**
     * @swagger
     * /api/cuentas-guia/{idusuario}:
     *   put:
     *     summary: Modificar cuenta de guía (por administrador)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Permite corregir datos de la cuenta del guía (nombre, apellido, email, contraseña, habilitación o estado).
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idusuario
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Cuenta de guía modificada exitosamente.
     *       400:
     *         description: Error de validación o email ya en uso.
     *       404:
     *         description: Cuenta de guía no encontrada.
     */
    router.put("/:idusuario", controller.modificarCuenta);

    /**
     * @swagger
     * /api/cuentas-guia/{idusuario}/baja:
     *   patch:
     *     summary: Baja cuenta guía (CU-46)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Baja lógica de la cuenta de acceso: pasa a INACTIVO.
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idusuario
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Cuenta dada de baja exitosamente.
     *       400:
     *         description: La cuenta ya estaba inactiva o tiene salidas pendientes.
     *       404:
     *         description: No existe cuenta de guía con ese ID.
     */
    router.patch("/:idusuario/baja", controller.darDeBajaCuenta);

    return router;
  }
}
