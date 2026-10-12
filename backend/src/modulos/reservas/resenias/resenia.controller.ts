import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { FiltrosReseniaDto, PublicarReseniaDto } from "./resenia.dto";
import { ReseniaService } from "./resenia.service";

const reseniaService = new ReseniaService();

export class ReseniaController {
  // CU-47 (consultarHistorialReservas): GET /api/resenias/historial-reservas
  consultarHistorialReservas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const historial = await reseniaService.consultarHistorialReservas(req.usuarioAutenticado!.idusuario);
      return res.json({ data: historial });
    } catch (error) {
      next(error);
    }
  };

  // CU-47 (confirmarPublicacion): POST /api/resenias
  publicarResenia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = PublicarReseniaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resenia = await reseniaService.publicarResenia(req.usuarioAutenticado!.idusuario, dto!);
      return res.status(201).json({ mensaje: "Reseña publicada correctamente", data: resenia });
    } catch (error) {
      next(error);
    }
  };

  // CU-43: GET /api/resenias
  consultarResenias = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosReseniaDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const resultado = await reseniaService.consultarResenias(filtros!);
      return res.json({ data: resultado });
    } catch (error) {
      next(error);
    }
  };
}