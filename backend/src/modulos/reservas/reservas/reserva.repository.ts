import { db } from "../../../config/postgresDatabase";
import { ESTADO_SALIDA } from "../../../shared/constantes";
import { PasajeroInput } from "./reserva.dto";

export interface DatosConfirmacionReserva {
  idcliente: number;
  idsalida: number;
  nroReserva: string;
  precioCongelado: number;
  condicionesComerciales: string;
  medioPago: string;
  pasajeros: PasajeroInput[];
  estadoAlojamiento: string;
  // Solo si el alojamiento quedó pendiente (no había plazas bloqueadas)
  solicitud?:
    | {
        nroSolicitud: string;
        criterios: string;
      }
    | undefined;
}

export class ReservaRepository {
  // El cliente se identifica por el usuario del token (no por un id que mande el front)
  async obtenerClientePorUsuario(idusuario: number) {
    return db.cliente.findUnique({
      where: { idusuario },
      include: { usuario: { select: { email: true } } },
    });
  }

  // Todo lo que el servicio necesita para validar y calcular el precio (solo lectura)
  async obtenerSalidaParaCompra(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        paquete: {
          include: {
            tarifas: { include: { temporada: true } },
            servicios: { include: { servicio: { include: { transporte: true } } } },
            garantiasEstablecimiento: true,
          },
        },
        reservas: {
          where: { estado: { not: "CANCELADA" } },
          select: { pasajeros: { select: { pasajero: { select: { nroPasaporte: true } } } } },
        },
        // Servicios ya asignados a la salida (SalidaServicio)
        servicios: { include: { servicio: { include: { transporte: true } } } },
      },
    });
  }

  /**
   * Descuenta los cupos de forma ATÓMICA. Cada updateMany es un único
   * UPDATE ... WHERE stock >= cantidad, así que dos compras simultáneas
   * no pueden vender el mismo lugar (a diferencia de leer y luego actualizar).
   * Devuelve null si no hay cupo suficiente.
   */
  async reservarCupos(idsalida: number, cantidad: number) {
    return db.$transaction(async (tx) => {
      const cupos = await tx.salida.updateMany({
        where: { idsalida, estado: "PUBLICADA", stockLocal: { gte: cantidad } },
        data: { stockLocal: { decrement: cantidad } },
      });
      if (cupos.count === 0) return null;

      // Plazas de alojamiento bloqueadas: si alcanzan se descuentan; si no, quedará solicitud
      const aloj = await tx.salida.updateMany({
        where: { idsalida, stockLocalAlojamiento: { gte: cantidad } },
        data: { stockLocalAlojamiento: { decrement: cantidad } },
      });
      return { alojamientoReservado: aloj.count === 1 };
    });
  }

  // Compensación: si el pago falla o no se puede confirmar, los cupos vuelven a la venta
  async liberarCupos(idsalida: number, cantidad: number, alojamientoReservado: boolean) {
    await db.salida.update({
      where: { idsalida },
      data: {
        stockLocal: { increment: cantidad },
        ...(alojamientoReservado && { stockLocalAlojamiento: { increment: cantidad } }),
      },
    });
  }

  // Se ejecuta SOLO con el pago ya aprobado. Todo o nada.
  async confirmarReserva(d: DatosConfirmacionReserva) {
    return db.$transaction(async (tx) => {
      // FOR SHARE: compras simultáneas siguen en paralelo, pero esperan (y ven) el cierre de la asignación (CU-40)
      const [salida] = await tx.$queryRaw<{ estado: string }[]>`SELECT estado FROM public."Salida" WHERE idsalida = ${d.idsalida} FOR SHARE`;
      if (salida?.estado !== ESTADO_SALIDA.PUBLICADA) throw new Error("La salida dejó de estar a la venta mientras se procesaba el pago");

      // RES-03: No permitir que el mismo pasaporte ocupe dos lugares en la misma salida
      const pasaportesInput = d.pasajeros.map((p) => p.nroPasaporte);
      const ocupado = await tx.reservaPasajero.findFirst({
        where: {
          reserva: {
            idsalida: d.idsalida,
            estado: { not: "CANCELADA" },
          },
          pasajero: {
            nroPasaporte: { in: pasaportesInput },
          },
        },
        select: { pasajero: { select: { nroPasaporte: true } } },
      });
      if (ocupado) {
        throw new Error(`El pasaporte ${ocupado.pasajero.nroPasaporte} ya tiene una reserva en esta salida.`);
      }

      // Pasajero.nroPasaporte es único: si ya viajó antes se reutiliza y se actualizan sus datos
      const idsPasajeros: number[] = [];
      for (const p of d.pasajeros) {
        const pasajero = await tx.pasajero.upsert({
          where: { nroPasaporte: p.nroPasaporte },
          update: {
            nombreCompleto: p.nombreCompleto,
            nacionalidad: p.nacionalidad,
            fechaVencimientoPasaporte: new Date(p.fechaVencimientoPasaporte),
          },
          create: {
            nombreCompleto: p.nombreCompleto,
            nroPasaporte: p.nroPasaporte,
            nacionalidad: p.nacionalidad,
            fechaVencimientoPasaporte: new Date(p.fechaVencimientoPasaporte),
          },
        });
        idsPasajeros.push(pasajero.idpasajero);
      }

      return tx.reserva.create({
        data: {
          idcliente: d.idcliente,
          idsalida: d.idsalida,
          nroReserva: d.nroReserva,
          cantidadPasajeros: d.pasajeros.length,
          precioCongelado: d.precioCongelado,
          condicionesComerciales: d.condicionesComerciales,
          estado: "CONFIRMADA",
          estadoAlojamiento: d.estadoAlojamiento,
          pasajeros: { create: idsPasajeros.map((idpasajero) => ({ idpasajero })) },
          pagos: {
            create: {
              monto: d.precioCongelado,
              medioPago: d.medioPago,
              estadoTransaccion: "APROBADA",
            },
          },
          ...(d.solicitud && {
            solicitudes: {
              create: {
                nroSolicitud: d.solicitud.nroSolicitud,
                estado: "PENDIENTE",
                cantidadPlazas: d.pasajeros.length,
                criterios: d.solicitud.criterios,
              },
            },
          }),
        },
      });
    });
  }

  // RES-02: pago aprobado sin reserva y sin reembolso; se consulta en RegistroAuditoria con accion REEMBOLSO_PENDIENTE
  async registrarReembolsoPendiente(d: { idsalida: number; email: string; transaccionId: string; monto: number; nroReserva: string; causa: string; error: string }) {
    return db.registroAuditoria.create({
      data: {
        idsalida: d.idsalida,
        usuario: d.email,
        motivo: "Reembolso pendiente: pago aprobado sin reserva registrada",
        cambios: { accion: "REEMBOLSO_PENDIENTE", transaccionId: d.transaccionId, monto: d.monto, nroReserva: d.nroReserva, causa: d.causa, error: d.error },
      },
    });
  }
}