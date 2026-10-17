import { Router } from "express";
import { PaqueteController } from "./paquete.controller";

/**
 * @swagger
 * tags:
 *   name: Paquetes
 *   description: Gestión del CRUD de Paquetes Turísticos
 * 
 * /api/paquetes:
 *   get:
 *     summary: Consultar paquetes turísticos (CU-10)
 *     tags: [Paquetes]
 *     responses:
 *       200:
 *         description: Lista de paquetes obtenida exitosamente
 *   post:
 *     summary: Crear Paquete Turístico (CU-11)
 *     tags: [Paquetes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idcircuito:
 *                 type: integer
 *               nombrePaquete:
 *                 type: string
 *               tipoGarantia:
 *                 type: string
 *               idservicioGarantizado:
 *                 type: integer
 *               nochesPrevias:
 *                 type: integer
 *               nochesPosteriores:
 *                 type: integer
 *               matrizPrecios:
 *                 type: array
 *                 items:
 *                   type: object
 *               serviciosIncluidos:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Paquete creado exitosamente
 * 
 * /api/paquetes/{id}:
 *   get:
 *     summary: Obtener paquete por ID
 *     tags: [Paquetes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paquete encontrado
 *   put:
 *     summary: Modificar Paquete (CU-12)
 *     tags: [Paquetes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Paquete modificado exitosamente
 * 
 * /api/paquetes/{id}/baja:
 *   patch:
 *     summary: Dar de baja Paquete (CU-13)
 *     tags: [Paquetes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 * /api/paquetes/{id}/imagen:
 *   post:
 *     summary: Subir imagen de un paquete turístico
 *     description: >
 *       **RESTRINGIDO A ADMINISTRADOR.** Permite subir un archivo de imagen (JPG, PNG o WEBP, máx 3 MB).
 *       La imagen se almacena en /public/imagenes/paquetes/{id}/ y se sirve directamente vía Express.
 *     tags: [Paquetes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - imagen
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagen subida exitosamente
 *       400:
 *         description: Formato inválido o archivo no proporcionado
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Requiere rol ADMIN
 *       404:
 *         description: Paquete no encontrado
 */
import { subirImagenPaquete } from "../../../shared/upload/uploadPaquete.middleware";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class PaqueteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PaqueteController();

    // CU-10: Consultar paquetes activos
    router.get("/", controller.consultarPaquetes);

    // Consultar paquete por ID
    router.get("/:id", controller.consultarPaquetePorId);

    // CU-11: Crear Paquete Turístico
    router.post("/", controller.confirmarCreacion);

    // CU-12: Modificar Paquete
    router.put("/:id", controller.modificarPaquete);

    // CU-13: Baja de Paquete
    router.patch("/:id/baja", controller.darDeBaja);

    // Subir imagen del paquete (JPG, PNG, WEBP, máx 3MB)
    router.post(
      "/:id/imagen",
      autenticar,
      requierePerfil("ADMIN"),
      subirImagenPaquete.single("imagen"),
      controller.subirImagen
    );

    return router;
  }
}
