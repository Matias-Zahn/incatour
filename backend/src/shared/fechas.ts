// Las fechas date-only (inicio de salida, vencimientos) se guardan a 00:00Z.
// Para compararlas con "hoy" hay que usar el día calendario local a 00:00Z, no new Date().

// BE-01: hoy a las 00:00 UTC, tomando el día local
export const hoyUTC = () => {
  const ahora = new Date();
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
