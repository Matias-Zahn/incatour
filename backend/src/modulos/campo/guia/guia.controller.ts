import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { GuiaService } from "./guia.service";

const service = new GuiaService();

export class GuiaController {
  // CU-48: GET /api/guia/salidas
  consultarSalidasAsignadas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarSalidasAsignadas(req.usuarioAutenticado!.idusuario);
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-48: GET /api/guia/salidas/:idsalida
  consultarDetalleSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = Number(req.params.idsalida);
      if (!Number.isInteger(idsalida) || idsalida <= 0) {
        throw CustomError.badRequest("El id de la salida debe ser un entero positivo");
      }
      const data = await service.consultarDetalleSalida(req.usuarioAutenticado!.idusuario, idsalida);
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };
}
