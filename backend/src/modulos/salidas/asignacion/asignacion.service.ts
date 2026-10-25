import { hoyUTC } from "../../../shared/fechas";
import { CustomError } from "../../../error/CustomError";
import { ESTADO_ALOJAMIENTO } from "../../../shared/constantes";
import { PermisoEmitido, PermisoRechazado, TitularPermiso } from "../../../integraciones/autoridad/autoridad.interface";
import { obtenerAutoridad } from "../autoridad.wiring";
import { LogisticaRepository } from "../logistica/logistica.repository";
import { calcularDotacion } from "../salidas/salida.dotacion";
import { ROL_GUIA, ROL_PORTEADOR } from "../../cuentas/personal/personal.dto";
import { ConfirmarAsignacionDto } from "./asignacion.dto";
import { AsignacionRepository, ESTADOS_ASIGNABLES, SalidaParaAsignar } from "./asignacion.repository";

export class AsignacionService {
  private repository = new AsignacionRepository();
  private logistica = new LogisticaRepository();

  // CU-40 pasos 2 y 3: panel de asignación (obtenerPanelAsignacion)
  async obtenerPanelAsignacion(idsalida: number) {
    const { salida, vendidos, dotacion, bloqueoInicial, sobrantes } = await this.prepararAsignacion(idsalida);
    const [personal, transportes, equipamiento] = await Promise.all([
      this.repository.personalLibre(salida),
      this.logistica.disponiblesTransporte(salida, vendidos),
      this.logistica.disponiblesEquipamiento(),
    ]);

    return {
      salida: { idsalida, nroSalida: salida.nroSalida, fechaInicio: salida.fechaInicio, fechaFin: salida.fechaFin },
      pasajerosConfirmados: vendidos,
      dotacionRequerida: dotacion,
      bloqueoInicial,
      lugaresSobrantes: sobrantes,
      personalDisponible: personal
        .filter((p) => p.rol !== ROL_GUIA || habilitacionVigente(p.guia, salida.fechaFin))
        .map((p) => ({ idpersonal: p.idpersonal, nombreCompleto: p.nombreCompleto, rol: p.rol })),
      transportesDisponibles: transportes.map((t) => ({
        idservicio: t.idservicio,
        nombreServicio: t.nombreServicio,
        capacidadVehiculo: t.transporte?.capacidadVehiculo,
      })),
      stockCamping: equipamiento.map((e) => ({
        idservicio: e.idservicio,
        nombreServicio: e.nombreServicio,
        tipoEquipamiento: e.equipamiento?.tipoEquipamiento,
        cantidadDisponible: e.equipamiento?.cantidadDisponible,
      })),
    };
  }

