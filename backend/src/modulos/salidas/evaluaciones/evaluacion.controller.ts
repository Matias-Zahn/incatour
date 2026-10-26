import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { EvaluarDto } from "./evaluacion.dto";
import { EvaluacionService } from "./evaluacion.service";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new EvaluacionService();

const leerIdSalida = (valor: unknown) => {
  return leerIdUrl(valor, "El id de la salida debe ser un entero positivo");
};

export class EvaluacionController {
  // CU-42: GET /api/salidas/:idsalida/evaluaciones
  consultarEvaluables = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarEvaluables(leerIdSalida(req.params.idsalida));
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-42: POST /api/salidas/:idsalida/evaluaciones
  evaluar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req.params.idsalida);
      const [error, dto] = EvaluarDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const data = await service.evaluar(idsalida, dto!);
      return res.status(201).json({ mensaje: "Evaluación registrada", data });
    } catch (error) {
      next(error);
    }
  };
}
