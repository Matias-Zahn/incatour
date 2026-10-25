// Las fechas date-only (inicio de salida, vencimientos) se guardan a 00:00Z.
// Para compararlas con "hoy" hay que usar el día calendario local a 00:00Z, no new Date().

// BE-01: hoy a las 00:00 UTC, tomando el día local
export const hoyUTC = () => {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
};

// BE-05: un filtro "hasta" date-only (00:00Z) incluye todo ese día; si trae hora, se respeta
export const finDelDiaUTC = (fecha: Date) => {
  const f = new Date(fecha);
  if (f.getUTCHours() === 0 && f.getUTCMinutes() === 0 && f.getUTCSeconds() === 0 && f.getUTCMilliseconds() === 0) {
    f.setUTCHours(23, 59, 59, 999);
  }
  return f;
};
