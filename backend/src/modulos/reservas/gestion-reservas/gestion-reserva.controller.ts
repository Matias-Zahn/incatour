import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CancelarReservaDto, FiltrosMisReservasDto, FiltrosReservaDto } from "./gestion-reserva.dto";
import { GestionReservaService } from "./gestion-reserva.service";
import { leerIdUrl } from "../../../shared/validaciones";

const service = new GestionReservaService();

const leerIdReserva = (req: Request): number => {
  const id = leerIdUrl(req.params.idreserva, "El ID de reserva proporcionado no es válido.");
  return id;
};

export class GestionReservaController {
  // CU-31 (cliente): GET /api/reservas/mis-reservas
  consultarMisReservas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosMisReservasDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const reservas = await service.consultarMisReservas(req.usuarioAutenticado!, filtros!);
      return res.json({ data: reservas });
    } catch (err) {
      next(err);
    }
  };

  // CU-31 (administrador): GET /api/reservas
  consultarReservas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, filtros] = FiltrosReservaDto.create(req.query);
      if (error) throw CustomError.badRequest(error);

      const { reservas, total } = await service.consultarReservas(filtros!);
      return res.json({ data: reservas, total, pagina: filtros!.pagina, limite: filtros!.limite });
    } catch (err) {
      next(err);
    }
  };

  // CU-31: GET /api/reservas/:idreserva
  obtenerReserva = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reserva = await service.obtenerReserva(leerIdReserva(req), req.usuarioAutenticado!);
      return res.json({ data: reserva });
    } catch (err) {
      next(err);
    }
  };

  // CU-31: GET /api/reservas/:idreserva/comprobante  (descarga)
  obtenerComprobante = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comprobante = await service.obtenerComprobante(leerIdReserva(req), req.usuarioAutenticado!);
      res.setHeader("Content-Disposition", `attachment; filename="comprobante-${comprobante.nroReserva}.json"`);
      return res.json({ data: comprobante });
    } catch (err) {
      next(err);
    }
  };

  // CU-32 (solicitarCancelacion): GET /api/reservas/:idreserva/cancelacion
  solicitarCancelacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resumen = await service.solicitarCancelacion(leerIdReserva(req), req.usuarioAutenticado!);
      return res.json({ data: resumen });
    } catch (err) {
      next(err);
    }
  };

  // CU-32 (confirmarCancelacion): POST /api/reservas/:idreserva/cancelar
  confirmarCancelacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idreserva = leerIdReserva(req);
      const [error, dto] = CancelarReservaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.confirmarCancelacion(idreserva, dto!, req.usuarioAutenticado!);
      return res.json({ mensaje: "Reserva cancelada exitosamente", data: resultado });
    } catch (err) {
      next(err);
    }
  };
}