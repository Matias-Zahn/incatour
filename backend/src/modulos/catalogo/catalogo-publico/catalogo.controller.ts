import { Request, Response, NextFunction } from "express";
import { CatalogoService } from "./catalogo.service";
import { FiltrosCatalogo } from "./catalogo.repository";

const catalogoService = new CatalogoService();

export class CatalogoController {
  
  // GET /api/catalogo (CU-26)
  consultarCatalogoPublico = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros: FiltrosCatalogo = {
        dificultad: req.query.dificultad as string | undefined,
        duracionDias: req.query.duracionDias as string | undefined,
        fechaDesde: (req.query.fechaDesde ?? req.query.fechaInicio) as string | undefined,
        fechaHasta: (req.query.fechaHasta ?? req.query.fechaFin) as string | undefined,
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
