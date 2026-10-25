import { ESTADO_ALOJAMIENTO, ESTADO_SOLICITUD } from "../../../shared/constantes";

/**
 * SAL-02 (CU-37): plazas que vuelven al hotel al cancelar la salida.
 * Son las que siguen bloqueadas sin vender (stockLocalAlojamiento) más las de las reservas confirmadas
 * que salieron de ese bloqueo (Confirmado sin solicitud confirmada, igual regla que CU-32).
 * No es tamanoMaximo: CU-40 ya devuelve los sobrantes al cerrar y CU-32 repone al cancelar una reserva.
 */
export const plazasADevolverAlHotel = (
  stockLocalAlojamiento: number | null,
  reservasConfirmadas: { cantidadPasajeros: number; estadoAlojamiento: string | null; solicitudes: { estado: string }[] }[],
) =>
  (stockLocalAlojamiento ?? 0) +
  reservasConfirmadas
    .filter(
      (r) =>
        r.estadoAlojamiento === ESTADO_ALOJAMIENTO.CONFIRMADO &&
        !r.solicitudes.some((s) => s.estado === ESTADO_SOLICITUD.CONFIRMADA),
    )
    .reduce((acc, r) => acc + r.cantidadPasajeros, 0);
