import { Request, Response, NextFunction } from "express";
import { CatalogoService } from "./catalogo.service";
import { FiltrosCatalogo } from "./catalogo.repository";
import { FiltrosCatalogoDto } from "./catalogo.dto";
import { CustomError } from "../../../error/CustomError";

const catalogoService = new CatalogoService();

export class CatalogoController {
  
  // GET /api/catalogo (CU-26)
  consultarCatalogoPublico = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = FiltrosCatalogoDto.create(req.query);
      if (error) throw CustomError.badRequest(error);
      const filtros: FiltrosCatalogo = {
        dificultad: dto!.dificultad as string | undefined,
        duracionDias: dto!.duracionDias,
        fechaDesde: dto!.fechaDesde,
        fechaHasta: dto!.fechaHasta,
      };

      const resultados = await catalogoService.consultarCatalogo(filtros);
      
      return res.json({
        mensaje: "Catálogo público consultado exitosamente",
        cantidad: resultados.length,
        data: resultados
      });
    } catch (error) {
      next(error);
    }
  };
}
