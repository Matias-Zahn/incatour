import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearPersonalDto } from "./personal.dto";
import { PersonalService } from "./personal.service";

const service = new PersonalService();

export class PersonalController {
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
