import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { PaqueteService } from "./paquete.service";

const paqueteService = new PaqueteService();

export class PaqueteController {

  // GET /api/paquetes
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

  // POST /api/paquetes — CU-10: Crear Paquete Turístico
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
}
