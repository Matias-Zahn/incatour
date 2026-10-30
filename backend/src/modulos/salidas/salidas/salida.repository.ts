import { db } from "../../../config/postgresDatabase";
import { Prisma } from "@prisma/client";
import { CustomError } from "../../../error/CustomError";
import { ESTADO, ESTADO_PERMISO, ESTADO_RESERVA, ESTADO_SALIDA, ESTADO_SOLICITUD, MODALIDAD_BLOQUEO_PLAZAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { DefinicionPaquete } from "../../../shared/definicionPaquete";
import { ConsultarSalidasDto } from "./salida.dto";

export type SalidaListada = Awaited<ReturnType<SalidaRepository["buscar"]>>[number];
export type PaqueteParaSalida = NonNullable<Awaited<ReturnType<SalidaRepository["buscarPaquete"]>>>;

export interface DatosNuevaSalida {
  idpaquete: number;
  fechaInicio: Date;
  fechaFin: Date;
  tamanoMaximo: number;
  idbloqueo: string;
  idalojamiento: number | undefined;
  definicionPaquete: DefinicionPaquete; // CAT-05
}

export class SalidaRepository {
  async buscar(dto: ConsultarSalidasDto) {
    return db.salida.findMany({
      where: {
        ...(dto.idpaquete && { idpaquete: dto.idpaquete }),
        ...(dto.estado && { estado: dto.estado }),
        ...((dto.desde || dto.hasta) && {
          fechaInicio: {
            ...(dto.desde && { gte: dto.desde }),
            ...(dto.hasta && { lte: dto.hasta }),
          },
        }),
        ...(dto.idguia && { personalAsignado: { some: { idpersonal: dto.idguia, personal: { rol: "Guía" } } } }),
        ...(dto.idcircuito && { paquete: { idcircuito: dto.idcircuito } }),
      },
      include: {
        paquete: {
          select: {
            nroPaquete: true,
            nombrePaquete: true,
            circuito: { select: { idcircuito: true, nombreCircuito: true, duracionDias: true, _count: { select: { etapas: true } } } },
          },
        },
        personalAsignado: { include: { personal: { select: { nombreCompleto: true, rol: true } } } },
        servicios: { include: { servicio: { select: { nombreServicio: true } } } },
        // RF-50 y RF-61: lo necesario para contar pasajeros, permisos y solicitudes pendientes
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          select: {
            _count: { select: { pasajeros: true } },
            permisos: { where: { estadoTramite: ESTADO_PERMISO.EMITIDO }, select: { idpermisopasajero: true } },
            solicitudes: { where: { estado: ESTADO_SOLICITUD.PENDIENTE }, select: { idsolicitud: true } },
          },
        },
        permisos: { where: { estadoTramite: ESTADO_PERMISO.EMITIDO }, select: { idpermisopersonal: true } },
      },
      orderBy: { fechaInicio: "asc" },
    });
  }

  // CU-36: el paquete con todo lo que hace falta para validar y dimensionar la salida
  async buscarPaquete(idpaquete: number) {
    return db.paquete.findUnique({
      where: { idpaquete },
      include: {
        circuito: true,
        tarifas: { include: { temporada: true } },
        // CAT-05: lo necesario para armar la foto de la definición
        garantiasEstablecimiento: { include: { servicio: { include: { alojamiento: true } } } },
        servicios: { include: { servicio: { include: { transporte: true } } } },
      },
    });
  }

  // CU-36 paso 5: alojamientos que cumplen la garantía del paquete y confirman por bloqueo de plazas
  async buscarAlojamientosConBloqueo(paquete: PaqueteParaSalida) {
    const porEstablecimiento = paquete.garantiasEstablecimiento.length > 0;
    const where: Prisma.ServicioBaseWhereInput = {
      estado: ESTADO.ACTIVO,
      alojamiento: {
        modalidadConfirmacion: MODALIDAD_BLOQUEO_PLAZAS,
        ...(!porEstablecimiento && paquete.categoriaGarantizada && { categoria: paquete.categoriaGarantizada }),
        ...(!porEstablecimiento && paquete.tipoHabitacionGarantizada && { tipoHabitacion: paquete.tipoHabitacionGarantizada }),
      },
      ...(porEstablecimiento && { idservicio: { in: paquete.garantiasEstablecimiento.map((g) => g.idservicio) } }),
      ...(!porEstablecimiento && paquete.localidadGarantizada && { localidad: paquete.localidadGarantizada }),
    };
    return db.servicioBase.findMany({
      where,
      select: { idservicio: true, nombreServicio: true, localidad: true, alojamiento: true },
      orderBy: { nombreServicio: "asc" },
    });
  }

  /**
   * CU-36 pasos 10 y 11, en una transacción: bloquear las plazas del hotel (si se eligió uno)
   * y registrar la salida publicada. El bloqueo ante la autoridad ya se pidió antes, afuera.
   */
  async crearSalida(d: DatosNuevaSalida) {
    return db.$transaction(async (tx) => {
      if (d.idalojamiento) {
        // Descuento condicional: si otra salida se llevó las plazas en el medio, no descuenta nada
        const plazas = await tx.servicioAlojamiento.updateMany({
          where: { idservicio: d.idalojamiento, capacidadDisponible: { gte: d.tamanoMaximo } },
          data: { capacidadDisponible: { decrement: d.tamanoMaximo } },
        });
        if (plazas.count === 0) throw CustomError.badRequest("El alojamiento ya no tiene plazas suficientes");
      }

      // Limitación: número correlativo por año; dos altas simultáneas chocan con el @unique y una falla (se compensa)
      const anio = d.fechaInicio.getUTCFullYear();
      const delAnio = await tx.salida.count({ where: { nroSalida: { startsWith: `SAL-${anio}-` } } });
      const nroSalida = `SAL-${anio}-${String(delAnio + 1).padStart(3, "0")}`;

      return tx.salida.create({
        data: {
          idpaquete: d.idpaquete,
          nroSalida,
          idbloqueo: d.idbloqueo,
          stockLocal: d.tamanoMaximo,
          stockLocalAlojamiento: d.idalojamiento ? d.tamanoMaximo : 0,
          tamanoMaximo: d.tamanoMaximo,
          fechaInicio: d.fechaInicio,
          fechaFin: d.fechaFin,
          estado: ESTADO_SALIDA.PUBLICADA,
          definicionPaquete: d.definicionPaquete,
          ...(d.idalojamiento && {
            servicios: { create: { idservicio: d.idalojamiento, tipo: TIPO_SERVICIO.ALOJAMIENTO } },
          }),
        },
        include: { servicios: { include: { servicio: { select: { nombreServicio: true } } } } },
      });
    });
  }
}
