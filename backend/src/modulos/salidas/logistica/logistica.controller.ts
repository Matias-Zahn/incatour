import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ModificarLogisticaDto, TipoRecursoDto } from "./logistica.dto";
import { LogisticaService } from "./logistica.service";

const service = new LogisticaService();

const leerIdSalida = (req: Request): number => {
  const id = parseInt(req.params.idsalida as string);
  if (isNaN(id)) throw CustomError.badRequest("El ID de salida proporcionado no es válido.");
  return id;
};

export class LogisticaController {
  // DCD obtenerPanelLogistica: GET /api/salidas/:idsalida/logistica
  obtenerPanelLogistica = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const panel = await service.obtenerPanelLogistica(leerIdSalida(req));
      return res.json({ data: panel });
    } catch (error) {
      next(error);
    }
  };

  // DCD consultarProveedoresDisponibles: GET /api/salidas/:idsalida/logistica/disponibles?tipo=
  consultarDisponibles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req);
      const [error, dto] = TipoRecursoDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const disponibles = await service.consultarDisponibles(idsalida, dto!);
      return res.json({ data: disponibles });
    } catch (error) {
      next(error);
    }
  };

  // CU-39 (confirmarModificacion): PUT /api/salidas/:idsalida/logistica
  confirmarModificacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req);
      const [error, dto] = ModificarLogisticaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.confirmarModificacion(idsalida, dto!, req.usuarioAutenticado!);
      return res.json({ mensaje: "Logística modificada exitosamente", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}