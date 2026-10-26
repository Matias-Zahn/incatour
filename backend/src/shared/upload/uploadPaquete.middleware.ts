import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { CustomError } from "../../error/CustomError";
import { db } from "../../config/postgresDatabase";
import { leerIdUrl } from "../validaciones";

const BASE_IMG_PATH = path.resolve(process.cwd(), "public/imagenes/paquetes");
// CAT-21: la extensión sale del tipo validado, nunca del nombre que manda el cliente
const EXTENSION_POR_FORMATO: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const FORMATOS_PERMITIDOS = Object.keys(EXTENSION_POR_FORMATO);
const NOMBRES_FOTOS_VALIDOS = ["principal", "foto_1", "foto_2", "foto_3", "foto_4", "foto_5"];
const TEMPORAL = "subiendo_";

// CAT-22: foto_1 es la principal, igual que en el DELETE y en el front
export const nombreArchivoFoto = (nombreFoto: string) => {
  const nombre = nombreFoto?.toLowerCase();
  return nombre === "foto_1" ? "principal" : nombre;
};

export async function validarPaqueteParaSubida(
  req: Request,
  validarNombreFoto = false
): Promise<number> {
  // 1. Formato estrictamente numérico y en rango (evita traversal como %2e%2e, .., /, \). INF-04: regla compartida
  const id = leerIdUrl(req.params.id);

  // 2. Si aplica validarNombreFoto, verificar que sea un nombre permitido
  if (validarNombreFoto) {
    const rawNombreFoto = req.params.nombreFoto;
    const nombreFoto = typeof rawNombreFoto === "string" ? rawNombreFoto.toLowerCase() : "";
    if (!NOMBRES_FOTOS_VALIDOS.includes(nombreFoto)) {
      throw CustomError.badRequest(
        `nombreFoto debe ser uno de: ${NOMBRES_FOTOS_VALIDOS.join(", ")}.`
      );
    }
  }

  // 3. Validar que el paquete exista y se encuentre ACTIVO antes de escribir o borrar archivos
  const paquete = await db.paquete.findUnique({
    where: { idpaquete: id },
    select: { idpaquete: true, estado: true },
  });

  if (!paquete || paquete.estado !== "ACTIVO") {
    throw CustomError.notFound("Paquete no encontrado o inactivo.");
  }

  return id;
}

