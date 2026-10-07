import { IPasarelaPagos, SolicitudPago, RespuestaPago } from "./pasarela.interface";
import crypto from "crypto";

/**
 * Simulación de la Pasarela de Pagos (Mock).
 * 
 * ¡ATENCIÓN EQUIPO! Este mock está diseñado para probar el "Rollback" en el CU-30.
 * Reglas de prueba implementadas:
 * - Tarjeta termina en "0000": Simula rechazo por fondos insuficientes.
 * - Tarjeta termina en "1111": Simula tarjeta robada.
 * - CVV es "999": Simula fallo de validación de seguridad.
 * - Cualquier otra tarjeta: Pago exitoso.
 * 
 * Usar estas reglas en las Semanas 4-8 para validar que si el pago falla,
 * la base de datos no descuenta el cupo de la reserva.
 */
export class PasarelaMock implements IPasarelaPagos {
  async procesarPago(solicitud: SolicitudPago): Promise<RespuestaPago> {
    // Simulamos latencia de red (entre 500 y 1500 ms)
    const latencia = Math.floor(Math.random() * 1000) + 500;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const { tarjeta } = solicitud;

        // Validaciones básicas de formato
        if (!tarjeta.numero || tarjeta.numero.length < 15) {
          return resolve({
            aprobado: false,
            mensaje: "Número de tarjeta inválido",
          });
        }
        if (!tarjeta.cvv || tarjeta.cvv.length < 3) {
          return resolve({
            aprobado: false,
            mensaje: "CVV inválido",
          });
        }

        // Lógica TRAMPA para testing de rollback
        if (tarjeta.numero.endsWith("0000")) {
          return resolve({
            aprobado: false,
            mensaje: "Rechazado por fondos insuficientes (Simulación)",
          });
        }
        
        if (tarjeta.numero.endsWith("1111")) {
          return resolve({
            aprobado: false,
            mensaje: "Tarjeta reportada como robada (Simulación)",
          });
        }

        if (tarjeta.cvv === "999") {
          return resolve({
            aprobado: false,
            mensaje: "Fallo de validación de seguridad (Simulación)",
          });
        }

        // Caso de éxito
        resolve({
          aprobado: true,
          transaccionId: `TXN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
          mensaje: "Pago procesado exitosamente",
        });

      }, latencia);
    });
  }
}
