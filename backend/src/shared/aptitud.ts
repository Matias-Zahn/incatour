/**
 * 12.3: si alguien del personal puede salir en unas fechas. Lo usan las opciones y el alta de la salida (CU-36),
 * la confirmación (CU-40), el reemplazo (CU-38) y la alerta PERSONAL_NO_APTO del listado.
 */
import { ESTADO } from "./constantes";
import { fechaCorta } from "./fechas";

const ROL_GUIA = "Guía"; // el de personal.dto, sin importar el módulo desde shared

type PersonalAptitud = {
  rol: string;
  estado: string;
  fechaVencimientoPasaporte: Date;
  guia?: { fechaHabilitacion: Date | null; usuario?: { estado: string } | null } | null;
};

export const habilitacionVigente = (guia: { fechaHabilitacion: Date | null } | null | undefined, hasta: Date) =>
  !!guia?.fechaHabilitacion && guia.fechaHabilitacion >= hasta;

/** Por qué no puede salir hasta fechaFin, o null si es apto. El texto va después del nombre ("Juan Pérez: …"). */
export function motivoNoApto(p: PersonalAptitud, fechaFin: Date): string | null {
  if (p.estado !== ESTADO.ACTIVO) return "está dado de baja";
  if (p.rol === ROL_GUIA) {
    if (!p.guia?.fechaHabilitacion) return "no tiene la habilitación cargada";
    if (!habilitacionVigente(p.guia, fechaFin)) return `la habilitación vence el ${fechaCorta(p.guia.fechaHabilitacion)}`;
    // CTA-18: sin cuenta activa no puede reportar avances
    if (p.guia.usuario?.estado !== ESTADO.ACTIVO) return "no tiene una cuenta de usuario activa para reportar avances";
  }
  // RES-18: tiene que vencer después del fin; el que vence el último día ya no cubre el recorrido
  if (p.fechaVencimientoPasaporte <= fechaFin) return `el pasaporte vence el ${fechaCorta(p.fechaVencimientoPasaporte)}`;
  return null;
}

/** Los ids elegidos que no existen o no son aptos, como "Juan Pérez: motivo" (alta de la salida y CU-40). */
export const noAptos = (ids: number[], encontrados: (PersonalAptitud & { idpersonal: number; nombreCompleto: string })[], fechaFin: Date) =>
  ids.flatMap((id) => {
    const persona = encontrados.find((e) => e.idpersonal === id);
    if (!persona) return [`El personal ${id} no existe`];
    const motivo = motivoNoApto(persona, fechaFin);
    return motivo ? [`${persona.nombreCompleto}: ${motivo}`] : [];
  });