  // CU-40 pasos 4 a 15: confirmarAsignacion
  async confirmarAsignacion(idsalida: number, dto: ConfirmarAsignacionDto) {
    const { salida, vendidos, dotacion, sobrantes } = await this.prepararAsignacion(idsalida);

    // FA1: personal disponible, activo y con habilitación vigente
    const elegidos = await this.repository.buscarPersonal(dto.personalIds);
    const libres = new Set((await this.repository.personalLibre(salida, dto.personalIds)).map((p) => p.idpersonal));
    const problemas: string[] = [];
    for (const id of dto.personalIds) {
      const p = elegidos.find((e) => e.idpersonal === id);
      if (!p) problemas.push(`El personal ${id} no existe`);
      else if (!libres.has(id)) problemas.push(`${p.nombreCompleto} está dado de baja o asignado a otra salida en esas fechas`);
      else if (p.rol === ROL_GUIA && !habilitacionVigente(p.guia, salida.fechaFin)) {
        problemas.push(`${p.nombreCompleto} no tiene la habilitación vigente para las fechas de la salida`);
      }
    }
    if (problemas.length) throw CustomError.badRequest(problemas.join(". "));

    const guias = elegidos.filter((p) => p.rol === ROL_GUIA).length;
    const porteadores = elegidos.filter((p) => p.rol === ROL_PORTEADOR).length;
    if (guias < dotacion.guias || porteadores < dotacion.porteadores) {
      throw CustomError.badRequest(
        `La salida necesita al menos ${dotacion.guias} guías y ${dotacion.porteadores} porteadores (elegiste ${guias} y ${porteadores})`
      );
    }
    const extra = guias + porteadores - dotacion.guias - dotacion.porteadores;
    if (extra > sobrantes) {
      throw CustomError.badRequest(`Solo quedan ${sobrantes} lugares en el bloqueo para personal adicional`);
    }

    // FA3: transporte libre en esas fechas y con capacidad para los pasajeros
    const transportes = await this.logistica.disponiblesTransporte(salida, vendidos);
    if (!transportes.some((t) => t.idservicio === dto.idtransporte)) {
      throw CustomError.badRequest("El transporte elegido no tiene cupo para las fechas o la cantidad de pasajeros de la salida");
    }

    // FA2: stock de camping (se vuelve a controlar en la transacción por si cambia en el medio)
    const stock = await this.logistica.disponiblesEquipamiento();
    for (const item of dto.itemsCamping) {
      const disponible = stock.find((s) => s.idservicio === item.idservicio)?.equipamiento?.cantidadDisponible ?? 0;
      if (item.cantidad > disponible) {
        throw CustomError.badRequest(`No hay stock suficiente del artículo ${item.idservicio}: hay ${disponible}`);
      }
    }

    // FA4 (paso 13): se valida antes de tocar nada, para que el reintento parta de cero
    const nomina = armarNomina(salida, elegidos);
    const vencidos = nomina.filter((t) => t.fechaVencimientoPasaporte < salida.fechaFin);
    if (vencidos.length) {
      throw CustomError.badRequest(
        `Pasaportes que vencen antes del fin del recorrido: ${vencidos.map((t) => t.nombreCompleto).join(", ")}`
      );
    }

    // Paso 14: emisión nominal. Va antes de la transacción porque es un servicio externo
    const autoridad = obtenerAutoridad();
    let permisos: PermisoEmitido[];
    let rechazados: PermisoRechazado[];
    try {
      ({ emitidos: permisos, rechazados } = await autoridad.solicitarEmisionNominal(salida.idbloqueo!, nomina));
    } catch {
      throw CustomError.serviceUnavailable("No fue posible emitir los permisos ante la autoridad. Reintentá más tarde");
    }

    // Si algo falla después de emitir, los permisos emitidos se dan de baja
    const darDeBajaEmitidos = () =>
      Promise.all(
        permisos.map((p) =>
          autoridad
            .darDeBajaPermiso(salida.idbloqueo!, p.nroPermiso)
            .catch((e) => console.error(`Compensación fallida: el permiso ${p.nroPermiso} quedó emitido`, e))
        )
      );

    // ponytail: todo o nada hasta la fase 2 (registrar rechazados RF-47)
    if (rechazados.length) {
      await darDeBajaEmitidos();
      const detalle = rechazados.map((r) => {
        const t = nomina.find((n) => n.tipo === r.titular.tipo && n.id === r.titular.id);
        return `${t?.nombreCompleto ?? `#${r.titular.id}`} (${r.motivo})`;
      });
      throw CustomError.badRequest(`La autoridad rechazó los permisos de: ${detalle.join(", ")}`);
    }

    let salidaActualizada;
    try {
      salidaActualizada = await this.repository.confirmar({
        salida,
        personalIds: dto.personalIds,
        idtransporte: dto.idtransporte,
        itemsCamping: dto.itemsCamping,
        permisos,
        lugaresPorLiberar: sobrantes - extra,
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
    const lugaresALiberar = sobrantes - extra;
    const sobrantesLiberados = lugaresALiberar === 0 || (await this.liberar(salida.idbloqueo!, idsalida, lugaresALiberar));

    return {
      salida: salidaActualizada,
      permisosEmitidos: permisos.length,
      lugaresLiberados: sobrantesLiberados ? lugaresALiberar : 0,
      ...(!sobrantesLiberados && {
        advertencia: `La asignación se guardó, pero no se pudieron liberar ${lugaresALiberar} lugares sobrantes ante la autoridad. Reintentá con POST /api/salidas/${idsalida}/asignacion/liberar-sobrantes`,
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
      // ponytail: si la base también falla acá, la cantidad se pierde y solo queda el log
      await this.repository.devolverSobrantes(idsalida, n).catch((e2) => console.error("No se pudo volver a marcar los sobrantes pendientes", e2));
      return false;
    }
  }

  // Precondiciones, FA5 y cálculos compartidos por el panel y la confirmación
  private async prepararAsignacion(idsalida: number) {
    const salida = await this.repository.buscarSalida(idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe");
    if (!ESTADOS_ASIGNABLES.includes(salida.estado) || salida.fechaInicio <= hoyUTC()) {
      throw CustomError.badRequest("No se pueden asignar recursos a una salida que ya inició o no está activa");
    }
    if (!salida.idbloqueo) throw CustomError.badRequest("La salida no tiene un bloqueo de cupo ante la autoridad");
    if (salida.personalAsignado.length > 0) {
      throw CustomError.badRequest("La salida ya tiene personal asignado. Los cambios se hacen con el CU-38 y el CU-39");
    }

    // FA5: no se consolida con alojamientos sin confirmar (se resuelven con el CU-34)
    const pendientes = salida.reservas.filter((r) => r.estadoAlojamiento === ESTADO_ALOJAMIENTO.PENDIENTE);
    if (pendientes.length) {
      throw CustomError.conflict(
        `No se puede consolidar: hay alojamientos sin confirmar en las reservas ${pendientes.map((r) => r.nroReserva).join(", ")}`
      );
    }

    const vendidos = salida.reservas.reduce((total, r) => total + r.pasajeros.length, 0);
    if (vendidos === 0) throw CustomError.badRequest("La salida no tiene pasajeros confirmados: corresponde cancelarla (CU-37)");

    const { circuito } = salida.paquete;
    const dotacion = calcularDotacion(circuito.minimoGuias, circuito.parametrosPorteadores, vendidos);
    const estimada = calcularDotacion(circuito.minimoGuias, circuito.parametrosPorteadores, salida.tamanoMaximo);
    if (!dotacion || !estimada) throw CustomError.badRequest("El circuito no tiene cargados sus parámetros de dotación");

    // ponytail: el bloqueo inicial se recalcula con los parámetros actuales del circuito, porque la salida
    // no guarda la dotación estimada; si el circuito cambió desde el CU-36, guardar ese número en Salida.
    const bloqueoInicial = salida.tamanoMaximo + estimada.guias + estimada.porteadores;
    const sobrantes = bloqueoInicial - vendidos - dotacion.guias - dotacion.porteadores;

    return { salida, vendidos, dotacion, bloqueoInicial, sobrantes };
  }
}

export const habilitacionVigente = (guia: { fechaHabilitacion: Date | null } | null, hasta: Date) =>
  !!guia?.fechaHabilitacion && guia.fechaHabilitacion >= hasta;

// Nómina completa (paso 14): pasajeros de las reservas confirmadas y personal asignado
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
