import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { CustomError } from "../../../error/CustomError";
import { esArchivoTemporal, nombreArchivoFoto, obtenerImagenesDePaquete } from "../../../shared/upload/uploadPaquete.middleware";
import { CrearPaqueteDto, FiltrosPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { PaqueteService } from "./paquete.service";
import { leerIdUrl } from "../../../shared/validaciones";

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
      const [error, filtros] = FiltrosPaqueteDto.create(req.query);
      if (error) throw CustomError.badRequest(error);
      const paquetes = await paqueteService.consultarPaquetes({
        estado: filtros!.estado as string | undefined,
        idcircuito: filtros!.idcircuito,
        nombrePaquete: filtros!.nombrePaquete as string | undefined,
      });
      return res.json({ data: paquetes.map(enriquecerPaqueteConImagenes) });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/paquetes/:id
  consultarPaquetePorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      const paquete = await paqueteService.consultarPaquetePorId(id, true);
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
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

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
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

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
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

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

  // POST /api/paquetes/:id/carrusel — Subir carrusel de fotos (de 1 a 5 fotos)
  subirCarrusel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      await paqueteService.consultarPaquetePorId(id);

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw CustomError.badRequest("Debe adjuntar al menos una imagen en el campo 'imagenes'.");
      }

      const urls = files.map((f) => `/imagenes/paquetes/${id}/${f.filename}`);
      const principal = urls.find((u) => u.includes("principal")) ?? urls[0];

      return res.status(200).json({
        mensaje: `Carrusel subido exitosamente con ${files.length} imagen(es).`,
        data: {
          idpaquete: id,
          totalImagenes: files.length,
          principal,
          carrusel: urls,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/paquetes/:id/imagenes — Consultar todas las imágenes del paquete
  consultarImagenes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id, "El ID proporcionado no es válido.");

      await paqueteService.consultarPaquetePorId(id);

      const dir = path.resolve(process.cwd(), `public/imagenes/paquetes/${id}`);
      let principal: string | null = null;
      const carrusel: string[] = [];

      if (fs.existsSync(dir)) {
        const archivos = fs.readdirSync(dir).filter((arch) => !esArchivoTemporal(arch));
        for (const arch of archivos) {
          const url = `/imagenes/paquetes/${id}/${arch}`;
          if (arch.startsWith("principal.")) {
            principal = url;
          }
          carrusel.push(url);
        }
      }

      // Si no tiene foto personalizada, usamos fallback del catálogo por defecto
      if (!principal && carrusel.length === 0) {
        principal = "/imagenes/catalogo/camino_inca_tradicional.jpg";
        carrusel.push(principal);
      } else if (!principal && carrusel.length > 0) {
        principal = carrusel[0]!;
      }

      return res.status(200).json({
        idpaquete: id,
        principal,
        carrusel,
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/paquetes/:id/carrusel/:nombreFoto — Reemplazar una foto específica del carrusel (ej: foto_2)
  modificarFotoIndividual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id);
      const nombreFoto = (req.params.nombreFoto as string)?.toLowerCase();

      const nombresValidos = ["principal", "foto_1", "foto_2", "foto_3", "foto_4", "foto_5"];
      if (!nombresValidos.includes(nombreFoto)) {
        throw CustomError.badRequest(
          `nombreFoto debe ser uno de: ${nombresValidos.join(", ")}.`
        );
      }

      await paqueteService.consultarPaquetePorId(id);

      if (!req.file) {
        throw CustomError.badRequest("Debe adjuntar el nuevo archivo de imagen en el campo 'imagen'.");
      }

      const urlImagen = `/imagenes/paquetes/${id}/${req.file.filename}`;

      return res.status(200).json({
        mensaje: `La foto '${nombreFoto}' fue reemplazada exitosamente.`,
        data: {
          idpaquete: id,
          fotoModificada: nombreFoto,
          url: urlImagen,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/paquetes/:id/carrusel/:nombreFoto — Eliminar una foto específica del carrusel
  eliminarFotoIndividual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = leerIdUrl(req.params.id);
      const nombreFoto = (req.params.nombreFoto as string)?.toLowerCase();

      const nombresValidos = ["principal", "foto_1", "foto_2", "foto_3", "foto_4", "foto_5"];
      if (!nombresValidos.includes(nombreFoto)) {
        throw CustomError.badRequest(
          `nombreFoto debe ser uno de: ${nombresValidos.join(", ")}.`
        );
      }

      await paqueteService.consultarPaquetePorId(id);

      const dir = path.resolve(process.cwd(), `public/imagenes/paquetes/${id}`);
      let archivoEliminado = false;

      if (fs.existsSync(dir)) {
        const archivos = fs.readdirSync(dir);
        const prefijo = `${nombreArchivoFoto(nombreFoto)}.`;

        for (const arch of archivos) {
          if (arch.startsWith(prefijo)) {
            fs.unlinkSync(path.join(dir, arch));
            archivoEliminado = true;
          }
        }
      }

      if (!archivoEliminado) {
        throw CustomError.notFound(`No se encontró ninguna imagen para '${nombreFoto}' en este paquete.`);
      }

      return res.status(200).json({
        mensaje: `La foto '${nombreFoto}' fue eliminada exitosamente.`,
        data: {
          idpaquete: id,
          fotoEliminada: nombreFoto,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

