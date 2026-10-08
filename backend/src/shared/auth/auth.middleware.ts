import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CustomError } from "../../error/CustomError";
import { envs } from "../../config/envs";

// Extendemos la interfaz de Request para agregar el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: {
        idusuario: number;
        email: string;
        nombre: string;
        apellido: string;
        rol: string;
      };
    }
  }
}

/**
 * Middleware 1: autenticar
 * Verifica que la petición traiga un token JWT válido en el header Authorization.
 * Si es válido, carga los datos del usuario en req.usuarioAutenticado.
 * Si no, corta la petición con 401.
 *
 * Uso en rutas: router.get("/", autenticar, controller.metodo)
 */
export const autenticar = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw CustomError.unauthorized("Token de autenticación no proporcionado");
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, envs.JWT_SEED) as {
      idusuario: number;
      email: string;
      nombre: string;
      apellido: string;
      rol: string;
    };

    req.usuarioAutenticado = payload;
    next();
  } catch (error) {
    if (error instanceof CustomError) return next(error);
    // Si jwt.verify falla (token expirado, firmado con otra clave, etc.)
    next(CustomError.unauthorized("Token inválido o expirado"));
  }
};

/**
 * Middleware 2: requierePerfil
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse SIEMPRE después del middleware autenticar.
 * Si el rol no coincide, corta la petición con 403 Forbidden.
 *
 * Uso en rutas: router.post("/", autenticar, requierePerfil("ADMIN"), controller.metodo)
 * Múltiples roles: router.get("/", autenticar, requierePerfil("ADMIN", "GUIA"), controller.metodo)
 */
export const requierePerfil = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuarioAutenticado;

    if (!usuario) {
      return next(CustomError.unauthorized("No hay sesión activa"));
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      return next(
        CustomError.forbidden(
          `Acceso denegado. Se requiere el perfil: ${rolesPermitidos.join(" o ")}`
        )
      );
    }

    next();
  };
};
