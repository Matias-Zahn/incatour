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
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista las cuentas de acceso de los guías (solo ellos tienen cuenta;
     *       los porteadores no) con el guía asociado, la situación de su habilitación y las salidas que tiene
     *       pendientes. Filtra por rol y estado de la cuenta, situación de la habilitación y búsqueda
     *       por nombre, apellido o email.
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: query
     *         name: rol
     *         schema: { type: string, enum: [GUIA] }
     *         description: Hoy el único rol con cuenta entre el personal operativo.
     *       - in: query
     *         name: estado
     *         schema: { type: string, enum: [ACTIVO, INACTIVO] }
     *       - in: query
     *         name: habilitacion
     *         schema: { type: string, enum: [VIGENTE, VENCIDA] }
     *       - in: query
     *         name: busqueda
     *         schema: { type: string }
     *         description: Coincidencia parcial en nombre, apellido o email.
     *     responses:
     *       200:
     *         description: Cuentas de guía.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/CuentaGuia' }
     *       400:
     *         description: Filtro inválido.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil ADMIN.
     */
    router.get("/", controller.consultarUsuariosGuia);

    /**
     * @swagger
     * /api/cuentas-guia/{idusuario}/baja:
     *   patch:
     *     summary: Baja cuenta guía (CU-46)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Baja lógica de la cuenta de acceso: pasa a INACTIVO, el guía ya
     *       no puede iniciar sesión y se conserva todo su historial de salidas. El legajo del personal no
     *       se modifica (eso es la baja de personal, CU-25). No se puede dar de baja la cuenta de un guía
     *       asignado a una salida cuyo recorrido no finalizó. La verificación y la baja ocurren en
     *       una misma transacción.
     *     tags: [Cuentas de guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: idusuario
     *         required: true
     *         schema: { type: integer }
     *         description: ID del usuario (cuenta) del guía, no el del personal.
     *     responses:
     *       200:
     *         description: Cuenta dada de baja.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/CuentaGuia' }
     *       400:
     *         description: La cuenta ya estaba dada de baja o el guía tiene salidas pendientes.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorRespuesta' }
     *       404:
     *         description: No existe una cuenta de guía con ese ID.
     */
    router.patch("/:idusuario/baja", controller.darDeBajaCuenta);

    return router;
  }
}