import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ConsultarPersonalDto, CrearPersonalDto, ModificarPersonalDto } from "./personal.dto";
import { PersonalService } from "./personal.service";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new PersonalService();

export class PersonalController {
  // CU-25: PATCH /api/personal/:id/baja
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El id debe ser un número entero positivo");

      const personal = await service.darDeBaja(id);
      return res.json({ mensaje: "Personal dado de baja exitosamente", data: personal });
    } catch (error) {
      next(error);
    }
  };

  // CU-24: PUT /api/personal/:id
  modificarPersonal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El id debe ser un número entero positivo");

      const [error, dto] = ModificarPersonalDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const personal = await service.modificarPersonal(id, dto!);
      return res.json({ mensaje: "Personal modificado exitosamente", data: personal });
    } catch (error) {
      next(error);
    }
  };

  // CU-22: GET /api/personal?rol=&estado=&habilitacionVigente=
  consultarPersonal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = ConsultarPersonalDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const personal = await service.consultarPersonal(dto!);
      return res.json({ data: personal });
    } catch (error) {
      next(error);
    }
  };

  crearPersonal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearPersonalDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.crearPersonal(dto!);
      const { mensaje, ...data } = resultado;
      return res.status(201).json({ mensaje, data });
    } catch (error) {
      next(error);
    }
  };
}
