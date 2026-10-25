/**
 * CAT-05: foto de la definición del paquete que se guarda en cada salida al crearla.
 * Las tarifas NO van en la foto: siguen vivas (RF-14). Si cambia el paquete, las salidas ya
 * creadas conservan lo que se les ofreció (condiciones, garantía, servicios, noches, plazo de reintegro).
 */
export type DefinicionPaquete = {
  condiciones: string | null;
  tipoGarantia: string;
  localidadGarantizada: string | null;
  categoriaGarantizada: string | null;
  tipoHabitacionGarantizada: string | null;
  // Solo con garantía por establecimiento
  establecimiento: { idservicio: number; nombreServicio: string; localidad: string; categoria: string | null } | null;
  // Servicios incluidos; el transporte lleva la franquicia de equipaje (CU-30)
  servicios: {
    idservicio: number;
    nombreServicio: string;
    transporte: { pesoEquipajeIncluido: number; costoPorKgExcedente: number } | null;
  }[];
  nochesPrevias: number;
  nochesPosteriores: number;
  diasDisponibles: string | null;
  diasMinimosReintegro: number | null;
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
  garantiasEstablecimiento?: {
    idservicio?: number;
    servicio?: { idservicio: number; nombreServicio: string; localidad: string; alojamiento?: { categoria: string } | null } | null;
  }[];
  servicios?: {
    servicio: {
      idservicio: number;
      nombreServicio: string;
      transporte?: { pesoEquipajeIncluido: number; costoPorKgExcedente: number } | null;
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
  };
}

/** La definición que rige para una salida: su foto si existe; si no (salida anterior a CAT-05), el paquete vivo. */
export function definicionEfectiva(salida: { definicionPaquete: unknown; paquete: PaqueteParaDefinicion }): DefinicionPaquete {
  return (salida.definicionPaquete as DefinicionPaquete | null) ?? armarDefinicionPaquete(salida.paquete);
}
