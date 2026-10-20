import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CustomError } from "../../error/CustomError";
import { envs } from "../../config/envs";
import { db } from "../../config/postgresDatabase";

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
 * Si es válido, comprueba en la base de datos que el usuario siga existiendo y permanezca ACTIVO (SEG-04).
 * Si no, corta la petición con 401.
 *
 * Uso en rutas: router.get("/", autenticar, controller.metodo)
 */
export const autenticar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw CustomError.unauthorized("Token de autenticación no proporcionado");
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(String(token), envs.JWT_SEED) as {
      idusuario: number;
      email: string;
      nombre: string;
      apellido: string;
      rol: string;
    };

    // SEG-04: Validar en tiempo real que el usuario exista y no haya sido dado de baja
    const usuarioDb = await db.usuario.findUnique({
      where: { idusuario: payload.idusuario },
      select: {
        idusuario: true,
        estado: true,
        cliente: { select: { estado: true } },
      },
    });

    if (!usuarioDb || usuarioDb.estado === "INACTIVO" || usuarioDb.cliente?.estado === "INACTIVO") {
      throw CustomError.unauthorized("Su cuenta ha sido desactivada o no existe");
    }

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
 * Uso en rutas: router.delete("/:id", autenticar, requierePerfil("ADMIN"), controller.metodo)
 * O con varios: router.get("/perfil", autenticar, requierePerfil("ADMIN", "CLIENTE"), ...)
 */
export const requierePerfil = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuarioAutenticado;

    if (!usuario) {
      return next(CustomError.unauthorized("Usuario no autenticado"));
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      return next(
        CustomError.forbidden(
          `Acceso denegado. Se requiere uno de los siguientes perfiles: ${rolesPermitidos.join(", ")}`
        )
      );
    }

    next();
  };
};
