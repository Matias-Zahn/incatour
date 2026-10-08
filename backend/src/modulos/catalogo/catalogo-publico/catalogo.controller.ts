import { Request, Response, NextFunction } from "express";
import { CatalogoService } from "./catalogo.service";

const catalogoService = new CatalogoService();

export class CatalogoController {
  
  // GET /api/catalogo
  consultarCatalogoPublico = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultados = await catalogoService.consultarCatalogo();
      
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
