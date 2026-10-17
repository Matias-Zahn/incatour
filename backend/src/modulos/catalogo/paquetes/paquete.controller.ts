import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { PaqueteService } from "./paquete.service";

const paqueteService = new PaqueteService();

export class PaqueteController {

  // GET /api/paquetes — CU-10: Consultar paquetes turísticos
  consultarPaquetes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paquetes = await paqueteService.consultarPaquetes();
      return res.json({ data: paquetes });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/paquetes/:id
  consultarPaquetePorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const paquete = await paqueteService.consultarPaquetePorId(id);
      return res.json({ data: paquete });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/paquetes — CU-11: Crear Paquete Turístico
  confirmarCreacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearPaqueteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const paquete = await paqueteService.registrarNuevoPaquete(dto!);

      return res.status(201).json({
        mensaje: "Paquete turístico creado y publicado exitosamente",
        data: paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/paquetes/:id — CU-12: Modificar Paquete
  modificarPaquete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const [error, dto] = ModificarPaqueteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const paquete = await paqueteService.modificarPaquete(id, dto!);

      return res.json({
        mensaje: "Paquete turístico modificado exitosamente",
        data: paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/paquetes/:id/baja — CU-13: Baja de Paquete
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const paquete = await paqueteService.darDeBajaPaquete(id);

      return res.json({
        mensaje: "Paquete turístico dado de baja exitosamente",
        data: paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/paquetes/:id/imagen — Subir imagen del paquete
  subirImagen = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      // Verificamos que el paquete exista
      await paqueteService.consultarPaquetePorId(id);

      if (!req.file) {
        throw CustomError.badRequest("Debe adjuntar un archivo de imagen en el campo 'imagen'.");
      }

      const urlImagen = `/imagenes/paquetes/${id}/${req.file.filename}`;

      return res.status(200).json({
        mensaje: "Imagen del paquete subida exitosamente.",
        idpaquete: id,
        archivo: req.file.filename,
        url: urlImagen,
      });
    } catch (error) {
      next(error);
    }
  };
}
