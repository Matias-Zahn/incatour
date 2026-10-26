import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ConfirmarAsignacionDto } from "./asignacion.dto";
import { AsignacionService } from "./asignacion.service";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new AsignacionService();

const leerId = (valor: unknown) => {
  return leerIdUrl(valor, "El id de la salida debe ser un entero positivo");
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
      // SAL-20: con rechazados, el mensaje lo dice. Solo el personal se reemplaza (CU-38)
      const { permisosEmitidos, rechazados } = resultado;
      const personalRechazado = rechazados.some((r) => r.tipo === "PERSONAL");
      const mensaje = rechazados.length
        ? `Asignación confirmada: ${permisosEmitidos} ${permisosEmitidos === 1 ? "permiso emitido" : "permisos emitidos"} y ` +
          `${rechazados.length} ${rechazados.length === 1 ? "rechazado" : "rechazados"}` +
          (personalRechazado ? ". Hay que reemplazar al personal rechazado" : "")
        : "Asignación confirmada y permisos de la nómina emitidos";
      return res.json({ mensaje, data: resultado });
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
