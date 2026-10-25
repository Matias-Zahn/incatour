import { redondear2 } from "../../../shared/constantes";

const MS_DIA = 24 * 60 * 60 * 1000;

// Días calendario (UTC) entre dos fechas, sin contar la hora
const diasCalendario = (desde: Date, hasta: Date) =>
  Math.round(
    (Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate()) -
      Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate())) / MS_DIA
  );

/**
 * RES-06 / CU-32: cuánto se reintegra al cancelar una reserva.
 *  - ADMIN: 100% de lo abonado (incluso con permisos emitidos).
 *  - Con permisos emitidos: $0.
 *  - Con menos anticipación que el plazo del paquete: $0.
 *  - En cualquier otro caso: 100%.
 */
export function calcularReintegro(p: {
  abonado: number;
  rol: string;
  permisosEmitidos: boolean;
  diasMinimos: number | null;
  fechaInicio: Date;
  ahora: Date;
}): { monto: number; condicionAplicada: string } {
  const total = redondear2(p.abonado);
  if (p.rol === "ADMIN") {
    return { monto: total, condicionAplicada: "Cancelación por el administrador: 100% del importe abonado" };
  }
  if (p.permisosEmitidos) {
    return { monto: 0, condicionAplicada: "Permisos emitidos ante la autoridad: sin reintegro" };
  }
  if (p.diasMinimos != null) {
    const faltan = diasCalendario(p.ahora, p.fechaInicio);
    if (faltan < p.diasMinimos) {
      return {
        monto: 0,
        condicionAplicada: `Cancelación con ${faltan} días de anticipación (mínimo ${p.diasMinimos}): sin reintegro`,
      };
    }
    return {
      monto: total,
      condicionAplicada: `Cancelación con ${faltan} días de anticipación (mínimo ${p.diasMinimos}): 100% del importe abonado`,
    };
  }
  return { monto: total, condicionAplicada: "Paquete sin plazo de reintegro: 100% del importe abonado" };
}
