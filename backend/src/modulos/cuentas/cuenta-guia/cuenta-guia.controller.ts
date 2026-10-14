import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { FiltrosCuentaGuiaDto } from "./cuenta-guia.dto";
import { CuentaGuiaService } from "./cuenta-guia.service";

const cuentaGuiaService = new CuentaGuiaService();

export class CuentaGuiaController {
  // CU-44: GET /api/cuentas-guia
  consultarUsuariosGuia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosCuentaGuiaDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const cuentas = await cuentaGuiaService.consultarUsuariosGuia(filtros!);
      return res.json({ data: cuentas });
    } catch (error) {
      next(error);
    }
  };

  // CU-46: PATCH /api/cuentas-guia/:idusuario/baja
  darDeBajaCuenta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idusuario = parseInt(req.params.idusuario as string);
      if (isNaN(idusuario)) throw CustomError.badRequest("El ID de usuario proporcionado no es válido.");

      const cuenta = await cuentaGuiaService.darDeBajaCuenta(idusuario);
      return res.json({ mensaje: "Cuenta de guía dada de baja exitosamente", data: cuenta });
    } catch (error) {
      next(error);
    }
  };
}