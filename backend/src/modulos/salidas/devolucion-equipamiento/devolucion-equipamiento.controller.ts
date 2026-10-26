import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { DevolucionEquipamientoDto } from "./devolucion-equipamiento.dto";
import { DevolucionEquipamientoService } from "./devolucion-equipamiento.service";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new DevolucionEquipamientoService();

export class DevolucionEquipamientoController {
  obtenerEquipamientoAsignado = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdUrl(req.params.idsalida, "idsalida debe ser un número entero.");

      const resultado = await service.obtenerEquipamientoAsignado(idsalida);
      return res.status(200).json({ data: resultado });
    } catch (error) {
      next(error);
    }
  };

  registrarDevolucion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdUrl(req.params.idsalida, "idsalida debe ser un número entero.");

      const [error, dto] = DevolucionEquipamientoDto.create(req.body);
      if (error) {
        throw CustomError.badRequest(error);
      }

      const usuarioEmail = req.usuarioAutenticado?.email ?? "admin@incatour.com";
      const resultado = await service.registrarDevolucion(idsalida, dto!, usuarioEmail);

      const { mensaje, ...data } = resultado;
      return res.status(200).json({ mensaje, data });
    } catch (error) {
      next(error);
    }
  };
}
