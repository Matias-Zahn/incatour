import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearServicioDto, FiltrosServicioDto, ModificarServicioDto } from "./servicio.dto";
import { ServicioService } from "./servicio.service";
import { leerIdUrl } from "../../../shared/validaciones";

const servicioService = new ServicioService();

const leerId = (valor: unknown, nombre: string): number => {
  return leerIdUrl(valor, `El ${nombre} proporcionado no es válido.`);
};

export class ServicioController {
  // CU-18: GET /api/proveedores/:idproveedor/servicios
  consultarServiciosProveedor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idproveedor = leerId(req.params.idproveedor, "ID de proveedor");
      const [error, filtros] = FiltrosServicioDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const servicios = await servicioService.consultarServiciosProveedor(idproveedor, filtros!);
      return res.json({ data: servicios });
    } catch (error) {
      next(error);
    }
  };

  // CU-19: POST /api/proveedores/:idproveedor/servicios
  registrarServicio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idproveedor = leerId(req.params.idproveedor, "ID de proveedor");
      const [error, dto] = CrearServicioDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const servicio = await servicioService.registrarServicio(idproveedor, dto!);
      return res.status(201).json({ mensaje: "Servicio registrado exitosamente", data: servicio });
    } catch (error) {
      next(error);
    }
  };

  // DCD solicitarEdicionServicio: GET /api/servicios/:id
  solicitarEdicionServicio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerId(req.params.id, "ID de servicio");
      const servicio = await servicioService.obtenerServicio(id);
      return res.json({ data: servicio });
    } catch (error) {
      next(error);
    }
  };

  // CU-20: PUT /api/servicios/:id
  modificarServicio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerId(req.params.id, "ID de servicio");
      const [error, dto] = ModificarServicioDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await servicioService.modificarServicio(id, dto!);
      return res.json({
        mensaje: resultado.versionado
          ? "El servicio está en salidas publicadas o en curso: los cambios se aplicaron en una versión nueva que rige solo para salidas futuras"
          : "Servicio modificado exitosamente",
        versionado: resultado.versionado,
        ...(resultado.versionado && { idservicioAnterior: resultado.idservicioAnterior }),
        data: resultado.servicio,
      });
    } catch (error) {
      next(error);
    }
  };

  // CU-21: PATCH /api/servicios/:id/baja
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerId(req.params.id, "ID de servicio");
      const servicio = await servicioService.darDeBaja(id);
      return res.json({ mensaje: "Servicio dado de baja exitosamente", data: servicio });
    } catch (error) {
      next(error);
    }
  };
}