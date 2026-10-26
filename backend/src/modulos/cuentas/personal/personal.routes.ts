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
     *     summary: Registrar personal operativo (guía o porteador)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.**
     *       Crea el legajo operativo (tabla Personal). Para un guía, email y contraseña son opcionales
     *       pero van juntos: si vienen, crea también las credenciales de acceso (tabla Usuario con rol GUIA)
     *       en la misma transacción; si no, el guía queda sin cuenta y se le crea después con `POST /api/cuentas-guia`.
     *       La habilitación (nroHabilitacion y fechaHabilitacion) es obligatoria para un guía.
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
     *                 description: Opcional, solo guías. Si se envía, la contraseña es obligatoria.
     *               contrasenia:
     *                 type: string
     *                 minLength: 8
     *                 example: MiClaveSecreta123
     *                 description: Opcional, solo guías. Si se envía, el email es obligatorio.
     *               nroHabilitacion:
     *                 type: string
     *                 example: H-12345
     *                 description: Obligatorio para un guía.
     *               fechaHabilitacion:
     *                 type: string
     *                 format: date
     *                 example: "2030-12-31"
     *                 description: Obligatoria para un guía. Vencimiento de la habilitación (hoy cuenta como vigente).
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
     *         description: Error de validación (nombre con símbolos, pasaporte vencido, contraseña menor a 8 caracteres).
     *       409:
     *         description: Email o pasaporte duplicado (CTA-10).
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere el perfil ADMIN.
     */
    router.post("/", autenticar, requierePerfil("ADMIN"), controller.crearPersonal);

    /**
     * @swagger
     * /api/personal:
     *   get:
     *     summary: Consultar personal operativo (CU-22)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista guías y porteadores con sus datos de pasaporte y,
     *       en los guías, su habilitación. Todos los filtros son opcionales.
     *     tags: [Personal]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: query, name: rol, schema: { type: string, enum: [Guía, Porteador] } }
     *       - { in: query, name: estado, schema: { type: string, enum: [ACTIVO, INACTIVO] } }
     *       - in: query
     *         name: habilitacionVigente
     *         schema: { type: boolean }
     *         description: true = habilitación vigente, false = vencida. Deja solo guías.
     *     responses:
     *       200:
     *         description: Lista de personal ordenada por nombre.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/Personal' }
     *       400: { description: Filtro inválido. }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *
     * components:
     *   schemas:
     *     Personal:
     *       type: object
     *       properties:
     *         idpersonal: { type: integer, example: 1 }
     *         nombreCompleto: { type: string, example: Carlos Mamani }
     *         nroPasaporte: { type: string, example: P123456 }
     *         nacionalidad: { type: string, example: Peruana }
     *         fechaVencimientoPasaporte: { type: string, format: date-time }
     *         estado: { type: string, enum: [ACTIVO, INACTIVO] }
     *         rol: { type: string, enum: [Guía, Porteador] }
     *         guia:
     *           type: object
     *           nullable: true
     *           description: Solo en guías. Los porteadores tienen null.
     *           properties:
     *             nroHabilitacion: { type: string, example: HAB-001 }
     *             fechaHabilitacion: { type: string, format: date-time, description: Vencimiento de la habilitación. }
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarPersonal);

    /**
     * @swagger
     * /api/personal/{id}:
     *   put:
     *     summary: Modificar personal operativo (CU-24)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Modificación parcial: se envían solo los campos que cambian.
     *       La habilitación solo se acepta para guías. El rol no se modifica y el estado se cambia con la baja (CU-25).
     *     tags: [Personal]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: id, required: true, schema: { type: integer } }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               nombreCompleto: { type: string, example: Carlos Mamani, description: Solo letras y espacios. }
     *               nroPasaporte: { type: string, example: P123456, description: No puede estar usado por otra persona. }
     *               nacionalidad: { type: string, example: Peruana }
     *               fechaVencimientoPasaporte: { type: string, format: date, example: "2031-01-01", description: No puede ser pasada. }
     *               nroHabilitacion: { type: string, example: HAB-001-R, description: Solo guías. }
     *               fechaHabilitacion: { type: string, format: date, example: "2028-12-31", description: Solo guías. No puede ser pasada. }
     *     responses:
     *       200:
     *         description: Personal modificado.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Personal' }
     *       400: { description: Datos inválidos, body vacío, intento de cambiar rol o estado, habilitación en un porteador, fecha vencida o personal dado de baja. }
     *       409: { description: Pasaporte repetido (CTA-10). }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *       404: { description: El personal no existe. }
     */
    router.put("/:id", autenticar, requierePerfil("ADMIN"), controller.modificarPersonal);

    /**
     * @swagger
     * /api/personal/{id}/baja:
     *   patch:
     *     summary: Baja de personal operativo (CU-25)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Baja lógica: el personal queda INACTIVO y, si es guía, también su cuenta de acceso.
     *       No procede si está asignado a una salida que todavía no finalizó (PUBLICADA, ABIERTA, CERRADA o EN_CURSO).
     *     tags: [Personal]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: id, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Personal dado de baja.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data: { $ref: '#/components/schemas/Personal' }
     *       400: { description: Asignado a salidas sin finalizar, o ya dado de baja. }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *       404: { description: El personal no existe. }
     */
    router.patch("/:id/baja", autenticar, requierePerfil("ADMIN"), controller.darDeBaja);

    return router;
  }
}
