export interface DatosTarjeta {
  numero: string;
  titular: string;
  vencimiento: string; // formato MM/YY
  cvv: string;
}

export interface SolicitudPago {
  monto: number;
  moneda: string;
  tarjeta: DatosTarjeta;
  referenciaReserva: string; // ID interno de la reserva
}

export interface RespuestaPago {
  aprobado: boolean;
  transaccionId?: string;
  mensaje: string;
}

export interface IPasarelaPagos {
  procesarPago(solicitud: SolicitudPago): Promise<RespuestaPago>;
}
