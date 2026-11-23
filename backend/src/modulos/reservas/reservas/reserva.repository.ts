import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { ESTADO_SALIDA, TIPO_SERVICIO } from "../../../shared/constantes";
import { maximoPorReserva, unaPorServicio } from "../../../shared/ocupacion";
import { devolverPlazas, recalcularEquipo } from "../../../shared/ocupacion.repository";
import { PasajeroInput } from "./reserva.dto";

/** 12.2: el hotel al que la compra mandó al grupo; porStock = salió de las plazas bloqueadas (si no, a solicitud). */
export type HotelReserva = { idservicio: number; nombreServicio: string; porStock: boolean };

export interface DatosConfirmacionReserva {
  idcliente: number;
  idsalida: number;
  nroReserva: string;
  precioCongelado: number;
  // RES-07: desglose congelado
  temporadaAplicada: string;
  precioPaquetePorPersona: number;
  moneda: string;
  diasMinimosReintegro: number | null; // RES-06
  condicionesComerciales: string;
  medioPago: string;
  pasajeros: PasajeroInput[];
  estadoAlojamiento: string;
  idalojamiento: number | null; // 12.2
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
  // RES-15: pasajeros ya registrados con alguno de estos pasaportes
  async buscarPasajerosPorPasaporte(nrosPasaporte: string[]) {
    return db.pasajero.findMany({
      where: { nroPasaporte: { in: nrosPasaporte } },
      select: { nroPasaporte: true, nombreCompleto: true,fechaVencimientoPasaporte: true, nacionalidad: true},
    });
  }

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
      // Este UPDATE deja bloqueada la fila de la salida hasta el commit: la elección del hotel queda serializada
      const cupos = await tx.salida.updateMany({
        where: { idsalida, estado: "PUBLICADA", stockLocal: { gte: cantidad } },
        data: { stockLocal: { decrement: cantidad } },
      });
      if (cupos.count === 0) return null;

