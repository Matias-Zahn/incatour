import { INotificador } from "./notificador.interface";

export class NotificadorMock implements INotificador {
  async enviarEmailConfirmacion(email: string, reservaId: number, monto: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`\n📧 [NOTIFICADOR] Enviando EMAIL de CONFIRMACIÓN a: ${email}`);
        console.log(`   └─ Reserva ID: ${reservaId}`);
        console.log(`   └─ Monto pagado: $${monto.toFixed(2)}\n`);
        resolve(true);
      }, 300);
    });
  }

  async enviarEmailRechazo(email: string, motivo: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`\n📧 [NOTIFICADOR] Enviando EMAIL de RECHAZO a: ${email}`);
        console.log(`   └─ Motivo: ${motivo}\n`);
        resolve(true);
      }, 300);
    });
  }
}
