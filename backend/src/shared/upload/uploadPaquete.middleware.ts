import multer from "multer";
import path from "path";
import fs from "fs";
import { CustomError } from "../../error/CustomError";

// Carpeta base para imágenes estáticas
const BASE_IMG_PATH = path.resolve(process.cwd(), "public/imagenes/paquetes");

// Formatos permitidos: jpg, jpeg, png, webp
const FORMATOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

// Configuración de almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = req.params.id;
    const dir = path.join(BASE_IMG_PATH, id as string);
    // Creamos la carpeta de la entidad si no existe
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Obtenemos la extensión del archivo original (.jpg, .png, .webp)
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `principal${ext}`);
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

// Límite de tamaño: máximo 3 MB para que no sea pesada
export const subirImagenPaquete = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 Megabytes
  },
});
