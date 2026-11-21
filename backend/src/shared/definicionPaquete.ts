/**
 * CAT-05: foto de la definición del paquete que se guarda en cada salida al crearla.
 * Si cambia el paquete, las salidas ya creadas conservan lo que se les ofreció (condiciones, garantía,
 * servicios con la regla de cada equipo, noches, plazo de reintegro y corte de venta).
 * Las tarifas todavía siguen vivas (RF-14): 12.5 las congela en la foto en una etapa posterior.
 */
import { DIAS_CIERRE_VENTA_DEFECTO, tipoDeServicio } from "./constantes";

export type DefinicionPaquete = {
  condiciones: string | null;
  tipoGarantia: string;
  localidadGarantizada: string | null;
  categoriaGarantizada: string | null;
  tipoHabitacionGarantizada: string | null;
  // Solo con garantía por establecimiento
  establecimiento: { idservicio: number; nombreServicio: string; localidad: string; categoria: string | null } | null;
  // Servicios incluidos (B2); el transporte lleva la franquicia de equipaje (CU-30) hasta que se saque (B6)
  servicios: {
    idservicio: number;
    nombreServicio: string;
    tipo: string | null; // TRANSPORTE | TREN | EQUIPAMIENTO (undefined en las fotos anteriores a B2)
    cantidad: number | null; // solo EQUIPAMIENTO
    cadaPasajeros: number | null;
    tren: { horarioSalida: string; horarioLlegada: string } | null;
    transporte: { pesoEquipajeIncluido: number; costoPorKgExcedente: number } | null;
  }[];
  nochesPrevias: number;
  nochesPosteriores: number;
  diasDisponibles: string | null;
  diasMinimosReintegro: number | null;
  diasCierreVenta: number; // B4 (undefined en las fotos anteriores: rige Salida.diasCierreVenta)
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
      transporte?: { pesoEquipajeIncluido: number; costoPorKgExcedente: number } | null;
      tren?: { horarioSalida: string; horarioLlegada: string } | null;
      equipamiento?: unknown;
      alojamiento?: unknown;
    };
  }[];
}

/** Arma la foto desde el paquete vivo (se usa al crear la salida). */
export function armarDefinicionPaquete(p: PaqueteParaDefinicion): DefinicionPaquete {
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
      transporte: s.servicio.transporte
        ? {
            pesoEquipajeIncluido: s.servicio.transporte.pesoEquipajeIncluido,
            costoPorKgExcedente: s.servicio.transporte.costoPorKgExcedente,
          }
        : null,
    })),
    nochesPrevias: p.nochesPrevias,
    nochesPosteriores: p.nochesPosteriores,
    diasDisponibles: p.diasDisponibles,
    diasMinimosReintegro: p.diasMinimosReintegro,
    diasCierreVenta: p.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO,
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
