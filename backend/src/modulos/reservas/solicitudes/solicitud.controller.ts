import { Request, Response, NextFunction } from "express";
import { SolicitudService } from "./solicitud.service";
import { ResolverSolicitudDto } from "./solicitud.dto";
import { CustomError } from "../../../error/CustomError";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new SolicitudService();

export class SolicitudController {
  
  // GET /api/solicitudes
  consultarPendientes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultados = await service.consultarPendientes();
      return res.json({
        mensaje: "Solicitudes pendientes consultadas exitosamente",
        cantidad: resultados.length,
        data: resultados
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/solicitudes/:id/opciones
  obtenerOpcionesAlojamiento = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "ID inválido");

      const opciones = await service.buscarServiciosCompatibles(id);
      return res.json({ data: opciones });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/solicitudes/:id/resolver
  resolverSolicitud = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "ID inválido");

      const [errorDto, dto] = ResolverSolicitudDto.create(req.body);
      if (errorDto || !dto) throw CustomError.badRequest(errorDto!);

      const resultado = await service.procesarResolucion(id, dto);
      const { mensaje, ...data } = resultado;
      return res.status(200).json({ mensaje, data });
    } catch (error) {
      next(error);
    }
  };
}
