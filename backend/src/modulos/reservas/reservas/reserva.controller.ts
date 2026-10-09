import { Request, Response, NextFunction } from "express";
import { CrearReservaDto } from "./reserva.dto";
import { ReservaService } from "./reserva.service";
import { CustomError } from "../../../error/CustomError";

const service = new ReservaService();

export class ReservaController {
  public comprarPaquete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extraemos la sesión unificada del cliente inyectada previamente por el Middleware
      const idcliente = (req as any).usuarioAutenticado?.idusuario;
      if (!idcliente) throw CustomError.unauthorized("No se detectó una sesión de cliente activa.");

      // Enlazamos el ID al cuerpo de la petición para estructurar el DTO de forma consolidada
      const [error, dto] = CrearReservaDto.create({ ...req.body, idcliente });
      if (error) throw CustomError.badRequest(error);

      const reservaConfirmada = await service.procesarCompraDePaquete(dto!);

      return res.status(211).json({
        ok: true,
        mensaje: "Reserva generada, procesada y confirmada con éxito.",
        reserva: reservaConfirmada
      });
    } catch (error) {
      next(error);
    }
  };
}
