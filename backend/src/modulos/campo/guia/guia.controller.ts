import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { NIVEL_GRAVEDAD, RegistrarAvanceDto, RegistrarIncidenteDto } from "./guia.dto";
import { GuiaService } from "./guia.service";

const service = new GuiaService();

const leerIdSalida = (valor: unknown) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw CustomError.badRequest("El id de la salida debe ser un entero positivo");
  return id;
};

export class GuiaController {
  // CU-48: GET /api/guia/salidas
  consultarSalidasAsignadas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarSalidasAsignadas(req.usuarioAutenticado!.idusuario);
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-48: GET /api/guia/salidas/:idsalida
  consultarDetalleSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarDetalleSalida(req.usuarioAutenticado!.idusuario, leerIdSalida(req.params.idsalida));
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-49: POST /api/guia/salidas/:idsalida/avances
  registrarAvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req.params.idsalida);
      const [error, dto] = RegistrarAvanceDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const data = await service.registrarAvance(req.usuarioAutenticado!.idusuario, idsalida, dto!);
      return res.status(201).json({ mensaje: "Avance registrado correctamente", data });
    } catch (error) {
      next(error);
    }
  };

  // CU-50 FA1: GET /api/guia/salidas/:idsalida/pasajeros
  consultarPasajerosSalida = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.consultarPasajerosSalida(req.usuarioAutenticado!.idusuario, leerIdSalida(req.params.idsalida));
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  // CU-50: POST /api/guia/salidas/:idsalida/incidentes
  confirmarRegistroIncidente = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idsalida = leerIdSalida(req.params.idsalida);
      const [error, dto] = RegistrarIncidenteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const data = await service.registrarIncidente(req.usuarioAutenticado!.idusuario, idsalida, dto!);
      return res.status(201).json({ mensaje: "Incidente registrado y notificado al administrador", data });
    } catch (error) {
      next(error);
    }
  };

  // CU-50 paso 17: GET /api/incidentes (panel del administrador)
  listarIncidentes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { idsalida, nivelGravedad } = req.query;
      const filtros: { idsalida?: number; nivelGravedad?: string } = {};
      if (idsalida !== undefined) filtros.idsalida = leerIdSalida(idsalida);
      if (nivelGravedad !== undefined) {
        if (!(NIVEL_GRAVEDAD as readonly unknown[]).includes(nivelGravedad)) {
          throw CustomError.badRequest(`nivelGravedad debe ser ${NIVEL_GRAVEDAD.join(", ")}`);
        }
        filtros.nivelGravedad = String(nivelGravedad);
      }
      const data = await service.listarIncidentes(filtros);
      return res.json({ data });
    } catch (error) {
      next(error);
    }
  };
}
