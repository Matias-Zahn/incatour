import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../error/CustomError";
import { FiltrosReporteDto } from "./reporte.dto";
import { ReporteService } from "./reporte.service";

const service = new ReporteService();

type Reporte = "ventas" | "ocupacion" | "cancelaciones" | "solicitudes" | "calidad";

export class ReporteController {
  // GET /api/reportes/:reporte?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  generar = (reporte: Reporte) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosReporteDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      return res.json({ data: await service[reporte](filtros!) });
    } catch (err) {
      next(err);
    }
  };
}
