import { Request, Response, NextFunction } from "express";
import { TemporadaService } from "./temporada.service";
import { CrearTemporadaDto, ModificarTemporadaDto } from "./temporada.dto";
import { CustomError } from "../../../error/CustomError";

const temporadaService = new TemporadaService();

export class TemporadaController {

  // CU-06: GET /api/temporadas
  consultarTemporadas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const temporadas = await temporadaService.consultarTemporadas();
      return res.json({ data: temporadas });
    } catch (error) {
      next(error);
    }
  };

  // CU-07: POST /api/temporadas
  crearTemporada = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearTemporadaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const temporada = await temporadaService.crearTemporada(dto!);

      return res.status(201).json({
        mensaje: "Temporada creada exitosamente",
        data: temporada,
      });
    } catch (error) {
      next(error);
    }
  };

  // CU-08: PUT /api/temporadas/:id
  modificarTemporada = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const [error, dto] = ModificarTemporadaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const temporada = await temporadaService.modificarTemporada(id, dto!);

      return res.json({
        mensaje: "Temporada modificada exitosamente",
        data: temporada,
      });
    } catch (error) {
      next(error);
    }
  };

  // CU-09: PATCH /api/temporadas/:id/baja
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const temporada = await temporadaService.darDeBajaTemporada(id);

      return res.json({
        mensaje: "Temporada dada de baja exitosamente",
        data: temporada,
      });
    } catch (error) {
      next(error);
    }
  };
}
