import { Request, Response, NextFunction } from "express";
import { SalidaService } from "./salida.service";
import { ConsultarSalidasDto } from "./salida.dto";
import { CustomError } from "../../../error/CustomError";

const salidaService = new SalidaService();

export class SalidaController {
  // CU-35: GET /api/salidas?idpaquete=&estado=&desde=&hasta=&idguia=
  consultarSalidas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = ConsultarSalidasDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const salidas = await salidaService.consultarSalidas(dto!);
      return res.json({ data: salidas });
    } catch (error) {
      next(error);
    }
  };
}
