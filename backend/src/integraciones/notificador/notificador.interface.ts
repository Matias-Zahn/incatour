export interface INotificador {
  enviarEmailConfirmacion(email: string, reservaId: number, monto: number): Promise<boolean>;
  enviarEmailRechazo(email: string, motivo: string): Promise<boolean>;
}
