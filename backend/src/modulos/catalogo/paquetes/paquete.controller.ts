import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { obtenerImagenesDePaquete } from "../../../shared/upload/uploadPaquete.middleware";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { PaqueteService } from "./paquete.service";

const paqueteService = new PaqueteService();

function enriquecerPaqueteConImagenes<
  T extends {
    idpaquete: number;
    nombrePaquete?: string | null;
    circuito?: { nombreCircuito?: string | null } | null;
  },
>(paquete: T) {
  const infoImg = obtenerImagenesDePaquete(
    paquete.idpaquete,
    paquete.nombrePaquete,
    paquete.circuito?.nombreCircuito,
  );
  return {
    ...paquete,
    ...infoImg,
  };
}

export class PaqueteController {

  // GET /api/paquetes — CU-10: Consultar paquetes turísticos
  consultarPaquetes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paquetes = await paqueteService.consultarPaquetes();
      return res.json({ data: paquetes.map(enriquecerPaqueteConImagenes) });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/paquetes/:id
  consultarPaquetePorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const paquete = await paqueteService.consultarPaquetePorId(id);
      return res.json({ data: enriquecerPaqueteConImagenes(paquete) });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/paquetes — CU-11: Crear Paquete Turístico
  confirmarCreacion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearPaqueteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const paquete = await paqueteService.registrarNuevoPaquete(dto!);

      return res.status(201).json({
        mensaje: "Paquete turístico creado y publicado exitosamente",
        data: paquete ? enriquecerPaqueteConImagenes(paquete) : paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/paquetes/:id — CU-12: Modificar Paquete
  modificarPaquete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const [error, dto] = ModificarPaqueteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const paquete = await paqueteService.modificarPaquete(id, dto!);

      return res.json({
        mensaje: "Paquete turístico modificado exitosamente",
        data: paquete ? enriquecerPaqueteConImagenes(paquete) : paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/paquetes/:id/baja — CU-13: Baja de Paquete
  darDeBaja = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      const paquete = await paqueteService.darDeBajaPaquete(id);

      return res.json({
        mensaje: "Paquete turístico dado de baja exitosamente",
        data: paquete,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST y PUT /api/paquetes/:id/imagen — Subir entre 1 y 5 imágenes del paquete
  subirImagen = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID proporcionado no es válido.");

      // Verificamos que el paquete exista
      await paqueteService.consultarPaquetePorId(id);

      const archivosSubidos: Express.Multer.File[] = Array.isArray(req.files)
        ? req.files
        : req.file
          ? [req.file]
          : [];

      if (archivosSubidos.length === 0) {
        throw CustomError.badRequest("Debe adjuntar entre 1 y 5 archivos de imagen en el campo 'imagen'.");
      }

      if (archivosSubidos.length > 5) {
        throw CustomError.badRequest("Se permiten como máximo 5 imágenes por paquete turístico.");
      }

      const nombresArchivos = archivosSubidos.map((f) => f.filename);
      const urls = nombresArchivos.map((nombre) => `/imagenes/paquetes/${id}/${nombre}`);

      return res.status(200).json({
        mensaje:
          archivosSubidos.length === 1
            ? "Imagen del paquete subida exitosamente."
            : `${archivosSubidos.length} imágenes del paquete subidas exitosamente.`,
        data: {
          idpaquete: id,
          archivo: nombresArchivos[0]!,
          url: urls[0]!,
          archivos: nombresArchivos,
          urls,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
