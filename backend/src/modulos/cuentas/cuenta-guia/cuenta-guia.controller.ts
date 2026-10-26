import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearCuentaGuiaDto, FiltrosCuentaGuiaDto, ModificarCuentaGuiaDto } from "./cuenta-guia.dto";
import { CuentaGuiaService } from "./cuenta-guia.service";
import { leerIdUrl } from "../../../shared/validaciones";

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

  // CU-45: POST /api/cuentas-guia — Alta de cuenta de guía
  crearCuentaGuia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearCuentaGuiaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const cuenta = await cuentaGuiaService.crearCuentaGuia(dto!);
      return res.status(201).json({ mensaje: "Cuenta de guía creada exitosamente", data: cuenta });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/cuentas-guia/:idusuario — Modificar cuenta de guía (por administrador)
  modificarCuenta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idusuario = leerIdUrl(req.params.idusuario, "El ID de usuario proporcionado no es válido.");

      const [error, dto] = ModificarCuentaGuiaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const cuenta = await cuentaGuiaService.modificarCuenta(idusuario, dto!);
      return res.json({ mensaje: "Cuenta de guía modificada exitosamente", data: cuenta });
    } catch (error) {
      next(error);
    }
  };

  // CU-46: PATCH /api/cuentas-guia/:idusuario/baja
  darDeBajaCuenta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idusuario = leerIdUrl(req.params.idusuario, "El ID de usuario proporcionado no es válido.");

      const cuenta = await cuentaGuiaService.darDeBajaCuenta(idusuario);
      return res.json({ mensaje: "Cuenta de guía dada de baja exitosamente", data: cuenta });
    } catch (error) {
      next(error);
    }
  };
}
