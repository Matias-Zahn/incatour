import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearProveedorDto, FiltrosProveedorDto, ModificarProveedorDto } from "./proveedor.dto";
import { ProveedorService } from "./proveedor.service";
import { leerIdUrl } from "../../../shared/validaciones";

const proveedorService = new ProveedorService();

export class ProveedorController {
  // CU-14: GET /api/proveedores
  consultarProveedores = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosProveedorDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const proveedores = await proveedorService.consultarProveedores(filtros!);
      return res.json({ data: proveedores });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/proveedores/:id
  obtenerProveedor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      const proveedor = await proveedorService.obtenerProveedor(id);
      return res.json({ data: proveedor });
    } catch (error) {
      next(error);
    }
  };

  // CU-15: POST /api/proveedores
  crearProveedor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearProveedorDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const proveedor = await proveedorService.crearProveedor(dto!);
      return res.status(201).json({ mensaje: "Proveedor registrado exitosamente", data: proveedor });
    } catch (error) {
      next(error);
    }
  };

  // CU-16: PUT /api/proveedores/:id
  modificarProveedor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      const [error, dto] = ModificarProveedorDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const proveedor = await proveedorService.modificarProveedor(id, dto!);
      return res.json({ mensaje: "Proveedor modificado exitosamente", data: proveedor });
    } catch (error) {
      next(error);
    }
  };

  // CU-17: PATCH /api/proveedores/:id/baja
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      const proveedor = await proveedorService.darDeBaja(id);
      return res.json({ mensaje: "Proveedor dado de baja exitosamente", data: proveedor });
    } catch (error) {
      next(error);
    }
  };
}