      // 12.2: el grupo va entero al primer hotel con lugar, primero los de bloqueo (en el orden del alta) y después
      // el a solicitud, que no tiene tope. Sin hoteles (sin noches, o FA3), hotel null
      const ocupaciones = await tx.ocupacion.findMany({
        where: { idsalida, tipo: TIPO_SERVICIO.ALOJAMIENTO },
        select: { idservicio: true, plazasLibres: true, servicio: { select: { nombreServicio: true } } },
        orderBy: { idocupacion: "asc" },
      });
      const hoteles = unaPorServicio(ocupaciones).map((o) => ({ idservicio: o.idservicio, nombreServicio: o.servicio.nombreServicio, porStock: o.plazasLibres !== null }));
      if (!hoteles.length) return { hotel: null };
      for (const h of hoteles.filter((h) => h.porStock)) {
        const aloj = await tx.ocupacion.updateMany({
          where: { idsalida, idservicio: h.idservicio, tipo: TIPO_SERVICIO.ALOJAMIENTO, plazasLibres: { gte: cantidad } },
          data: { plazasLibres: { decrement: cantidad } },
        });
        if (aloj.count > 0) {
          await tx.salida.update({ where: { idsalida }, data: { stockLocalAlojamiento: { decrement: cantidad } } });
          return { hotel: h };
        }
      }
      const aSolicitud = hoteles.find((h) => !h.porStock);
      if (aSolicitud) return { hotel: aSolicitud };
      // El grupo no se parte entre hoteles (maximoPorReserva): se avisa cuántos entran juntos
      const { stockLocal } = (await tx.salida.findUnique({ where: { idsalida }, select: { stockLocal: true } }))!;
      const maximo = maximoPorReserva(stockLocal + cantidad, unaPorServicio(ocupaciones));
      throw CustomError.badRequest(
        `Quedan ${stockLocal + cantidad} lugares, pero no en un mismo hotel: en una reserva entran hasta ${maximo} pasajeros. Para más, hacé reservas separadas.`
      );
    });
  }

  // Compensación: si el pago falla o no se puede confirmar, los cupos y las plazas del hotel vuelven a la venta
  async liberarCupos(idsalida: number, cantidad: number, hotel: HotelReserva | null) {
    await db.$transaction(async (tx) => {
      await tx.salida.update({
        where: { idsalida },
        data: { stockLocal: { increment: cantidad }, ...(hotel?.porStock && { stockLocalAlojamiento: { increment: cantidad } }) },
      });
      if (hotel?.porStock) await devolverPlazas(tx, idsalida, hotel.idservicio, cantidad);
    });
  }

 // Se ejecuta SOLO con el pago ya aprobado. Todo o nada.
  async confirmarReserva(d: DatosConfirmacionReserva) {
    return db.$transaction(async (tx) => {
      // FOR UPDATE: espera la confirmación (CU-40) y serializa las compras de la misma salida, porque cada una
      // recalcula el equipo sobre el total vendido (B4). Orden de bloqueos: Salida → Pasajero
      const [salida] = await tx.$queryRaw<{ estado: string }[]>`SELECT estado FROM public."Salida" WHERE idsalida = ${d.idsalida} FOR UPDATE`;
      if (salida?.estado !== ESTADO_SALIDA.PUBLICADA) throw new Error("La salida dejó de estar a la venta mientras se procesaba el pago");

      // FIX P2025 y RES-20: Desacoplamos la creación de pasajeros.
      const idsPasajeros: number[] = [];
      for (const p of d.pasajeros) {
        const pasajeroDb = await tx.pasajero.upsert({
          where: { nroPasaporte: p.nroPasaporte.trim() },
          update: { 
            // FIX RES-20: Ahora sí actualizamos, porque el servicio ya validó
            // que estos datos sean más recientes que los que teníamos.
            nacionalidad: p.nacionalidad,
            fechaVencimientoPasaporte: new Date(p.fechaVencimientoPasaporte)
          },
          create: {
            nroPasaporte: p.nroPasaporte.trim(),
            nombreCompleto: p.nombreCompleto,
            nacionalidad: p.nacionalidad,
            fechaVencimientoPasaporte: new Date(p.fechaVencimientoPasaporte)
          }
        });
        idsPasajeros.push(pasajeroDb.idpasajero);
      }

      // RES-03: No permitir que el mismo pasaporte ocupe dos lugares en la misma salida.
      // Va DESPUÉS del upsert: este bloquea la fila del Pasajero hasta el commit, así dos compras simultáneas
      // con el mismo pasaporte se serializan y la segunda ve la reserva de la primera.
      const pasaportesInput = d.pasajeros.map((p) => p.nroPasaporte.trim());
      const ocupado = await tx.reservaPasajero.findFirst({
        where: {
          reserva: { idsalida: d.idsalida, estado: { not: "CANCELADA" } },
          pasajero: { nroPasaporte: { in: pasaportesInput } },
        },
        select: { pasajero: { select: { nroPasaporte: true } } },
      });
      
      if (ocupado) {
        throw new Error(`El pasaporte ${ocupado.pasajero.nroPasaporte} ya tiene una reserva en esta salida.`);
      }

      // Ahora creamos la reserva conectando los IDs directamente
      const reserva = await tx.reserva.create({
        data: {
          idcliente: d.idcliente,
          idsalida: d.idsalida,
          nroReserva: d.nroReserva,
          cantidadPasajeros: d.pasajeros.length,
          precioCongelado: d.precioCongelado,
          temporadaAplicada: d.temporadaAplicada,
          precioPaquetePorPersona: d.precioPaquetePorPersona,
          moneda: d.moneda,
          diasMinimosReintegro: d.diasMinimosReintegro,
          condicionesComerciales: d.condicionesComerciales,
          estado: "CONFIRMADA",
          estadoAlojamiento: d.estadoAlojamiento,
          idalojamiento: d.idalojamiento,
          // Pasamos el array de IDs directamente a la tabla intermedia
          pasajeros: { 
            create: idsPasajeros.map(idpasajero => ({ idpasajero })) 
          },
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
      // B4: el equipo se recalcula sobre el total vendido, con esta reserva incluida
      await recalcularEquipo(tx, d.idsalida);
      return reserva;
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