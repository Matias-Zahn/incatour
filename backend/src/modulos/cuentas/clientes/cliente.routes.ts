import { Router } from "express";
import { ClienteController } from "./cliente.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ClienteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ClienteController();

    /**
     * @swagger
     * /api/clientes:
     *   get:
     *     summary: Obtener todos los clientes activos
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.**
     *       Devuelve la lista completa de clientes con estado ACTIVO,
     *       incluyendo nombre, apellido y email heredados de la tabla Usuario.
     *     tags: [Clientes]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Lista de clientes obtenida exitosamente.
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere el perfil ADMIN.
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarClientes);

    /**
     * @swagger
     * /api/clientes/{id}:
     *   get:
     *     summary: Obtener un cliente por su ID
     *     description: >
     *       Accesible por el propio Cliente (para ver su propio perfil) o por el Administrador.
     *     tags: [Clientes]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: integer
     *         required: true
     *         description: ID numérico del cliente
     *     responses:
     *       200:
     *         description: Cliente encontrado.
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere perfil ADMIN o CLIENTE.
     *       404:
     *         description: Cliente no encontrado.
     */
    router.get("/:id", autenticar, requierePerfil("ADMIN", "CLIENTE"), controller.consultarClientePorId);

    /**
     * @swagger
     * /api/clientes:
     *   post:
     *     summary: Registrar un nuevo cliente
     *     description: >
     *       **Endpoint público — no requiere autenticación.**
     *       Es la puerta de entrada al sistema para nuevos usuarios.
     *       Crea simultáneamente la cuenta de acceso (tabla Usuario con rol CLIENTE)
     *       y el perfil comercial (tabla Cliente) dentro de una transacción atómica.
     *     tags: [Clientes]
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
     *             properties:
     *               nombre:
     *                 type: string
     *                 maxLength: 64
     *                 example: Juan
     *                 description: Solo letras y espacios (sin números ni símbolos)
     *               apellido:
     *                 type: string
     *                 maxLength: 64
     *                 example: Pérez
     *                 description: Solo letras y espacios (sin números ni símbolos)
     *               email:
     *                 type: string
     *                 format: email
     *                 example: usuario@test.com
     *               contrasenia:
     *                 type: string
     *                 minLength: 8
     *                 example: password123
     *     responses:
     *       201:
     *         description: Cliente registrado exitosamente.
     *       400:
     *         description: Error de validación (nombre con símbolos, email duplicado, contraseña menor a 8 caracteres).
     */
    router.post("/", controller.crearCliente);

    /**
     * @swagger
     * /api/clientes/{id}:
     *   put:
     *     summary: Modificar datos de perfil de un cliente
     *     description: >
     *       **RESTRINGIDO AL PROPIO CLIENTE.**
     *       Permite actualizar nombre, apellido y email. La contraseña
     *       NO es modificable por este endpoint (requerimiento futuro del ERS).
     *       No se puede modificar una cuenta con estado INACTIVO.
     *     tags: [Clientes]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: integer
     *         required: true
     *         description: ID numérico del cliente a modificar
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               nombre:
     *                 type: string
     *                 maxLength: 64
     *                 example: Juan
     *               apellido:
     *                 type: string
     *                 maxLength: 64
     *                 example: Pérez
     *               email:
     *                 type: string
     *                 format: email
     *                 example: nuevo@email.com
     *     responses:
     *       200:
     *         description: Cliente actualizado exitosamente.
     *       400:
     *         description: Cuenta inactiva o email ya en uso.
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere el perfil CLIENTE.
     *       404:
     *         description: Cliente no encontrado.
     */
    router.put("/:id", autenticar, requierePerfil("CLIENTE"), controller.modificarCliente);

    /**
     * @swagger
     * /api/clientes/{id}/baja:
     *   patch:
     *     summary: Dar de baja lógica a un cliente
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.**
     *       Realiza una baja lógica (estado INACTIVO). No elimina el registro de la base de datos.
     *       No se puede dar de baja a un cliente que tenga reservas en estado "Confirmada".
     *     tags: [Clientes]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: integer
     *         required: true
     *         description: ID numérico del cliente a dar de baja
     *     responses:
     *       200:
     *         description: Cliente inhabilitado exitosamente.
     *       400:
     *         description: El cliente tiene reservas en estado Confirmada.
     *       401:
     *         description: Token no proporcionado o inválido/expirado.
     *       403:
     *         description: Acceso denegado. Se requiere el perfil ADMIN.
     *       404:
     *         description: Cliente no encontrado.
     */
    router.patch("/:id/baja", autenticar, requierePerfil("ADMIN"), controller.darDeBajaCliente);

    return router;
  }
}
