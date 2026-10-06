import type { Request, Response, NextFunction } from "express";
import { CustomError } from "./CustomError";

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

  // error desconocido: un bug, la base caída, etc.
  // loguealo completo para vos

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
};
