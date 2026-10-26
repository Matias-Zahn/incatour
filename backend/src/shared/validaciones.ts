/** Valida un texto obligatorio. Devuelve [error, valorLimpio]. */
export const textoRequerido = (valor: any, nombre: string, max: number): [string | undefined, string?] => {
  if (typeof valor !== "string" || valor.trim().length === 0) return [`${nombre} es requerido.`];
  const limpio = valor.trim();
  if (limpio.length > max) return [`${nombre} no puede superar los ${max} caracteres.`];
  return [undefined, limpio];
};
