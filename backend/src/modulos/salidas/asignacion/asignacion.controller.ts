import { Request, Response, NextFunction } from "express";
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

  // CU-40 "Confirmar salida": POST /api/salidas/:idsalida/asignacion, body vacío (decisión 15).
  // Una salida creada antes de la etapa 3, sin personal, lo recibe acá en personalIds
  confirmarAsignacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { personalIds, porteadoresALiberar } = req.body ?? {};
      if (personalIds !== undefined && (!Array.isArray(personalIds) || !personalIds.length || !personalIds.every((id) => Number.isInteger(id) && id > 0) || new Set(personalIds).size !== personalIds.length)) {
        return res.status(400).json({ error: "personalIds debe ser una lista de ids de personal, sin repetidos" });
      }
      if (porteadoresALiberar !== undefined && (!Array.isArray(porteadoresALiberar) || !porteadoresALiberar.every((id) => Number.isInteger(id) && id > 0) || new Set(porteadoresALiberar).size !== porteadoresALiberar.length)) {
        return res.status(400).json({ error: "porteadoresALiberar debe ser una lista de ids de personal, sin repetidos" });
      }
      const resultado = await service.confirmarAsignacion(leerId(req.params.idsalida), personalIds, porteadoresALiberar);
      // SAL-20: con rechazados, el mensaje lo dice. Solo el personal se reemplaza (CU-38)
      const { permisosEmitidos, rechazados } = resultado;
      const personalRechazado = rechazados.some((r) => r.tipo === "PERSONAL");
      const mensaje = rechazados.length
        ? `Salida confirmada: ${permisosEmitidos} ${permisosEmitidos === 1 ? "permiso emitido" : "permisos emitidos"} y ` +
          `${rechazados.length} ${rechazados.length === 1 ? "rechazado" : "rechazados"}` +
          (personalRechazado ? ". Hay que reemplazar al personal rechazado" : "")
        : "Salida confirmada y permisos de la nómina emitidos";
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
