import { CustomError } from "../../../error/CustomError";
import { ESTADO_ALOJAMIENTO, ESTADO_SALIDA, SALIDAS_NO_INICIADAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { fechaCorta, hoyUTC } from "../../../shared/fechas";
import { unaPorServicio } from "../../../shared/ocupacion";
import { datosVenta } from "../../../shared/ventaAbierta";
import { PermisoEmitido, PermisoRechazado, TitularPermiso } from "../../../integraciones/autoridad/autoridad.interface";
import { obtenerAutoridad } from "../autoridad.wiring";
import { calcularDotacion } from "../salidas/salida.dotacion";
import { SalidaRepository } from "../salidas/salida.repository";
import { revisarRecursos } from "../salidas/salida.service";
import { ROL_GUIA, ROL_PORTEADOR } from "../../cuentas/personal/personal.dto";
import { AsignacionRepository, SalidaParaAsignar } from "./asignacion.repository";

/**
 * CU-40 "Confirmar salida" (B4, decisiones 4 y 15): todo llegó asignado al crear la salida (CU-36) y el equipo lo ocupa
 * cada compra. Acá se revisa, se emiten los permisos de la nómina y la salida pasa a CERRADA. No asigna nada.
 */
export class AsignacionService {
  private repository = new AsignacionRepository();
  private salidas = new SalidaRepository();

  // CU-40 pasos 2 y 3: panel de control. Funciona en cualquier momento antes del inicio
  async obtenerPanelAsignacion(idsalida: number) {
    const c = await this.prepararConfirmacion(idsalida);
    const { salida, venta, vendidos, dotacion, recursos } = c;
    const ocupacion = (tipo: string) => unaPorServicio(salida.ocupaciones.filter((o) => o.tipo === tipo));
    return {
      salida: {
        idsalida, nroSalida: salida.nroSalida, fechaInicio: salida.fechaInicio, fechaFin: salida.fechaFin, estado: salida.estado,
        ultimoDiaVenta: venta.ultimoDiaVenta, ventaAbierta: venta.ventaAbierta,
      },
      puedeConfirmar: c.motivoNoConfirmable === null,
      motivoNoConfirmable: c.motivoNoConfirmable,
      pasajerosConfirmados: vendidos,
      dotacionRequerida: dotacion,
      personal: recursos.personal.map((p) => ({ idpersonal: p.idpersonal, nombreCompleto: p.nombreCompleto, rol: p.rol, apto: !p.motivo, motivo: p.motivo })),
      porteadoresSobrantes: Math.max(0, recursos.personal.filter((p) => p.rol === ROL_PORTEADOR).length - dotacion.porteadores), // decisión 5: solo avisa
      // ponytail: un hotel por salida hasta el bloque 10; los pasajeros con el alojamiento confirmado son de ese hotel
      hoteles: ocupacion(TIPO_SERVICIO.ALOJAMIENTO).map((o) => ({
        idservicio: o.idservicio,
        nombreServicio: o.servicio.nombreServicio,
        modalidadConfirmacion: o.servicio.alojamiento?.modalidadConfirmacion ?? null,
        pasajeros: salida.reservas.filter((r) => r.estadoAlojamiento === ESTADO_ALOJAMIENTO.CONFIRMADO).reduce((t, r) => t + r.pasajeros.length, 0),
      })),
      transporte: recursos.transporte,
      equipo: recursos.equipos.map((e) => ({
        idservicio: e.idservicio,
        nombreServicio: e.nombreServicio,
        tipoEquipamiento: salida.ocupaciones.find((o) => o.idservicio === e.idservicio)?.servicio.equipamiento?.tipoEquipamiento ?? null,
        necesita: e.necesita,
        ocupado: e.ocupado,
        falta: e.falta,
      })),
      reservasSinAlojamiento: c.pendientes,
      faltantes: c.faltantes,
      bloqueoInicial: c.bloqueoInicial,
      lugaresSobrantes: c.sobrantes,
    };
  }

  // CU-40 pasos 4 a 15: confirmar (body vacío, decisión 15)
  async confirmarAsignacion(idsalida: number) {
    const { salida, sobrantes, motivoNoConfirmable, bloqueaPorRecursos, pendientes, faltantes } = await this.prepararConfirmacion(idsalida);
    if (motivoNoConfirmable) {
      // Los alojamientos pendientes y los faltantes son 409, con el detalle para el panel
      throw bloqueaPorRecursos ? CustomError.conflict(motivoNoConfirmable, { reservasSinAlojamiento: pendientes, faltantes }) : CustomError.badRequest(motivoNoConfirmable);
    }

    // SAL-21 (RF-47): el pasajero vencido no va a la autoridad; queda rechazado y el resto sigue.
    // El personal vencido ya frenó la confirmación como no apto (12.3)
    const nominaCompleta = armarNomina(salida, salida.personalAsignado.map((a) => a.personal));
    const vencidos = nominaCompleta.filter((t) => t.fechaVencimientoPasaporte <= salida.fechaFin);
    const nomina = nominaCompleta.filter((t) => !vencidos.includes(t));

    // Paso 14: emisión nominal. Va antes de la transacción porque es un servicio externo
    const autoridad = obtenerAutoridad();
    let permisos: PermisoEmitido[];
    let rechazados: PermisoRechazado[];
    try {
      ({ emitidos: permisos, rechazados } = await autoridad.solicitarEmisionNominal(salida.idbloqueo!, nomina));
    } catch {
      throw CustomError.serviceUnavailable("No fue posible emitir los permisos ante la autoridad. Reintentá más tarde");
    }
    rechazados = [...vencidos.map((t) => ({ titular: { tipo: t.tipo, id: t.id }, motivo: MOTIVO_PASAPORTE_VENCIDO })), ...rechazados];

    // Si algo falla después de emitir, los permisos emitidos se dan de baja
    const darDeBajaEmitidos = () =>
      Promise.all(
        permisos.map((p) =>
          autoridad
            .darDeBajaPermiso(salida.idbloqueo!, p.nroPermiso)
            .catch((e) => console.error(`Compensación fallida: el permiso ${p.nroPermiso} quedó emitido`, e))
        )
      );

    // RF-47: los rechazados no ocupan lugar. Se liberan los de pasajeros junto con los sobrantes; los del personal
    // quedan reservados para su reemplazo (CU-38), que pide ahí un permiso nuevo
    const lugaresALiberar = sobrantes + rechazados.filter((r) => r.titular.tipo === "PASAJERO").length;
    let salidaActualizada;
    try {
      salidaActualizada = await this.repository.confirmar({
        salida,
        permisos,
        rechazados,
        lugaresPorLiberar: lugaresALiberar,
        reservaDePasajero: new Map(
          salida.reservas.flatMap((r) => r.pasajeros.map((rp) => [rp.idpasajero, r.idreserva] as [number, number]))
        ),
      });
    } catch (error) {
      await darDeBajaEmitidos();
      throw error;
    }

    // Paso 12: liberar los lugares sobrantes. La salida ya quedó bien, así que si la autoridad
    // falla acá no se deshace nada: la cantidad queda guardada y se reintenta con liberarSobrantes
    const sobrantesLiberados = lugaresALiberar === 0 || (await this.liberar(salida.idbloqueo!, idsalida, lugaresALiberar));

    return {
      salida: salidaActualizada,
      permisosEmitidos: permisos.length,
      rechazados: rechazados.map((r) => ({
        tipo: r.titular.tipo,
        id: r.titular.id,
        nombreCompleto: nominaCompleta.find((n) => n.tipo === r.titular.tipo && n.id === r.titular.id)?.nombreCompleto ?? `#${r.titular.id}`,
        motivo: r.motivo,
      })),
      lugaresLiberados: sobrantesLiberados ? lugaresALiberar : 0,
      ...(!sobrantesLiberados && {
        advertencia: `La salida se confirmó, pero no se pudieron liberar ${lugaresALiberar} lugares sobrantes ante la autoridad. Reintentá con POST /api/salidas/${idsalida}/asignacion/liberar-sobrantes`,
      }),
    };
  }

  // CU-40 paso 12, reintento (SAL-09): libera los sobrantes que quedaron pendientes. Idempotente
  async liberarSobrantes(idsalida: number) {
    const salida = await this.repository.buscarSalida(idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe");
    if (salida.estado !== "CERRADA" || !salida.idbloqueo) {
      throw CustomError.badRequest("La salida no tiene lugares sobrantes por liberar");
    }
    const n = salida.lugaresPorLiberar;
    if (n > 0 && !(await this.liberar(salida.idbloqueo, idsalida, n))) {
      throw CustomError.serviceUnavailable("No fue posible liberar los lugares ante la autoridad. Reintentá más tarde");
    }
    return { lugaresLiberados: n };
  }

  // true si quedaron liberados (o si otro pedido ya los tomó); false si la autoridad falló
  private async liberar(idbloqueo: string, idsalida: number, n: number) {
    if (!(await this.repository.tomarSobrantes(idsalida, n))) return true;
    try {
      await obtenerAutoridad().liberarLugaresSobrantes(idbloqueo, n);
      return true;
    } catch (e) {
      console.error(`No se pudieron liberar ${n} lugares del bloqueo ${idbloqueo}`, e);
      // Limitación: si la base también falla acá, la cantidad se pierde y solo queda el log
      await this.repository.devolverSobrantes(idsalida, n).catch((e2) => console.error("No se pudo volver a marcar los sobrantes pendientes", e2));
      return false;
    }
  }

  // Precondiciones, FA5, faltantes (B4, 12.3) y cálculos compartidos por el panel y la confirmación
  private async prepararConfirmacion(idsalida: number) {
    const salida = await this.repository.buscarSalida(idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe");
    const hoy = hoyUTC();
    if (!SALIDAS_NO_INICIADAS.includes(salida.estado) || salida.fechaInicio <= hoy) {
      throw CustomError.badRequest("No se puede confirmar una salida que ya inició o no está activa");
    }
    if (!salida.idbloqueo) throw CustomError.badRequest("La salida no tiene un bloqueo de cupo ante la autoridad");

    const vendidos = salida.reservas.reduce((total, r) => total + r.pasajeros.length, 0);
    const { circuito } = salida.paquete;
    const dotacion = calcularDotacion(circuito.minimoGuias, circuito.parametrosPorteadores, vendidos);
    if (!dotacion) throw CustomError.badRequest("El circuito no tiene cargados sus parámetros de dotación");

    const recursos = revisarRecursos(salida, await this.salidas.cargarEquipoDe([salida]), vendidos);
    const guias = recursos.personal.filter((p) => p.rol === ROL_GUIA).length;
    const porteadores = recursos.personal.length - guias;
    const faltantes = [
      ...recursos.faltas,
      ...recursos.noAptos,
      ...(guias < dotacion.guias || porteadores < dotacion.porteadores
        ? [`La salida necesita al menos ${dotacion.guias} guías y ${dotacion.porteadores} porteadores (tiene ${guias} y ${porteadores})`]
        : []),
    ];
    // FA5: no se confirma con alojamientos sin confirmar (se resuelven con el CU-34)
    const pendientes = salida.reservas.filter((r) => r.estadoAlojamiento === ESTADO_ALOJAMIENTO.PENDIENTE).map((r) => r.nroReserva);

    const venta = datosVenta(salida, hoy);
    const bloqueaPorRecursos = salida.estado !== ESTADO_SALIDA.CERRADA && !venta.ventaAbierta && vendidos > 0;
    const motivoNoConfirmable =
      salida.estado === ESTADO_SALIDA.CERRADA ? "La salida ya está confirmada"
      : venta.ventaAbierta ? `La venta sigue abierta hasta el ${fechaCorta(new Date(venta.ultimoDiaVenta))}: la salida se confirma después del corte`
      : vendidos === 0 ? "La salida no tiene pasajeros confirmados: corresponde cancelarla"
      : pendientes.length ? `No se puede confirmar: hay alojamientos sin confirmar en las reservas ${pendientes.join(", ")}`
      : faltantes.length ? `Falta resolver antes de confirmar: ${faltantes.join(". ")}`
      : null;

    // El cupo ante la autoridad se pidió por el máximo más el personal (decisión 5). CU-38 reemplaza uno por uno,
    // así que lo que sobra son los lugares de pasajeros sin vender
    const bloqueoInicial = salida.tamanoMaximo + recursos.personal.length;
    const sobrantes = Math.max(0, salida.tamanoMaximo - vendidos);

    return { salida, venta, vendidos, dotacion, recursos, faltantes, pendientes, motivoNoConfirmable, bloqueaPorRecursos, bloqueoInicial, sobrantes };
  }
}

// Nómina completa (paso 14): pasajeros de las reservas confirmadas y personal asignado
const MOTIVO_PASAPORTE_VENCIDO = "Pasaporte vence antes de finalizar el recorrido";

const armarNomina = (
  salida: SalidaParaAsignar,
  personal: { idpersonal: number; nombreCompleto: string; nacionalidad: string; nroPasaporte: string; fechaVencimientoPasaporte: Date }[]
): TitularPermiso[] => [
  ...salida.reservas.flatMap((r) =>
    r.pasajeros.map(({ pasajero: p }) => ({
      tipo: "PASAJERO" as const,
      id: p.idpasajero,
      nombreCompleto: p.nombreCompleto,
      nacionalidad: p.nacionalidad,
      nroPasaporte: p.nroPasaporte,
      fechaVencimientoPasaporte: p.fechaVencimientoPasaporte,
    }))
  ),
  ...personal.map((p) => ({
    tipo: "PERSONAL" as const,
    id: p.idpersonal,
    nombreCompleto: p.nombreCompleto,
    nacionalidad: p.nacionalidad,
    nroPasaporte: p.nroPasaporte,
    fechaVencimientoPasaporte: p.fechaVencimientoPasaporte,
  })),
];
