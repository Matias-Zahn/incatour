import { db } from "../../../config/postgresDatabase";
import { CrearReservaDto } from "./reserva.dto";

export interface ProcesarCompraParams {
  dto: CrearReservaDto;
  nroReserva: string;
  precioTotal: number;
  estadoAlojamiento: string;
  crearSolicitud: boolean;
}

export class ReservaRepository {
  async obtenerDetalleSalidaYPaquete(idsalida: number) {
    return await db.salida.findUnique({
      where: { idsalida },
      include: {
        paquete: true
      }
    });
  }

  async procesarCompraAtomica(params: ProcesarCompraParams) {
    const { dto, nroReserva, precioTotal, estadoAlojamiento, crearSolicitud } = params;

    return await db.$transaction(async (tx) => {
      // 1. Lectura del stock comercial con relaciones requeridas
      const salida = await tx.salida.findUnique({
        where: { idsalida: dto.idsalida },
        include: { paquete: true } 
      });

      if (!salida || salida.stockLocal < dto.pasajeros.length) {
        throw new Error("Inventario insuficiente en el stock local de pasajes para esta salida.");
      }

      let decrementoAlojamiento = 0;

      // 2. Validación de plazas físicas de hotel
      if (estadoAlojamiento === "CONFIRMADO" && salida.stockLocalAlojamiento !== null) {
        if (salida.stockLocalAlojamiento < dto.pasajeros.length) {
          throw new Error("Plazas insuficientes en el stock local de alojamiento bloqueado.");
        }
        decrementoAlojamiento = dto.pasajeros.length;
      }

      // 3. Actualizar la Salida (Uso de operaciones atómicas)
      await tx.salida.update({
        where: { idsalida: dto.idsalida },
        data: {
          stockLocal: { decrement: dto.pasajeros.length },
          ...(decrementoAlojamiento > 0 && {
            stockLocalAlojamiento: { decrement: decrementoAlojamiento }
          })
        }
      });

      // 4. Registrar la Reserva core
      const reserva = await tx.reserva.create({
        data: {
          idcliente: dto.idcliente,
          idsalida: dto.idsalida,
          nroReserva,
          cantidadPasajeros: dto.pasajeros.length,
          precioCongelado: precioTotal,
          estado: "CONFIRMADA",
          estadoAlojamiento: estadoAlojamiento,
          condicionesComerciales: "Tarifas congeladas y validadas por pasarela de pago."
        }
      });

      // 5. Alta de Pasajeros y mapeo en la tabla intermedia ReservaPasajero
      for (const p of dto.pasajeros) {
        const pasajero = await tx.pasajero.create({
          data: {
            nombreCompleto: p.nombreCompleto,
            nroPasaporte: p.nroPasaporte,
            nacionalidad: p.nacionalidad,
            fechaVencimientoPasaporte: new Date(p.fechaVencimientoPasaporte)
          }
        });

        await tx.reservaPasajero.create({
          data: {
            idreserva: reserva.idreserva,
            idpasajero: pasajero.idpasajero 
          }
        });
      }

      // 6. Registrar la pasarela en el modelo Transaccion
      await tx.transaccion.create({
        data: {
          idreserva: reserva.idreserva,
          monto: precioTotal,
          medioPago: dto.medioPago,
          estadoTransaccion: "APROBADO"
        }
      });

      // 7. Flujo Alternativo: Generar Solicitud de Alojamiento Externa
      if (crearSolicitud && salida.idservicioGarantizado) {
        await tx.solicitud.create({ 
          data: {
            idreserva: reserva.idreserva,
            idservicio: salida.idservicioGarantizado,
            nroSolicitud: `SOL-${nroReserva}`,
            estado: "PENDIENTE",
            cantidadPlazas: dto.pasajeros.length,
            criterios: `Localidad: ${salida.paquete?.localidadGarantizada || "N/A"}, Cat: ${salida.paquete?.categoriaGarantizada || "Estándar"}`
          }
        });
      }

      return reserva;
    });
  }
}