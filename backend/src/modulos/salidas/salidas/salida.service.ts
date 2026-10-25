import { CustomError } from "../../../error/CustomError";
import { ESTADO, ESTADO_SALIDA, SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { hoyUTC } from "../../../shared/fechas";
import { ROL_GUIA } from "../../cuentas/personal/personal.dto";
import { obtenerAutoridad } from "../autoridad.wiring";
import { calcularDotacion } from "./salida.dotacion";
import { ConsultarSalidasDto, CrearSalidaDto } from "./salida.dto";
import { SalidaListada, SalidaRepository } from "./salida.repository";

const DIA_MS = 24 * 60 * 60 * 1000;

export class SalidaService {
  private repository = new SalidaRepository();

  // CU-35: Consultar salidas
  async consultarSalidas(dto: ConsultarSalidasDto) {
    const ahora = new Date();
    return (await this.repository.buscar(dto)).map((s) => resumirSalida(s, ahora));
  }

  // CU-36 pasos 4 a 7: dotación, total de lugares y alojamientos que se pueden bloquear
  async consultarOpcionesSalida(dto: CrearSalidaDto) {
    const { paquete, dotacion, totalLugares, alojamientos } = await this.prepararSalida(dto);
    // Informativo: si la autoridad no responde, la consulta sigue y el cupo queda sin informar
    const libres = await obtenerAutoridad().consultarDisponibilidad(dto.fechaInicio).catch(() => null);
    return {
      paquete: { idpaquete: paquete.idpaquete, nombrePaquete: paquete.nombrePaquete },
      tamanoMaximo: dto.tamanoMaximo,
      dotacion,
      totalLugares,
      cupoAutoridad: libres === null ? null : { lugaresDisponibles: libres, alcanza: libres >= totalLugares },
      alojamientos: alojamientos.map((a) => ({
        idservicio: a.idservicio,
        nombreServicio: a.nombreServicio,
        localidad: a.localidad,
        categoria: a.alojamiento?.categoria,
        capacidadDisponible: a.alojamiento?.capacidadDisponible,
        alcanza: (a.alojamiento?.capacidadDisponible ?? 0) >= dto.tamanoMaximo,
      })),
    };
  }

  // CU-36 pasos 9 a 12: bloquear el cupo ante la autoridad y registrar la salida publicada
  async crearSalida(dto: CrearSalidaDto) {
    const { paquete, dotacion, totalLugares, alojamientos } = await this.prepararSalida(dto);

    const conPlazas = alojamientos.filter((a) => (a.alojamiento?.capacidadDisponible ?? 0) >= dto.tamanoMaximo);
    if (dto.idalojamiento && !conPlazas.some((a) => a.idservicio === dto.idalojamiento)) {
      throw CustomError.badRequest(
        "El alojamiento elegido no cumple la garantía del paquete, no confirma por bloqueo de plazas o no tiene capacidad suficiente"
      );
    }
    // FA3: solo se crea sin alojamiento cuando ninguno confirma por bloqueo
    if (!dto.idalojamiento && conPlazas.length > 0) {
      throw CustomError.badRequest("Hay alojamientos que confirman por bloqueo de plazas: elegí uno (idalojamiento)");
    }

    // Paso 9: la autoridad va ANTES de la transacción, porque no se puede deshacer con un rollback
    const autoridad = obtenerAutoridad();
    let bloqueo;
    try {
      bloqueo = await autoridad.solicitarBloqueoCupo(dto.fechaInicio, totalLugares);
    } catch {
      // FA2
      throw CustomError.serviceUnavailable(
        "No fue posible comunicarse con el servicio de la autoridad. Reintentá más tarde"
      );
    }
    if (!bloqueo.aprobado) {
      // FA1
      throw CustomError.badRequest(
        `No hay cupo suficiente: la salida necesita ${totalLugares} lugares y hay ${bloqueo.lugaresDisponibles} disponibles para esa fecha`
      );
    }

    try {
      const salida = await this.repository.crearSalida({
        idpaquete: paquete.idpaquete,
        fechaInicio: dto.fechaInicio,
        fechaFin: new Date(dto.fechaInicio.getTime() + (paquete.circuito.duracionDias - 1) * DIA_MS),
        tamanoMaximo: dto.tamanoMaximo,
        idbloqueo: bloqueo.idBloqueo,
        idalojamiento: dto.idalojamiento,
      });
      return { salida, dotacion, totalLugares };
    } catch (error) {
      // Compensación: la base falló después de bloquear, así que se devuelven los lugares
      await autoridad
        .liberarTotalidadCupos(bloqueo.idBloqueo)
        .catch((e) => console.error(`Compensación fallida: el bloqueo ${bloqueo.idBloqueo} quedó tomado`, e));
      throw error;
    }
  }

  // Validaciones y cálculos compartidos por la consulta de opciones y la creación
  private async prepararSalida(dto: CrearSalidaDto) {
    const paquete = await this.repository.buscarPaquete(dto.idpaquete);
    if (!paquete) throw CustomError.notFound("El paquete no existe");
    if (paquete.estado !== ESTADO.ACTIVO || paquete.circuito.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("El paquete o su circuito no están activos");
    }

    if (dto.fechaInicio <= hoyUTC()) throw CustomError.badRequest("La fecha de inicio tiene que ser futura");

    const tarifaVigente = paquete.tarifas.some(
      (t) =>
        t.temporada.estado === ESTADO.ACTIVO &&
        t.temporada.fechaInicio <= dto.fechaInicio &&
        dto.fechaInicio <= t.temporada.fechaFin
    );
    if (!tarifaVigente) {
      throw CustomError.badRequest("El paquete no tiene un precio vigente para la temporada de esa fecha");
    }

    const dotacion = calcularDotacion(
      paquete.circuito.minimoGuias,
      paquete.circuito.parametrosPorteadores,
      dto.tamanoMaximo
    );
    if (!dotacion) {
      throw CustomError.badRequest(
        "El circuito no tiene cargados sus parámetros de dotación (ej. 'minimoGuias' y '1 por cada 2 pasajeros')"
      );
    }

    const totalLugares = dto.tamanoMaximo + dotacion.guias + dotacion.porteadores;
    const alojamientos = await this.repository.buscarAlojamientosConBloqueo(paquete);
    return { paquete, dotacion, totalLugares, alojamientos };
  }
}

// RF-61: una salida está "próxima" si empieza dentro de estos días (supuesto del grupo, ver ERS)
export const DIAS_ALERTA = 7;

/**
 * CU-35 (RF-50 y RF-61): agrega a cada salida los datos del listado del administrador.
 * - permisosFaltantes: pasajeros confirmados + personal asignado − permisos emitidos.
 * - etapaEsperada (solo EN_CURSO): reparto proporcional de las etapas en los días del circuito,
 *   porque el itinerario no guarda en qué día cae cada etapa (supuesto del grupo).
 * - alertas: con la salida a DIAS_ALERTA días o menos de empezar, solicitudes pendientes o permisos sin emitir.
 */
export function resumirSalida(s: SalidaListada, ahora: Date) {
  const { reservas, permisos, ...salida } = s;
  const pasajerosConfirmados = reservas.reduce((t, r) => t + r._count.pasajeros, 0);
  const cantidadPersonal = salida.personalAsignado.length;
  const emitidos = permisos.length + reservas.reduce((t, r) => t + r.permisos.length, 0);
  const permisosFaltantes = Math.max(0, pasajerosConfirmados + cantidadPersonal - emitidos);
  const guias = salida.personalAsignado.filter((a) => a.personal.rol === ROL_GUIA).map((a) => a.personal.nombreCompleto);

  let etapaEsperada: number | null = null;
  const { duracionDias, _count } = salida.paquete.circuito;
  if (salida.estado === ESTADO_SALIDA.EN_CURSO && _count.etapas > 0 && duracionDias > 0) {
    const dia = Math.floor((ahora.getTime() - salida.fechaInicio.getTime()) / DIA_MS) + 1;
    etapaEsperada = Math.min(_count.etapas, Math.max(1, Math.ceil((dia / duracionDias) * _count.etapas)));
  }
  const etapaInformada = salida.ultimaEtapaAlcanzada ?? null;

  const alertas: string[] = [];
  const diasParaEmpezar = (salida.fechaInicio.getTime() - ahora.getTime()) / DIA_MS;
  const porEmpezar = salida.estado !== ESTADO_SALIDA.EN_CURSO && SALIDAS_ACTIVAS.includes(salida.estado);
  if (porEmpezar && diasParaEmpezar >= 0 && diasParaEmpezar <= DIAS_ALERTA) {
    if (reservas.some((r) => r.solicitudes.length > 0)) alertas.push("SOLICITUD_PENDIENTE");
    if (permisosFaltantes > 0) alertas.push("PERMISOS_SIN_CONFIRMAR");
  }

  return {
    ...salida,
    pasajerosConfirmados,
    cantidadPersonal,
    guias,
    permisosFaltantes,
    etapaEsperada,
    etapaInformada,
    etapaDesfasada: etapaEsperada !== null && etapaEsperada !== (etapaInformada ?? 0),
    alertas,
  };
}
