import { db } from "../../../config/postgresDatabase";
import { hoyUTC } from "../../../shared/fechas";

export interface FiltrosCatalogo {
  dificultad?: string | undefined;
  duracionDias?: string | number | undefined;
  fechaDesde?: string | undefined;
  fechaHasta?: string | undefined;
  fechaInicio?: string | undefined;
  fechaFin?: string | undefined;
}

export class CatalogoRepository {
  async buscarPaquetesActivos(filtros?: FiltrosCatalogo) {
    const whereCircuito: any = {
      estado: "ACTIVO",
    };

    if (filtros?.dificultad) {
      whereCircuito.dificultad = { equals: String(filtros.dificultad), mode: "insensitive" };
    }

    if (filtros?.duracionDias != null && filtros.duracionDias !== "") {
      whereCircuito.duracionDias = Number(filtros.duracionDias);
    }

    const where: any = {
      estado: "ACTIVO",
      circuito: whereCircuito,
    };

    const desde = filtros?.fechaDesde ?? filtros?.fechaInicio;
    const hasta = filtros?.fechaHasta ?? filtros?.fechaFin;

    if (desde || hasta) {
      // CAT-25: con piso en mañana, igual que salidasDisponibles del servicio; si no, aparecen paquetes sin salidas
      const fechaFilter: any = { gt: hoyUTC() };
      if (desde) fechaFilter.gte = new Date(desde);
      if (hasta) fechaFilter.lte = new Date(hasta);
      where.salidas = {
        some: {
          estado: "PUBLICADA",
          fechaInicio: fechaFilter,
        },
      };
    }

    return db.paquete.findMany({
      where,
      include: {
        circuito: {
          include: {
            etapas: {
              orderBy: { numeroOrden: "asc" },
            },
          },
        },
        tarifas: {
          include: {
            temporada: true,
          },
        },
        servicios: {
          include: {
            servicio: {
              include: {
                transporte: true,
              },
            },
          },
        },
        salidas: {
          where: {
            estado: "PUBLICADA",
            ...((desde || hasta) && {
              fechaInicio: {
                ...(desde && { gte: new Date(desde) }),
                ...(hasta && { lte: new Date(hasta) }),
              },
            }),
          },
          orderBy: {
            fechaInicio: "asc",
          },
        },
        garantiasEstablecimiento: {
          include: {
            servicio: {
              include: {
                alojamiento: true,
              },
            },
          },
        },
      },
      orderBy: { idpaquete: "asc" },
    });
  }
}
