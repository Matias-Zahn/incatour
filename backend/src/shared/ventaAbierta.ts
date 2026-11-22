/**
 * B4, B9 y 12.6: cuándo se vende una salida y qué días puede empezar. Un solo lugar para el catálogo,
 * la compra, el listado del admin, el alta de la salida (CU-36) y el calendario del paquete.
 * La venta termina sola por fecha, sin tarea programada: se calcula al leer.
 */
import { DIAS_CIERRE_SOLICITUD, ESTADO_SALIDA } from "./constantes";
import { codigoDia, diasDe, fechaCorta, hoyUTC, nombreDia } from "./fechas";
import { claveDia, sumarDias } from "./ocupacion";

type SalidaVenta = { estado: string; fechaInicio: Date; diasCierreVenta: number };

/** El último día en que se puede comprar: fechaInicio − diasCierreVenta − 1. */
export const ultimoDiaVenta = (s: Pick<SalidaVenta, "fechaInicio" | "diasCierreVenta">) => sumarDias(s.fechaInicio, -s.diasCierreVenta - 1);

/** PUBLICADA && hoy < fechaInicio − diasCierreVenta. */
export const ventaAbierta = (s: SalidaVenta, hoy = hoyUTC()) => s.estado === ESTADO_SALIDA.PUBLICADA && hoy <= ultimoDiaVenta(s);

/** Los campos de venta del contrato, para el admin y el catálogo. */
export const datosVenta = (s: SalidaVenta, hoy = hoyUTC()) => ({
  diasCierreVenta: s.diasCierreVenta,
  ultimoDiaVenta: claveDia(ultimoDiaVenta(s)),
  ventaAbierta: ventaAbierta(s, hoy),
});

/** El corte que se propone al crear la salida: con un hotel a solicitud, al menos DIAS_CIERRE_SOLICITUD. */
export const corteDeVenta = (diasPaquete: number, hotelASolicitud: boolean) =>
  Math.max(diasPaquete, hotelASolicitud ? DIAS_CIERRE_SOLICITUD : 0);

/** 12.6: el primer día en que puede empezar una salida sin nacer con la venta cerrada (hoy + corte + 1). */
export const fechaMinimaInicio = (diasCierreVenta: number, hoy = hoyUTC()) => sumarDias(hoy, diasCierreVenta + 1);

type Calendario = { diasDisponibles: string | null; tren?: { nombreServicio: string; diasOperacion: string } | null | undefined };

/** B9: los días en que el paquete puede salir: los habilitados y, si tiene tren, los que el tren opera. */
export const diasHabilitados = (c: Calendario) =>
  diasDe(c.diasDisponibles).filter((d) => !c.tren || diasDe(c.tren.diasOperacion).includes(d));

export const enLista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs.join(""));

/** B9 y 12.6: por qué una salida no puede empezar en esa fecha, o null si puede. */
export function motivoFechaInvalida(fechaInicio: Date, c: Calendario & { diasCierreVenta: number }, hoy = hoyUTC()): string | null {
  const dia = codigoDia(fechaInicio);
  const habilitados = diasDe(c.diasDisponibles);
  if (!habilitados.includes(dia)) return `El paquete no sale los ${nombreDia(dia)}: los días habilitados son ${enLista(habilitados)}`;
  if (c.tren && !diasDe(c.tren.diasOperacion).includes(dia)) {
    return `El tren ${c.tren.nombreServicio} no opera los ${nombreDia(dia)} (opera ${c.tren.diasOperacion})`;
  }
  if (fechaInicio < fechaMinimaInicio(c.diasCierreVenta, hoy)) {
    return `La salida tiene que empezar después del ${fechaCorta(sumarDias(hoy, c.diasCierreVenta))}: la venta cierra ${c.diasCierreVenta} días antes del inicio`;
  }
  return null;
}
