import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CancelarSalidaDto } from "./cancelacion-salida.dto";
import { CancelacionSalidaService } from "./cancelacion-salida.service";

const service = new CancelacionSalidaService();

const leerIdSalida = (req: Request): number => {
  const id = parseInt(req.params.idsalida as string);
  if (isNaN(id)) throw CustomError.badRequest("El ID de salida proporcionado no es válido.");
  return id;
};

export class CancelacionSalidaController {
  // GET /api/salidas/:idsalida/cancelacion  (impacto antes de confirmar)
  solicitarCancelacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resumen = await service.solicitarCancelacion(leerIdSalida(req));
      return res.json({ data: resumen });
    } catch (error) {
      next(error);
    }
  };

  // CU-37 (confirmarCancelacionSalida): POST /api/salidas/:idsalida/cancelar
  confirmarCancelacionSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req);
      const [error, dto] = CancelarSalidaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.confirmarCancelacion(idsalida, dto!, req.usuarioAutenticado!);
      return res.json({ mensaje: "Salida cancelada exitosamente", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}