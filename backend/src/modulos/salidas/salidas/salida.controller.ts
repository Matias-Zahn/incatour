import { Request, Response, NextFunction } from "express";
import { SalidaService } from "./salida.service";
import { ConsultarSalidasDto, CrearSalidaDto } from "./salida.dto";
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

  // CU-36 pasos 4 a 7: GET /api/salidas/opciones?idpaquete=&fechaInicio=&tamanoMaximo=
  consultarOpcionesSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearSalidaDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const opciones = await salidaService.consultarOpcionesSalida(dto!);
      return res.json({ data: opciones });
    } catch (error) {
      next(error);
    }
  };

  // CU-36: POST /api/salidas (confirmarCreacionSalida)
  confirmarCreacionSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearSalidaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await salidaService.crearSalida(dto!);
      return res.status(201).json({ mensaje: "Salida creada y publicada exitosamente", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
