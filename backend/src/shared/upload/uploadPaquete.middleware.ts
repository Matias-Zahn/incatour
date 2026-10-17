import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";
import { CustomError } from "../../error/CustomError";

const BASE_IMG_PATH = path.resolve(process.cwd(), "public/imagenes/paquetes");
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

// Contador por petición para nombrar fotos del carrusel secuencialmente (foto_1, foto_2, ...)
let contadorFoto = 1;

const storageCarrusel = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = req.params.id;
    const dir = path.join(BASE_IMG_PATH, id as string);
    fs.mkdirSync(dir, { recursive: true });

    if ((req as any)._primerArchivo !== false) {
      (req as any)._primerArchivo = false;
      contadorFoto = 1;

      try {
        const archivos = fs.readdirSync(dir);
        for (const arch of archivos) {
          if (
            arch.startsWith("principal.") ||
            arch.startsWith("foto_") ||
            arch.startsWith("imagen_")
          ) {
            fs.unlinkSync(path.join(dir, arch));
          }
        }
      } catch {}
    }

    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (contadorFoto === 1) {
      contadorFoto++;
      cb(null, `principal${ext}`);
    } else {
      cb(null, `foto_${contadorFoto++}${ext}`);
    }
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (FORMATOS_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(CustomError.badRequest("Formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP."));
  }
};

// Middleware para subir galería/carrusel completo: de 1 a 5 fotos
export const subirCarruselPaquete = multer({
  storage: storageCarrusel,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 5,
  },
});

// Middleware para foto individual de portada (principal)
export const subirImagenPaquete = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = req.params.id;
      const dir = path.join(BASE_IMG_PATH, id as string);
      fs.mkdirSync(dir, { recursive: true });

      try {
        const archivosPrevios = fs.readdirSync(dir);
        for (const archivo of archivosPrevios) {
          if (archivo.startsWith("principal.")) {
            fs.unlinkSync(path.join(dir, archivo));
          }
        }
      } catch {}

      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `principal${ext}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

// Middleware para modificar una foto específica del carrusel por su nombre (ej: foto_2, principal, etc.)
export const modificarFotoEspecifica = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = req.params.id;
      const nombreFoto = req.params.nombreFoto; // ej: 'foto_2' o 'principal'
      const dir = path.join(BASE_IMG_PATH, id as string);
      fs.mkdirSync(dir, { recursive: true });

      // Borramos la versión anterior de esa foto en particular sin tocar las demás
      try {
        const archivos = fs.readdirSync(dir);
        for (const arch of archivos) {
          if (arch.startsWith(`${nombreFoto}.`)) {
            fs.unlinkSync(path.join(dir, arch));
          }
        }
      } catch {}

      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const nombreFoto = req.params.nombreFoto;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${nombreFoto}${ext}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

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
