export interface AlternativaSalida {
  idsalida: number;
  nombrePaquete: string;
  fechaInicio: Date;
  lugaresDisponibles: number;
}

export interface INotificador {
  enviarEmailConfirmacion(email: string, reservaId: number, monto: number): Promise<boolean>;
  enviarEmailRechazo(email: string, motivo: string): Promise<boolean>;

  // CU-32: constancia de cancelación de una reserva
  enviarEmailCancelacionReserva(
    email: string,
    nroReserva: string,
    montoAReintegrar: number,
    motivo: string | null
  ): Promise<boolean>;

  // CU-37: aviso al titular cuando la empresa cancela la salida (motivo, reintegro y salidas alternativas)
  enviarEmailCancelacionSalida(
    email: string,
    nroSalida: string,
    motivo: string,
    montoAReintegrar: number,
    alternativas: AlternativaSalida[]
  ): Promise<boolean>;
}
