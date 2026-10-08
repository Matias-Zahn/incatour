import { Request, Response, NextFunction } from "express";
import { CustomError } from "../error/CustomError";
import { LoginDto } from "./auth.dto";
import { AuthService } from "./auth.service";

const service = new AuthService();

export class AuthController {
  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = LoginDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.login(dto!);
      return res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };
}
