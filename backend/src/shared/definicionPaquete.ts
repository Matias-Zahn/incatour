/**
 * CAT-05: foto de la definición del paquete que se guarda en cada salida al crearla.
 * Si cambia el paquete, las salidas ya creadas conservan lo que se les ofreció (condiciones, garantía,
 * servicios con la regla de cada equipo, noches, plazo de reintegro, corte de venta y, desde 12.5, la tarifa de
 * la temporada de su fecha de inicio: editar las tarifas del paquete solo cambia las salidas nuevas.
 */
import { DIAS_CIERRE_VENTA_DEFECTO, ESTADO, tipoDeServicio } from "./constantes";

export type TarifaSalida = { idtemporada: number; temporada: string; monto: number; moneda: string };
type TarifaPaquete = { monto: number; moneda: string; temporada: { idtemporada: number; nombre: string; estado: string; fechaInicio: Date; fechaFin: Date } };

/** RF-14: la tarifa del paquete cuya temporada activa cubre la fecha, o null. */
export function tarifaVigente(tarifas: TarifaPaquete[], fecha: Date): TarifaSalida | null {
  const t = tarifas.find((t) => t.temporada.estado === ESTADO.ACTIVO && t.temporada.fechaInicio <= fecha && fecha <= t.temporada.fechaFin);
  return t ? { idtemporada: t.temporada.idtemporada, temporada: t.temporada.nombre, monto: t.monto, moneda: t.moneda } : null;
}

/** 12.5: la tarifa congelada en la salida; las salidas anteriores, sin ella, siguen con la del paquete vivo. */
export const tarifaDeSalida = (s: { fechaInicio: Date; definicionPaquete: unknown }, tarifas: TarifaPaquete[]) =>
  (s.definicionPaquete as DefinicionPaquete | null)?.tarifa ?? tarifaVigente(tarifas, s.fechaInicio);

export type DefinicionPaquete = {
  condiciones: string | null;
  tipoGarantia: string;
  localidadGarantizada: string | null;
  categoriaGarantizada: string | null;
  tipoHabitacionGarantizada: string | null;
  // Solo con garantía por establecimiento
  establecimiento: { idservicio: number; nombreServicio: string; localidad: string; categoria: string | null } | null;
  // Servicios incluidos (B2). Las fotos anteriores a B6 pueden traer además `transporte` (la franquicia de equipaje): se ignora
  servicios: {
    idservicio: number;
    nombreServicio: string;
    tipo: string | null; // TRANSPORTE | TREN | EQUIPAMIENTO (undefined en las fotos anteriores a B2)
    cantidad: number | null; // solo EQUIPAMIENTO
    cadaPasajeros: number | null;
    tren: { horarioSalida: string; horarioLlegada: string } | null;
  }[];
  nochesPrevias: number;
  nochesPosteriores: number;
  diasDisponibles: string | null;
  diasMinimosReintegro: number | null;
  diasCierreVenta: number; // B4 (undefined en las fotos anteriores: rige Salida.diasCierreVenta)
  tarifa?: TarifaSalida | null; // 12.5 (null o undefined en las fotos anteriores: rige el paquete vivo)
};

// Forma mínima del paquete que hace falta (la cumple el resultado de Prisma con los include del caso)
export interface PaqueteParaDefinicion {
  condiciones: string | null;
  tipoGarantia: string;
  localidadGarantizada: string | null;
  categoriaGarantizada: string | null;
  tipoHabitacionGarantizada: string | null;
  nochesPrevias: number;
  nochesPosteriores: number;
  diasDisponibles: string | null;
  diasMinimosReintegro: number | null;
  diasCierreVenta?: number;
  garantiasEstablecimiento?: {
    idservicio?: number;
    servicio?: { idservicio: number; nombreServicio: string; localidad: string; alojamiento?: { categoria: string } | null } | null;
  }[];
  servicios?: {
    cantidad?: number | null;
    cadaPasajeros?: number | null;
    servicio: {
      idservicio: number;
      nombreServicio: string;
      transporte?: unknown;
      tren?: { horarioSalida: string; horarioLlegada: string } | null;
      equipamiento?: unknown;
      alojamiento?: unknown;
    };
  }[];
}

/** Arma la foto desde el paquete vivo (se usa al crear la salida, con la tarifa que se congela). */
export function armarDefinicionPaquete(p: PaqueteParaDefinicion, tarifa: TarifaSalida | null = null): DefinicionPaquete {
  const est = p.garantiasEstablecimiento?.[0]?.servicio;
  return {
    condiciones: p.condiciones,
    tipoGarantia: p.tipoGarantia,
    localidadGarantizada: p.localidadGarantizada,
    categoriaGarantizada: p.categoriaGarantizada,
    tipoHabitacionGarantizada: p.tipoHabitacionGarantizada,
    establecimiento: est
      ? { idservicio: est.idservicio, nombreServicio: est.nombreServicio, localidad: est.localidad, categoria: est.alojamiento?.categoria ?? null }
      : null,
    servicios: (p.servicios ?? []).map((s) => ({
      idservicio: s.servicio.idservicio,
      nombreServicio: s.servicio.nombreServicio,
      tipo: tipoDeServicio(s.servicio),
      cantidad: s.cantidad ?? null,
      cadaPasajeros: s.cadaPasajeros ?? null,
      tren: s.servicio.tren ? { horarioSalida: s.servicio.tren.horarioSalida, horarioLlegada: s.servicio.tren.horarioLlegada } : null,
    })),
    nochesPrevias: p.nochesPrevias,
    nochesPosteriores: p.nochesPosteriores,
    diasDisponibles: p.diasDisponibles,
    diasMinimosReintegro: p.diasMinimosReintegro,
    diasCierreVenta: p.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO,
    tarifa,
  };
}

/** La definición que rige para una salida: su foto si existe; si no (salida anterior a CAT-05), el paquete vivo. */
export function definicionEfectiva(salida: { definicionPaquete: unknown; paquete: PaqueteParaDefinicion }): DefinicionPaquete {
  return (salida.definicionPaquete as DefinicionPaquete | null) ?? armarDefinicionPaquete(salida.paquete);
}

/** CAT-29: texto de la garantía de alojamiento, sin inventar datos que la definición no tiene. */
export function textoGarantia(d: DefinicionPaquete): string {
  const tipo = d.tipoGarantia.toUpperCase();
  if (tipo.includes("ESTABLECIMIENTO")) {
    const est = d.establecimiento;
    if (!est) return "Alojamiento garantizado por establecimiento";
    return `${est.nombreServicio}${est.categoria ? ` (${est.categoria})` : ""} en ${est.localidad}`;
  }
  if (tipo.includes("CATEGOR")) {
    const partes = [
      d.categoriaGarantizada ?? "Categoría sin especificar",
      d.localidadGarantizada ? `en ${d.localidadGarantizada}` : null,
      d.tipoHabitacionGarantizada ? `· Hab. ${d.tipoHabitacionGarantizada}` : null,
    ];
    return partes.filter(Boolean).join(" ");
  }
  return "Sin garantía especificada";
}
