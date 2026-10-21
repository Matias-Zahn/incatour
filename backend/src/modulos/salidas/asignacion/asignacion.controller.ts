import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ConfirmarAsignacionDto } from "./asignacion.dto";
import { AsignacionService } from "./asignacion.service";

const service = new AsignacionService();

const leerId = (valor: unknown) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw CustomError.badRequest("El id de la salida debe ser un entero positivo");
  return id;
};

export class AsignacionController {
  // CU-40: GET /api/salidas/:idsalida/asignacion
  obtenerPanelAsignacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const panel = await service.obtenerPanelAsignacion(leerId(req.params.idsalida));
      return res.json({ data: panel });
    } catch (error) {
      next(error);
    }
  };

  // CU-40: POST /api/salidas/:idsalida/asignacion
  confirmarAsignacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerId(req.params.idsalida);
      const [error, dto] = ConfirmarAsignacionDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.confirmarAsignacion(idsalida, dto!);
      return res.json({ mensaje: "Asignación confirmada y permisos de la nómina emitidos", data: resultado });
    } catch (error) {
      next(error);
    }
  };

  // CU-40 paso 12 (reintento): POST /api/salidas/:idsalida/asignacion/liberar-sobrantes
  liberarSobrantes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = await service.liberarSobrantes(leerId(req.params.idsalida));
      return res.json({ data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
