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
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [ACTIVO, INACTIVO]
 *         description: Filtrar por estado
 *       - in: query
 *         name: idcircuito
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de circuito
 *       - in: query
 *         name: nombrePaquete
 *         schema:
 *           type: string
 *         description: Filtrar por nombre del paquete
 *     responses:
 *       200:
 *         description: Lista de paquetes obtenida exitosamente
 *   post:
 *     summary: Crear Paquete Turístico (CU-11)
 *     tags: [Paquetes]
 *     security:
 *       - BearerAuth: []
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
 *     security:
 *       - BearerAuth: []
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
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paquete dado de baja exitosamente
 *       400:
 *         description: No se puede dar de baja porque tiene salidas activas
 *       404:
 *         description: Paquete no encontrado o inactivo
 *
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
import {
  subirImagenPaquete,
  subirCarruselPaquete,
  modificarFotoEspecifica,
} from "../../../shared/upload/uploadPaquete.middleware";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class PaqueteRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new PaqueteController();

    // Consulta de imágenes del paquete (PÚBLICO para catálogo y cliente)
    router.get("/:id/imagenes", controller.consultarImagenes);

    // Gestión interna: solo el administrador
    router.use(autenticar, requierePerfil("ADMIN"));

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

    // Subir imagen individual (portada principal)
    router.post("/:id/imagen", subirImagenPaquete.single("imagen"), controller.subirImagen);
    router.put("/:id/imagen", subirImagenPaquete.single("imagen"), controller.subirImagen);

    // Subir / Modificar carrusel de fotos (de 1 a 5 fotos, la 1° es la principal)
    router.post("/:id/carrusel", subirCarruselPaquete.array("imagenes", 5), controller.subirCarrusel);
    router.put("/:id/carrusel", subirCarruselPaquete.array("imagenes", 5), controller.subirCarrusel);

    // Reemplazar una foto en particular del carrusel (ej: foto_2, principal)
    router.put(
      "/:id/carrusel/:nombreFoto",
      modificarFotoEspecifica.single("imagen"),
      controller.modificarFotoIndividual
    );

    // Eliminar una foto en particular del carrusel (ej: foto_2, principal)
    router.delete("/:id/carrusel/:nombreFoto", controller.eliminarFotoIndividual);

    return router;
  }
}
