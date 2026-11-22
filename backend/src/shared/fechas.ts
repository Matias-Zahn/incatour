// Las fechas date-only (inicio de salida, vencimientos) se guardan a 00:00Z.
// Para compararlas con "hoy" hay que usar el día calendario local a 00:00Z, no new Date().

// BE-01: hoy a las 00:00 UTC, tomando el día local
export const hoyUTC = (ahora = new Date()) => {
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
};

// RES-12/BE-05: un filtro date-only (00:00Z) se toma como día calendario y se lleva al día LOCAL del proceso
// (las columnas timestamp guardan instantes reales); si trae hora, se respeta
const esDateOnly = (f: Date) =>
  f.getUTCHours() === 0 && f.getUTCMinutes() === 0 && f.getUTCSeconds() === 0 && f.getUTCMilliseconds() === 0;

export const inicioDelDiaLocal = (fecha: Date) =>
  esDateOnly(fecha) ? new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()) : new Date(fecha);

export const finDelDiaLocal = (fecha: Date) =>
  esDateOnly(fecha)
    ? new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), 23, 59, 59, 999)
    : new Date(fecha);

// Fecha de los mensajes de error: DD/MM/AAAA
export const fechaCorta = (f: Date) => f.toISOString().slice(0, 10).split("-").reverse().join("/");

// B9: días de la semana con los códigos de los formularios ("L-X-V"), en el orden de la semana
export const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"] as const;
const NOMBRES_DIA: Record<string, string> = { L: "lunes", M: "martes", X: "miércoles", J: "jueves", V: "viernes", S: "sábados", D: "domingos" };
export const codigoDia = (f: Date) => DIAS_SEMANA[(f.getUTCDay() + 6) % 7]!;
export const nombreDia = (codigo: string) => NOMBRES_DIA[codigo]!;
/** Los días de un texto "L-X-V"; sin texto, todos. */
export const diasDe = (texto: string | null | undefined): string[] =>
  texto ? DIAS_SEMANA.filter((d) => texto.toUpperCase().split(/[-,\s]+/).includes(d)) : [...DIAS_SEMANA];
