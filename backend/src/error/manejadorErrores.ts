import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { CustomError } from "./CustomError";

// Errores de Prisma que no son fallas del servidor sino del pedido
const ERRORES_PRISMA: Record<string, { estado: number; mensaje: string }> = {
  P2002: { estado: 409, mensaje: "Ya existe un registro con esos datos" },
  P2003: { estado: 400, mensaje: "El registro hace referencia a otro que no existe" },
  P2025: { estado: 404, mensaje: "El registro no existe" },
  P2000: { estado: 400, mensaje: "Un valor es demasiado largo para su campo" },
};

const MENSAJES_MULTER: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: "El archivo supera el tamaño máximo permitido",
  LIMIT_UNEXPECTED_FILE: "El archivo tiene que enviarse en el campo indicado",
};

// Rutas que ningún router atendió: JSON en vez del HTML por defecto de Express
export const rutaNoEncontrada = (req: Request, res: Response) => res.status(404).json({ error: "Ruta no encontrada" });

export const manejadorErrores = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof CustomError) {
    // error conocido: lo tiramos nosotros a propósito
    return res.status(err.statusCode).json({ error: err.message });
  }

  // body con JSON mal formado (lo detecta express.json antes de llegar al controlador)
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
  }

  // body que supera el límite de express.json
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "El cuerpo de la petición es demasiado grande" });
  }

  // reglas de la base que el código no llegó a validar antes (por ejemplo, dos pedidos a la vez)
  if (err instanceof Prisma.PrismaClientKnownRequestError && ERRORES_PRISMA[err.code]) {
    const { estado, mensaje } = ERRORES_PRISMA[err.code]!;
    return res.status(estado).json({ error: mensaje });
  }

  // archivos subidos (imágenes de paquetes)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: MENSAJES_MULTER[err.code] ?? "El archivo enviado no es válido" });
  }

  // error desconocido: un bug, la base caída, etc.
  // loguealo completo para vos
  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
};
