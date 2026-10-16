import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ConfirmarReemplazoDto } from "./reemplazo.dto";
import { ReemplazoService } from "./reemplazo.service";

const service = new ReemplazoService();

const leerId = (valor: unknown, campo: string) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw CustomError.badRequest(`${campo} debe ser un entero positivo`);
  return id;
};

export class ReemplazoController {
  // CU-38: GET /api/salidas/:idsalida/personal
  consultarPersonalSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarPersonalSalida(leerId(req.params.idsalida, "idsalida"));
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-38: GET /api/salidas/:idsalida/personal/:idpersonal/reemplazantes
  consultarReemplazantesDisponibles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarReemplazantesDisponibles(
        leerId(req.params.idsalida, "idsalida"),
        leerId(req.params.idpersonal, "idpersonal")
      );
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-38: POST /api/salidas/:idsalida/reemplazos
  confirmarReemplazo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerId(req.params.idsalida, "idsalida");
      const [error, dto] = ConfirmarReemplazoDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const data = await service.confirmarReemplazo(idsalida, dto!, req.usuarioAutenticado!.email);
      return res.json({ mensaje: "Reemplazo realizado correctamente", data });
    } catch (error) {
      next(error);
    }
  };
}
