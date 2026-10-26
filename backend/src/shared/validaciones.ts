import { CustomError } from "../error/CustomError";

/** Valida un texto obligatorio. Devuelve [error, valorLimpio]. */
export const textoRequerido = (valor: any, nombre: string, max: number): [string | undefined, string?] => {
  if (typeof valor !== "string" || valor.trim().length === 0) return [`${nombre} es requerido.`];
  const limpio = valor.trim();
  if (limpio.length > max) return [`${nombre} no puede superar los ${max} caracteres.`];
  return [undefined, limpio];
};

const ID_MAXIMO = 2 ** 31 - 1; // INT4 de Postgres

/**
 * INF-04: lee un id de la URL. Solo dígitos ("12abc", "1.5" o "-1" no pasan) y dentro del rango de un INT4,
 * así un id enorme es 400 y no un error de Prisma. Es la misma regla que ya usaba la subida de imágenes.
 */
export const leerIdUrl = (valor: unknown, mensaje = "El ID proporcionado no es válido."): number => {
  const id = Number(valor);
  if (typeof valor !== "string" || !/^\d+$/.test(valor) || id <= 0 || id > ID_MAXIMO) {
    throw CustomError.badRequest(mensaje);
  }
  return id;
};
