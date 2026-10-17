import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";
import { CustomError } from "../../error/CustomError";

// Carpeta base para imágenes estáticas
export const BASE_IMG_PATH = path.resolve(process.cwd(), "public/imagenes/paquetes");

// Formatos permitidos: jpg, jpeg, png, webp
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

type RequestConIndiceImagen = Request & {
  _carpetaPaqueteLimpia?: boolean;
  _indiceImagenPaquete?: number;
};

// Configuración de almacenamiento en disco (mínimo 1, máximo 5 imágenes)
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const reqImg = req as RequestConIndiceImagen;
    const id = req.params.id;
    const dir = path.join(BASE_IMG_PATH, id as string);
    // Creamos la carpeta de la entidad si no existe
    fs.mkdirSync(dir, { recursive: true });

    // Limpiamos las imágenes previas una sola vez al comienzo del request
    if (!reqImg._carpetaPaqueteLimpia) {
      reqImg._carpetaPaqueteLimpia = true;
      reqImg._indiceImagenPaquete = 0;
      try {
        const archivosPrevios = fs.readdirSync(dir);
        for (const archivo of archivosPrevios) {
          if (archivo.startsWith("principal.") || archivo.startsWith("imagen_")) {
            fs.unlinkSync(path.join(dir, archivo));
          }
        }
      } catch {
        // Si la carpeta estaba vacía o recién creada, continúa normalmente
      }
    }

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const reqImg = req as RequestConIndiceImagen;
    const indice = (reqImg._indiceImagenPaquete ?? 0) + 1;
    reqImg._indiceImagenPaquete = indice;

    // Obtenemos la extensión del archivo original (.jpg, .png, .webp)
    const ext = path.extname(file.originalname).toLowerCase();
    const nombre = indice === 1 ? `principal${ext}` : `imagen_${indice}${ext}`;
    cb(null, nombre);
  },
});

// Filtro de validación de tipo MIME
const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (FORMATOS_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(CustomError.badRequest("Formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP."));
  }
};

// Límite de tamaño: máximo 3 MB por archivo, hasta 5 archivos
export const subirImagenPaquete = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 Megabytes
    files: 5,
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
