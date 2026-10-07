import { Request, Response, NextFunction } from "express";
import { CircuitoService } from "./circuito.service";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";
import { CustomError } from "../../error/CustomError";

const circuitoService = new CircuitoService();

export class CircuitoController {

  // CU-01: GET /api/circuitos
  consultarCircuitos = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const circuitos = await circuitoService.consultarCircuitos();
      return res.json({ data: circuitos });
    } catch (error) {
      next(error);
    }
  };

  // CU-02: POST /api/circuitos
  crearCircuito = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearCircuitoDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const circuito = await circuitoService.crearCircuito(dto!);

      return res.status(201).json({
        mensaje: "Circuito creado exitosamente",
        data: circuito,
      });
    } catch (error) {
      next(error);
    }
  };

  // CU-03: PUT /api/circuitos/:id
  modificarCircuito = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const [error, dto] = ModificarCircuitoDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const circuito = await circuitoService.modificarCircuito(id, dto!);

      return res.json({
        mensaje: "Circuito modificado exitosamente",
        data: circuito,
      });
    } catch (error) {
      next(error);
    }
  };

  // CU-04: PATCH /api/circuitos/:id/baja
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const circuito = await circuitoService.darDeBajaCircuito(id);

      return res.json({
        mensaje: "Circuito dado de baja exitosamente",
        data: circuito,
      });
    } catch (error) {
      next(error);
    }
  };
}
