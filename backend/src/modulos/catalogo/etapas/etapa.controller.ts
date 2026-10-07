import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { EstablecerSecuenciaDto } from "./etapa.dto";
import { EtapaService } from "./etapa.service";

const etapaService = new EtapaService();

export class EtapaController {

  // GET /api/circuitos/:idcircuito/etapas
  consultarEtapas = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idcircuito = parseInt(req.params.idcircuito as string);
      if (isNaN(idcircuito)) throw CustomError.badRequest("El ID del circuito no es válido.");

      const etapas = await etapaService.consultarEtapas(idcircuito);
      return res.json({ data: etapas });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/circuitos/:idcircuito/etapas (Reemplaza la secuencia completa, según DSS)
  confirmarSecuenciaCompleta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idcircuito = parseInt(req.params.idcircuito as string);
      if (isNaN(idcircuito)) throw CustomError.badRequest("El ID del circuito no es válido.");

      // 1. Validar y crear DTO
      const [error, dto] = EstablecerSecuenciaDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      // 2. Llamar al servicio
      const resultado = await etapaService.registrarSecuenciaEtapas(idcircuito, dto!);

      // 3. DSS: Responder confirmacionExitosa
      return res.json({
        mensaje: "Secuencia de etapas establecida exitosamente",
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
