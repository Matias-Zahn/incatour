import { Router } from "express";
import { ClienteController } from "./cliente.controller";

export class ClienteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ClienteController();

    /**
     * @swagger
     * /api/clientes:
     *   get:
     *     summary: Obtener todos los clientes activos
     *     tags: [Clientes]
     *     responses:
     *       200:
     *         description: Lista de clientes obtenida exitosamente.
     */
    router.get("/", controller.consultarClientes);

    /**
     * @swagger
     * /api/clientes/{id}:
     *   get:
     *     summary: Obtener un cliente por su ID
     *     tags: [Clientes]
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
     *       404:
     *         description: Cliente no encontrado.
     */
    router.get("/:id", controller.consultarClientePorId);

    /**
     * @swagger
     * /api/clientes:
     *   post:
     *     summary: Crear un nuevo cliente (Registro)
     *     tags: [Clientes]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email:
     *                 type: string
     *                 example: usuario@test.com
     *               contrasenia:
     *                 type: string
     *                 example: password123
     *               nombre:
     *                 type: string
     *                 example: Juan
     *               apellido:
     *                 type: string
     *                 example: Pérez
     *     responses:
     *       201:
     *         description: Cliente creado exitosamente.
     *       400:
     *         description: Error de validación o correo duplicado.
     */
    router.post("/", controller.crearCliente);

    /**
     * @swagger
     * /api/clientes/{id}:
     *   put:
     *     summary: Modificar datos de un cliente
     *     tags: [Clientes]
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: integer
     *         required: true
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               nombre:
     *                 type: string
     *               apellido:
     *                 type: string
     *               email:
     *                 type: string
     *     responses:
     *       200:
     *         description: Cliente actualizado.
     */
    router.put("/:id", controller.modificarCliente);

    /**
     * @swagger
     * /api/clientes/{id}/baja:
     *   patch:
     *     summary: Dar de baja lógica a un cliente
     *     tags: [Clientes]
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: integer
     *         required: true
     *     responses:
     *       200:
     *         description: Cliente inhabilitado exitosamente.
     *       400:
     *         description: El cliente tiene reservas activas.
     */
    router.patch("/:id/baja", controller.darDeBajaCliente);

    return router;
  }
}
