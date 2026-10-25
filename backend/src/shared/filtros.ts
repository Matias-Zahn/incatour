// CAT-13: validación de query params numéricos / de fecha (vacío = sin filtro)
export const enteroOpcional = (valor: any, nombre: string): [string | undefined, (number | undefined)?] => {
  if (valor === undefined || valor === "") return [undefined, undefined];
  const n = typeof valor === "string" && /^\d+$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) return [`${nombre} debe ser un número entero mayor a 0.`];
  return [undefined, n];
};

export const fechaOpcionalQuery = (valor: any, nombre: string): [string | undefined, (string | undefined)?] => {
  if (valor === undefined || valor === "") return [undefined, undefined];
  if (typeof valor !== "string" || isNaN(new Date(valor).getTime())) {
    return [`${nombre} no es una fecha válida (usá YYYY-MM-DD).`];
  }
  return [undefined, valor];
};
