// Servicios para Solicitudes de Alojamiento (CU-33 y CU-34)

export interface SolicitudPendiente {
  id: number;
  idsolicitud: number;
  idreserva: number;
  idservicio: number;
  nroSolicitud: string;
  estado: "PENDIENTE" | "CONFIRMADA" | "RECHAZADA" | string;
  cantidadPlazas: number;
  reserva: {
    idreserva: number;
    nroReserva: string;
    cantidadPasajeros: number;
    precioCongelado: string | number;
    estado: string;
    cliente: {
      idcliente: number;
      nroCliente: string;
    };
    salida: {
      idsalida: number;
      nroSalida: string;
      fechaInicio: string;
      fechaFin: string;
      estado: string;
      paquete: {
        idpaquete: number;
        nroPaquete: string;
        nombrePaquete: string;
        tipoGarantia: string;
        categoriaGarantizada: string | null;
        localidadGarantizada: string | null;
        tipoHabitacionGarantizada: string | null;
      };
    };
  };
  // RES-19: la garantía vendida (foto de la salida), no la del paquete de hoy
  garantia: {
    tipoGarantia: string;
    localidad: string | null;
    categoria: string | null;
    tipoHabitacion: string | null;
    establecimiento: string | null;
  };
}

export interface OpcionContactoHotel {
  servicioId: number;
  hotel: string;
  proveedor: string;
  canalContacto: string;
}

export interface OpcionesGestionSolicitud {
  solicitudId: number;
  reserva: string;
  cliente: string;
  criteriosGarantizados: {
    localidad: string | null;
    categoria: string | null;
    tipoHabitacion: string | null;
  };
  opcionesContacto: OpcionContactoHotel[];
}

export interface ResolverSolicitudPayload {
  servicioId: number;
  resolucion: "ACEPTADA" | "RECHAZADA";
  motivo?: string;
}

export interface RespuestaResolucionSolicitud {
  mensaje: string;
  nuevaSolicitudId?: number;
  solicitudesPendientesRestantesEnSalida?: number;
}

export const MOTIVOS_RECHAZO_FRECUENTES = [
  "Sin disponibilidad de habitaciones en las fechas solicitadas",
  "Cupo insuficiente para la cantidad de plazas requeridas",
  "Cierre temporal o mantenimiento del establecimiento",
  "Sin respuesta del proveedor dentro del plazo operativo",
] as const;

type SolicitudApi = Omit<SolicitudPendiente, "id">;

import { solicitarApi } from "./clienteApi";

// CU-33: Consultar solicitudes de alojamiento pendientes
export async function listarSolicitudesPendientes(): Promise<SolicitudPendiente[]> {
  const res = await solicitarApi<{
    mensaje?: string;
    cantidad?: number;
    data: SolicitudApi[];
  }>("/solicitudes");
  return (res.data ?? []).map((s) => ({ ...s, id: s.idsolicitud }));
}

// CU-34 (Paso 1): Obtener opciones de hoteles compatibles excluyendo los que ya rechazaron
export async function consultarOpcionesSolicitud(
  idSolicitud: number,
): Promise<OpcionesGestionSolicitud> {
  const res = await solicitarApi<{ data: OpcionesGestionSolicitud }>(`/solicitudes/${idSolicitud}/opciones`);
  return res.data;
}

// CU-34 (Paso 2): Resolver solicitud como ACEPTADA o RECHAZADA
// Responde { mensaje, data: { nuevaSolicitudId? | solicitudesPendientesRestantesEnSalida? } }
export async function resolverSolicitud(
  idSolicitud: number,
  payload: ResolverSolicitudPayload,
): Promise<RespuestaResolucionSolicitud> {
  const { mensaje, data } = await solicitarApi<{
    mensaje: string;
    data: Omit<RespuestaResolucionSolicitud, "mensaje">;
  }>(`/solicitudes/${idSolicitud}/resolver`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { mensaje, ...data } as RespuestaResolucionSolicitud;
}