const storageCarrusel = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = req.params.id;
    if (!rawId || typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
      return cb(CustomError.badRequest("El ID proporcionado no es válido."), "");
    }
    const resolvedBase = path.resolve(BASE_IMG_PATH);
    const dir = path.resolve(BASE_IMG_PATH, rawId);
    if (!dir.startsWith(resolvedBase + path.sep)) {
      return cb(CustomError.badRequest("Ruta de destino inválida."), "");
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = EXTENSION_POR_FORMATO[file.mimetype];
    const contador = (req as any)._contadorFoto ?? 1;
    (req as any)._contadorFoto = contador + 1;
    cb(null, `${TEMPORAL}${contador === 1 ? "principal" : `foto_${contador}`}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (FORMATOS_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(CustomError.badRequest("Formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP."));
  }
};

const storageImagen = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = req.params.id;
    if (!rawId || typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
      return cb(CustomError.badRequest("El ID proporcionado no es válido."), "");
    }
    const resolvedBase = path.resolve(BASE_IMG_PATH);
    const dir = path.resolve(BASE_IMG_PATH, rawId);
    if (!dir.startsWith(resolvedBase + path.sep)) {
      return cb(CustomError.badRequest("Ruta de destino inválida."), "");
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = EXTENSION_POR_FORMATO[file.mimetype];
    cb(null, `${TEMPORAL}principal${ext}`);
  },
});

const storageModificarFoto = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = req.params.id;
    const rawNombreFoto = req.params.nombreFoto;
    if (!rawId || typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
      return cb(CustomError.badRequest("El ID proporcionado no es válido."), "");
    }
    const nombreFoto = typeof rawNombreFoto === "string" ? rawNombreFoto.toLowerCase() : "";
    if (!NOMBRES_FOTOS_VALIDOS.includes(nombreFoto)) {
      return cb(
        CustomError.badRequest(`nombreFoto debe ser uno de: ${NOMBRES_FOTOS_VALIDOS.join(", ")}.`),
        ""
      );
    }

    const resolvedBase = path.resolve(BASE_IMG_PATH);
    const dir = path.resolve(BASE_IMG_PATH, rawId);
    if (!dir.startsWith(resolvedBase + path.sep)) {
      return cb(CustomError.badRequest("Ruta de destino inválida."), "");
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = EXTENSION_POR_FORMATO[file.mimetype];
    cb(null, `${TEMPORAL}${nombreArchivoFoto(req.params.nombreFoto as string)}${ext}`);
  },
});

// CAT-22: multer escribe con nombre temporal y, si falla, borra lo que alcanzó a subir.
// Recién con toda la subida bien se borran las fotos que se reemplazan y las nuevas toman su nombre
function confirmarSubida(req: Request, prefijosReemplazados: string[]) {
  const subidos = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
  if (subidos.length === 0) return;
  const dir = subidos[0]!.destination;
  for (const arch of fs.readdirSync(dir)) {
    if (!arch.startsWith(TEMPORAL) && prefijosReemplazados.some((p) => arch.startsWith(p))) {
      fs.unlinkSync(path.join(dir, arch));
    }
  }
  for (const f of subidos) {
    f.filename = f.filename.slice(TEMPORAL.length);
    const final = path.join(dir, f.filename);
    fs.renameSync(f.path, final);
    f.path = final;
  }
}

function envolverMulter(
  multerInstance: multer.Multer,
  validarNombreFoto: boolean,
  prefijosReemplazados: (req: Request) => string[]
): multer.Multer {
  const envolver = (handler: RequestHandler): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await validarPaqueteParaSubida(req, validarNombreFoto);
        handler(req, res, (error?: unknown) => {
          if (error) return next(error);
          try {
            confirmarSubida(req, prefijosReemplazados(req));
            next();
          } catch (e) {
            next(e);
          }
        });
      } catch (error) {
        next(error);
      }
    };
  };

  return {
    single: (fieldName: string) => envolver(multerInstance.single(fieldName)),
    array: (fieldName: string, maxCount?: number) => envolver(multerInstance.array(fieldName, maxCount)),
    fields: (fields: readonly multer.Field[]) => envolver(multerInstance.fields(fields)),
    any: () => envolver(multerInstance.any()),
    none: () => envolver(multerInstance.none()),
  };
}

const multerCarruselInterno = multer({
  storage: storageCarrusel,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 5,
  },
});

const multerImagenInterno = multer({
  storage: storageImagen,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

const multerModificarFotoInterno = multer({
  storage: storageModificarFoto,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

// Middleware para subir galería/carrusel completo: de 1 a 5 fotos
export const subirCarruselPaquete = envolverMulter(multerCarruselInterno, false, () => ["principal.", "foto_", "imagen_"]);

// Middleware para foto individual de portada (principal)
export const subirImagenPaquete = envolverMulter(multerImagenInterno, false, () => ["principal."]);

// Middleware para modificar una foto específica del carrusel por su nombre (ej: foto_2, principal, etc.)
export const modificarFotoEspecifica = envolverMulter(multerModificarFotoInterno, true, (req) => [
  `${nombreArchivoFoto(req.params.nombreFoto as string)}.`,
]);

const IMAGENES_CATALOGO_POR_DEFECTO = [
  "/imagenes/catalogo/camino_inca_tradicional.jpg",
  "/imagenes/catalogo/travesia_salkantay.jpg",
  "/imagenes/catalogo/camino_choquequirao.jpg",
  "/imagenes/catalogo/secretos_valle_sagrado.jpg",
  "/imagenes/catalogo/sendero_de_los_andes.jpg",
  "/imagenes/catalogo/centro_cusco.jpg",
];

function imagenCatalogoSugerida(
  idpaquete: number,
  nombrePaquete?: string | null,
  nombreCircuito?: string | null,
): string {
  const texto = `${nombrePaquete ?? ""} ${nombreCircuito ?? ""}`.toLowerCase();
  if (texto.includes("salkantay")) return "/imagenes/catalogo/travesia_salkantay.jpg";
  if (texto.includes("choquequirao")) return "/imagenes/catalogo/camino_choquequirao.jpg";
  if (texto.includes("valle")) return "/imagenes/catalogo/secretos_valle_sagrado.jpg";
  if (texto.includes("andes") || texto.includes("ausangate")) return "/imagenes/catalogo/sendero_de_los_andes.jpg";
  if (texto.includes("cusco") || texto.includes("city")) return "/imagenes/catalogo/centro_cusco.jpg";
  if (texto.includes("inca")) return "/imagenes/catalogo/camino_inca_tradicional.jpg";
  const idx = Math.max(0, idpaquete - 1) % IMAGENES_CATALOGO_POR_DEFECTO.length;
  return IMAGENES_CATALOGO_POR_DEFECTO[idx]!;
}

export function obtenerImagenesDePaquete(
  idpaquete: number,
  nombrePaquete?: string | null,
  nombreCircuito?: string | null,
): {
  imagenPrincipal: string;
  imagenes: string[];
  tieneImagenesPropias: boolean;
} {
  const dir = path.join(BASE_IMG_PATH, String(idpaquete));
  try {
    if (fs.existsSync(dir)) {
      const archivos = fs
        .readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort((a, b) => {
          const esPrinA = a.startsWith("principal.") ? 0 : 1;
          const esPrinB = b.startsWith("principal.") ? 0 : 1;
          if (esPrinA !== esPrinB) return esPrinA - esPrinB;
          return a.localeCompare(b, undefined, { numeric: true });
        });

      if (archivos.length > 0) {
        const urls = archivos.slice(0, 5).map((archivo) => {
          try {
            const stat = fs.statSync(path.join(dir, archivo));
            return `/imagenes/paquetes/${idpaquete}/${archivo}?v=${Math.floor(stat.mtimeMs)}`;
          } catch {
            return `/imagenes/paquetes/${idpaquete}/${archivo}`;
          }
        });
        return {
          imagenPrincipal: urls[0]!,
          imagenes: urls,
          tieneImagenesPropias: true,
        };
      }
    }
  } catch {
    // Si no se puede leer el directorio, usar imagen por defecto
  }

  const porDefecto = imagenCatalogoSugerida(idpaquete, nombrePaquete, nombreCircuito);
  return {
    imagenPrincipal: porDefecto,
    imagenes: [porDefecto],
    tieneImagenesPropias: false,
  };
}
