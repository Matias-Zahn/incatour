import { AlternativaSalida, INotificador } from "./notificador.interface";

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

  async enviarEmailCancelacionReserva(
    email: string,
    nroReserva: string,
    montoAReintegrar: number,
    motivo: string | null
  ): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`\n📧 [NOTIFICADOR] Enviando CONSTANCIA DE CANCELACIÓN a: ${email}`);
        console.log(`   └─ Reserva: ${nroReserva}`);
        console.log(`   └─ Importe a reintegrar (se liquida por fuera del sistema): $${montoAReintegrar.toFixed(2)}`);
        console.log(`   └─ Motivo: ${motivo ?? "No informado"}\n`);
        resolve(true);
      }, 300);
    });
  }

  async enviarEmailCancelacionSalida(
    email: string,
    nroSalida: string,
    motivo: string,
    montoAReintegrar: number,
    alternativas: AlternativaSalida[]
  ): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`\n📧 [NOTIFICADOR] Enviando AVISO DE CANCELACIÓN DE SALIDA a: ${email}`);
        console.log(`   └─ Salida: ${nroSalida}`);
        console.log(`   └─ Motivo: ${motivo}`);
        console.log(`   └─ Importe a reintegrar (100%): $${montoAReintegrar.toFixed(2)}`);
        if (alternativas.length === 0) {
          console.log(`   └─ Salidas alternativas: ninguna disponible por ahora`);
        } else {
          for (const a of alternativas) {
            console.log(
              `   └─ Alternativa: #${a.idsalida} ${a.nombrePaquete} · ${a.fechaInicio.toISOString().slice(0, 10)} · ${a.lugaresDisponibles} lugares`
            );
          }
        }
        console.log("");
        resolve(true);
      }, 300);
    });
  }
}