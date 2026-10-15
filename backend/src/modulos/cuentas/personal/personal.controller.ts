import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { ConsultarPersonalDto, CrearPersonalDto } from "./personal.dto";
import { PersonalService } from "./personal.service";

const service = new PersonalService();

export class PersonalController {
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
      return res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  };
}
