import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearReservaDto } from "./reserva.dto";
import { ReservaService } from "./reserva.service";

const service = new ReservaService();

export class ReservaController {
  crearReserva = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearReservaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const idusuario = req.usuarioAutenticado!.idusuario;
      const resultado = await service.crearReserva(dto!, idusuario);

      return res.status(201).json({ mensaje: "Reserva confirmada", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
