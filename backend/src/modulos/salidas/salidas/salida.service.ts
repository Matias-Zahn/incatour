import { CustomError } from "../../../error/CustomError";
import { COBERTURA_MINIMA_STOCK, ESTADO, ESTADO_SALIDA, redondear2, SALIDAS_ACTIVAS, SALIDAS_NO_INICIADAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { codigoDia, diasDe, fechaCorta, hoyUTC } from "../../../shared/fechas";
import { claveDia, rangosDe, unaPorServicio } from "../../../shared/ocupacion";
import { armarDefinicionPaquete, DefinicionPaquete, tarifaDeSalida, tarifaVigente } from "../../../shared/definicionPaquete";
import { controlEquipo, FilaEquipo, reglasEquipo, tamanoQueAlcanza } from "../../../shared/equipo";
import { motivoNoApto, noAptos } from "../../../shared/aptitud";
import { corteDeVenta, datosVenta, motivoFechaInvalida } from "../../../shared/ventaAbierta";
import { ROL_GUIA, ROL_PORTEADOR } from "../../cuentas/personal/personal.dto";
import { obtenerAutoridad } from "../autoridad.wiring";
import { calcularDotacion } from "./salida.dotacion";
import { ConsultarSalidasDto, CrearSalidaDto } from "./salida.dto";
import { HotelSalida, SalidaListada, SalidaRepository } from "./salida.repository";

const DIA_MS = 24 * 60 * 60 * 1000;
const fecha = (clave: string) => fechaCorta(new Date(clave));
export type DatosEquipo = { totales: Map<number, number>; filas: FilaEquipo[] };

export class SalidaService {
  private repository = new SalidaRepository();

  // CU-35: Consultar salidas
  async consultarSalidas(dto: ConsultarSalidasDto) {
    return this.listar(await this.repository.buscar(dto));
  }

  private async listar(salidas: SalidaListada[]) {
    const equipo = await this.repository.cargarEquipoDe(salidas);
    const ahora = new Date();
    return salidas.map((s) => resumirSalida(s, ahora, equipo));
  }

  // CU-36 pasos 4 a 7: dotación, total de lugares y lo que se puede elegir (hotel, transporte, personal), con el equipo controlado
  async consultarOpcionesSalida(dto: CrearSalidaDto) {
    const p = await this.prepararSalida(dto);
    const { paquete, totalLugares } = p;
    // Informativo: si la autoridad no responde, la consulta sigue y el cupo queda sin informar
    const libres = await obtenerAutoridad().consultarDisponibilidad(dto.fechaInicio).catch(() => null);
    const idtransporte = paquete.servicios.find((s) => s.servicio.transporte)?.idservicio ?? null;
    const personal = (rol: string) =>
      p.personal
        .filter((x) => x.rol === rol)
        .sort((a, b) => a.salidasEnElMes - b.salidasEnElMes || a.nombreCompleto.localeCompare(b.nombreCompleto))
        .map((x) => ({ idpersonal: x.idpersonal, nombreCompleto: x.nombreCompleto, rol: x.rol, salidasEnElMes: x.salidasEnElMes }));
    return {
      paquete: { idpaquete: paquete.idpaquete, nombrePaquete: paquete.nombrePaquete, idtransporte, diasCierreVenta: paquete.diasCierreVenta },
      fechaFin: claveDia(p.fechaFin),
      // B9: si el tren no operara ese día, prepararSalida ya lo rechazó
      tren: p.tren && {
        idservicio: p.tren.idservicio,
        nombreServicio: p.tren.nombreServicio,
        horarioSalida: p.tren.tren.horarioSalida,
        horarioLlegada: p.tren.tren.horarioLlegada,
        diasOperacion: p.tren.tren.diasOperacion,
        operaEseDia: diasDe(p.tren.tren.diasOperacion).includes(codigoDia(dto.fechaInicio)),
      },
      tamanoMaximo: dto.tamanoMaximo,
      dotacion: p.dotacion,
      totalLugares,
      cupoAutoridad: libres === null ? null : { lugaresDisponibles: libres, alcanza: libres >= totalLugares },
      tarifa: p.tarifa,
      plazasNecesarias: p.rangosAlojamiento.length ? dto.tamanoMaximo : 0,
      alojamientos: p.alojamientos.map((a) => ({
        idservicio: a.idservicio,
        nombreServicio: a.nombreServicio,
        localidad: a.localidad,
        categoria: a.alojamiento?.categoria,
        modalidadConfirmacion: a.alojamiento?.modalidadConfirmacion,
        capacidadDisponible: a.disponible, // A1: lo disponible en las noches de la salida; null a solicitud
        alcanza: a.disponible === null || a.disponible >= dto.tamanoMaximo, // decisión 10: el a solicitud cubre lo que falte
      })),
      transportes: p.transportes.map((t) => ({
        idservicio: t.idservicio,
        nombreServicio: t.nombreServicio,
        capacidadVehiculo: t.capacidadVehiculo,
        delPaquete: t.idservicio === idtransporte,
        libre: t.libre,
        alcanza: t.capacidadVehiculo >= totalLugares, // 12.4
      })),
      personal: { guias: personal(ROL_GUIA), porteadores: personal(ROL_PORTEADOR) },
      equipo: p.equipo.map((e) => ({
        idservicio: e.idservicio,
        nombreServicio: e.nombreServicio,
        tipoEquipamiento: e.tipoEquipamiento,
        cantidad: e.cantidad,
        cadaPasajeros: e.cadaPasajeros,
        necesitaCompleta: e.necesitaCompleta,
        libre: e.libre,
        fechaCritica: e.fechaCritica,
        nivel: e.nivel,
      })),
    };
  }

  // CU-36 pasos 8 a 12: controlar lo elegido, bloquear el cupo ante la autoridad y registrar la salida publicada
  async crearSalida(dto: CrearSalidaDto) {
    const p = await this.prepararSalida(dto);
    const { paquete, dotacion, alojamientos, fechaFin, rangosAlojamiento } = p;

    const hoteles = elegirHoteles(dto, alojamientos, rangosAlojamiento.length > 0);

    // B3 y 12.3: personal que existe, apto hasta el fin y que cubre la dotación por el máximo; se aceptan extras (decisión 5)
    const elegidos = await this.repository.buscarPersonal(dto.personalIds);
    const rechazados = noAptos(dto.personalIds, elegidos, fechaFin);
    if (rechazados.length) throw CustomError.badRequest(rechazados.join(". "));
    const guias = elegidos.filter((e) => e.rol === ROL_GUIA).length;
    const porteadores = elegidos.filter((e) => e.rol === ROL_PORTEADOR).length;
    if (guias < dotacion.guias || porteadores < dotacion.porteadores) {
      throw CustomError.badRequest(
        `La salida necesita al menos ${dotacion.guias} guías y ${dotacion.porteadores} porteadores (elegiste ${guias} y ${porteadores})`
      );
    }
    if (dto.personalIds.some((id) => !p.personal.some((x) => x.idpersonal === id))) {
      throw CustomError.conflict("Parte del personal elegido se asignó a otra salida en esas fechas. Volvé a cargar las opciones");
    }

    // B3 y 12.4: el vehículo lleva a los pasajeros y al personal
    const totalLugares = dto.tamanoMaximo + dto.personalIds.length;
    const transporte = p.transportes.find((t) => t.idservicio === dto.idtransporte);
    if (!transporte) {
      throw CustomError.badRequest("El transporte elegido no está disponible: tiene que estar activo y no costar más que el del paquete");
    }
    if (transporte.capacidadVehiculo < totalLugares) {
      throw CustomError.badRequest(
        `El transporte elegido tiene ${transporte.capacidadVehiculo} asientos y la salida necesita ${totalLugares} lugares ` +
          `(${dto.tamanoMaximo} pasajeros y ${dto.personalIds.length} del personal)`
      );
    }
    if (!transporte.libre) throw CustomError.conflict("El transporte elegido ya está ocupado en esas fechas. Volvé a cargar las opciones");

    // A2b: por debajo del 50 % no se crea; entre el 50 y el 100 % se crea con aviso
    const noAlcanza = p.equipo.filter((e) => e.nivel === "NO_ALCANZA");
    if (noAlcanza.length) {
      const sugerido = Math.min(...noAlcanza.map((e) => tamanoQueAlcanza(e.libre, e)));
      const faltantes = noAlcanza.map((e) => ({
        idservicio: e.idservicio,
        nombreServicio: e.nombreServicio,
        fecha: e.fechaCritica,
        libre: e.libre,
        necesitaMinimo: Math.ceil(e.necesitaCompleta * COBERTURA_MINIMA_STOCK),
      }));
      const textos = noAlcanza.map(
        (e, i) => `el ${fecha(e.fechaCritica)} hay ${e.libre} libres de ${e.nombreServicio} y la salida necesita al menos ${faltantes[i]!.necesitaMinimo} (${e.necesitaCompleta} si se vende completa)`
      );
      throw CustomError.conflict(
        `No alcanza el equipo: ${textos.join("; ")}.${sugerido > 0 ? ` Probá con un máximo de ${sugerido} pasajeros` : ""}`,
        { faltantes, tamanoMaximoSugerido: sugerido }
      );
    }
    const advertencias = p.equipo
      .filter((e) => e.nivel === "RIESGO")
      .map((e) => `Si se vende completa faltarían hasta ${e.necesitaCompleta - e.libre} de ${e.nombreServicio} el ${fecha(e.fechaCritica)}`);

    // B4 y B10: con algún hotel a solicitud (o ninguno, con noches) hay que gestionarlo con el hotel y el corte es más largo.
    // 12.6: con el corte final, la salida no puede nacer con la venta cerrada
    const aSolicitud = rangosAlojamiento.length > 0 && (!hoteles.length || hoteles.some((h) => h.plazas === null));
    const diasCierreVenta = dto.diasCierreVenta ?? corteDeVenta(paquete.diasCierreVenta, aSolicitud);
    const motivo = motivoFechaInvalida(dto.fechaInicio, { diasDisponibles: null, diasCierreVenta });
    if (motivo) throw CustomError.badRequest(motivo);

    // Paso 9: la autoridad va ANTES de la transacción, porque no se puede deshacer con un rollback.
    // Decisión 5: el cupo es por el máximo de pasajeros más el personal elegido (con los extras)
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
        fechaFin,
        tamanoMaximo: dto.tamanoMaximo,
        idbloqueo: bloqueo.idBloqueo,
        hoteles,
        idtransporte: dto.idtransporte,
        personalIds: dto.personalIds,
        equipos: p.equipo.map((e) => e.idservicio),
        diasCierreVenta,
        rangosAlojamiento,
        definicionPaquete: p.definicion,
      });
      const [resumen] = await this.listar([salida]);
      return { salida: resumen!, dotacion, totalLugares, advertencias };
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

    // B9 y 12.6: día habilitado del paquete, día en que opera el tren y fecha mínima por el corte de venta
    const tren = paquete.servicios.map((s) => s.servicio).find((s) => s.tren);
    const motivo = motivoFechaInvalida(dto.fechaInicio, {
      diasDisponibles: paquete.diasDisponibles,
      tren: tren?.tren && { nombreServicio: tren.nombreServicio, diasOperacion: tren.tren.diasOperacion },
      diasCierreVenta: dto.diasCierreVenta ?? paquete.diasCierreVenta,
    });
    if (motivo) throw CustomError.badRequest(motivo);

    const tarifa = tarifaVigente(paquete.tarifas, dto.fechaInicio); // 12.5: se congela en la copia del paquete
    if (!tarifa) {
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
    // A1: el hotel se ocupa solo en las noches previas y posteriores del paquete
    const fechaFin = new Date(dto.fechaInicio.getTime() + (paquete.circuito.duracionDias - 1) * DIA_MS);
    const fechas = { fechaInicio: dto.fechaInicio, fechaFin };
    const rangosAlojamiento = rangosDe(TIPO_SERVICIO.ALOJAMIENTO, fechas, paquete);
    const definicion = armarDefinicionPaquete(paquete, tarifa);
    const salidaNueva = { ...fechas, estado: ESTADO_SALIDA.PUBLICADA, tamanoMaximo: dto.tamanoMaximo, definicionPaquete: definicion };
    const [alojamientos, todosLosTransportes, libres, datosEquipo] = await Promise.all([
      this.repository.buscarAlojamientos(paquete, rangosAlojamiento),
      this.repository.buscarTransportes(fechas),
      this.repository.buscarPersonalLibre(fechas),
      this.repository.cargarEquipoDe([salidaNueva]),
    ]);
    // El precio se fijó con el transporte del paquete: la salida solo lo reemplaza por otro que no cueste más
    // (como el hotel, que el simulador toma por el más caro de la categoría)
    const delPaquete = todosLosTransportes.find((t) => paquete.servicios.some((s) => s.idservicio === t.idservicio));
    const transportes = delPaquete
      ? todosLosTransportes.filter((t) => t === delPaquete || t.costoBase <= delPaquete.costoBase)
      : todosLosTransportes;
    // A2b: cada equipo con regla, contra la demanda proyectada de las otras salidas
    const equipo = reglasEquipo(definicion).map((r) => ({
      ...controlEquipo(r, datosEquipo.totales.get(r.idservicio) ?? 0, datosEquipo.filas, salidaNueva, 0),
      tipoEquipamiento: paquete.servicios.find((s) => s.idservicio === r.idservicio)?.servicio.equipamiento?.tipoEquipamiento ?? null,
    }));
    return {
      paquete, dotacion, totalLugares, alojamientos, fechaFin, rangosAlojamiento, tarifa, transportes, equipo, definicion,
      personal: libres.filter((x) => !motivoNoApto(x, fechaFin)), // 12.3: los que no son aptos no se listan
      tren: tren?.tren ? { ...tren, tren: tren.tren } : null,
    };
  }
}

/**
 * B10: los hoteles elegidos, con lo que bloquea cada uno. Tienen que cumplir la garantía (estar en las opciones) y entre
 * todos cubrir el máximo: cada uno con bloqueo pone lo libre hasta completar, en el orden elegido, y uno a solicitud
 * cubre lo que falte (decisión 10). Sin noches de hotel no se ocupa ninguno. Sin hoteles solo si nada cubre (FA3).
 */
export function elegirHoteles(
  dto: Pick<CrearSalidaDto, "alojamientos" | "tamanoMaximo">,
  opciones: { idservicio: number; nombreServicio: string; disponible: number | null }[],
  conNoches: boolean
): HotelSalida[] {
  if (!conNoches) return [];
  const elegidos = dto.alojamientos.map((id) => {
    const h = opciones.find((o) => o.idservicio === id);
    if (!h) throw CustomError.badRequest(`El hotel con ID ${id} no cumple la garantía del paquete`);
    return h;
  });
  const bloqueadas = (hs: typeof opciones) => hs.reduce((t, h) => t + (h.disponible ?? 0), 0);
  const cubre = (hs: typeof opciones) => hs.some((h) => h.disponible === null) || bloqueadas(hs) >= dto.tamanoMaximo;
  if (!elegidos.length) {
    if (cubre(opciones)) throw CustomError.badRequest("Elegí al menos un hotel");
    return [];
  }
  if (!cubre(elegidos)) {
    throw CustomError.badRequest(`Los hoteles elegidos cubren ${bloqueadas(elegidos)} de ${dto.tamanoMaximo} plazas en esas noches`);
  }
  let faltan = dto.tamanoMaximo;
  const conBloqueo = elegidos.filter((h) => h.disponible !== null).flatMap((h) => {
    const plazas = Math.min(h.disponible!, faltan);
    faltan -= plazas;
    return plazas > 0 ? [{ idservicio: h.idservicio, nombreServicio: h.nombreServicio, plazas }] : []; // el que sobra no se ocupa
  });
  const aSolicitud = elegidos.filter((h) => h.disponible === null).map((h) => ({ idservicio: h.idservicio, nombreServicio: h.nombreServicio, plazas: null }));
  return [...conBloqueo, ...aSolicitud];
}

type SalidaRevisable =Pick<SalidaListada, "idsalida" | "estado" | "fechaInicio" | "fechaFin" | "tamanoMaximo" | "definicionPaquete"> & {
  personalAsignado: { personal: Parameters<typeof motivoNoApto>[0] & { idpersonal: number; nombreCompleto: string } }[];
  ocupaciones: { tipo: string; idservicio: number; servicio: { nombreServicio: string; transporte?: { capacidadVehiculo: number } | null } }[];
};

/**
 * B4 y 12.3: lo que le falta a una salida, para el listado (alertas) y para confirmarla (CU-40).
 * - personal: cada asignado con su motivo de no apto (12.3);
 * - transporte: si alcanza para los pasajeros (el máximo mientras se vende, los vendidos después) más el personal (12.4);
 * - equipo: cada equipo de la copia, contra lo vendido y el stock (FALTA_RECURSO) y contra la venta completa (RIESGO_STOCK).
 */
export function revisarRecursos(s: SalidaRevisable, equipo: DatosEquipo, vendidos: number) {
  const personal = s.personalAsignado.map(({ personal: x }) => ({ ...x, motivo: motivoNoApto(x, s.fechaFin) }));
  const lugares = (s.estado === ESTADO_SALIDA.PUBLICADA ? s.tamanoMaximo : vendidos) + personal.length;
  const t = s.ocupaciones.find((o) => o.tipo === TIPO_SERVICIO.TRANSPORTE);
  const transporte = t && {
    idservicio: t.idservicio,
    nombreServicio: t.servicio.nombreServicio,
    capacidadVehiculo: t.servicio.transporte?.capacidadVehiculo ?? 0,
    alcanza: (t.servicio.transporte?.capacidadVehiculo ?? 0) >= lugares,
  };
  const equipos = reglasEquipo(s.definicionPaquete as DefinicionPaquete | null).map((r) =>
    controlEquipo(r, equipo.totales.get(r.idservicio) ?? 0, equipo.filas, s, vendidos)
  );
  const faltas = [
    ...equipos.filter((e) => e.falta > 0).map((e) => `Faltan ${e.falta} de ${e.nombreServicio} el ${fecha(e.fechaFalta)}`),
    ...(!transporte
      ? ["Falta el transporte"]
      : transporte.alcanza
        ? []
        : [`El transporte ${transporte.nombreServicio} tiene ${transporte.capacidadVehiculo} asientos y la salida necesita ${lugares} lugares`]),
  ];
  const riesgos = equipos
    .filter((e) => e.libre < e.necesitaCompleta)
    .map((e) => `Si se vende completa faltarían hasta ${e.necesitaCompleta - e.libre} de ${e.nombreServicio} el ${fecha(e.fechaCritica)}`);
  const noAptos = personal.filter((x) => x.motivo).map((x) => `${x.nombreCompleto}: ${x.motivo}`);
  return { personal, transporte: transporte ?? null, equipos, faltas, riesgos, noAptos };
}

// RF-61: una salida está "próxima" si empieza dentro de estos días (supuesto del grupo, ver ERS)
export const DIAS_ALERTA = 7;
const HORA_MS = 60 * 60 * 1000;

/**
 * CU-35 (RF-50 y RF-61): agrega a cada salida los datos del listado del administrador.
 * - permisosFaltantes: pasajeros confirmados + personal asignado − permisos emitidos.
 * - etapaEsperada (solo EN_CURSO): reparto proporcional de las etapas en los días del circuito,
 *   porque el itinerario no guarda en qué día cae cada etapa (supuesto del grupo).
 * - alertas: con la salida a DIAS_ALERTA días o menos de empezar, solicitudes pendientes o permisos sin emitir;
 *   además, la que llegó a su fecha y el guía no inició, la iniciada sin avances después de las horasPrimerAvance de su circuito
 *   y la que sigue en curso pasado el día siguiente a su fin.
 */
export function resumirSalida(s: SalidaListada, ahora: Date, equipo: DatosEquipo = { totales: new Map(), filas: [] }) {
  const { reservas, permisos, avances, ocupaciones, ...salida } = s;
  const { tarifas, ...paquete } = salida.paquete;
  const pasajerosConfirmados = reservas.reduce((t, r) => t + r._count.pasajeros, 0);
  // 12.5: el precio al que se vende; lo vendido suma lo que pagó cada reserva (su precio congelado)
  const tarifa = tarifaDeSalida(salida, tarifas);
  const totalVendido = redondear2(reservas.reduce((t, r) => t + r.precioCongelado, 0));
  const cantidadPersonal = salida.personalAsignado.length;
  const emitidos = permisos.length + reservas.reduce((t, r) => t + r.permisos.length, 0);
  const permisosFaltantes = Math.max(0, pasajerosConfirmados + cantidadPersonal - emitidos);
  const guias = salida.personalAsignado.filter((a) => a.personal.rol === ROL_GUIA).map((a) => a.personal.nombreCompleto);
  const hoy = hoyUTC(ahora);
  const venta = datosVenta(salida, hoy); // B4

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
  const primerAvance = avances[0]?.fechaHoraLlegada ?? null;
  if (porEmpezar && salida.fechaInicio <= hoy) alertas.push("SIN_INICIAR");
  if (salida.estado === ESTADO_SALIDA.EN_CURSO) {
    const horasDesdeInicio = salida.fechaHoraInicioReal ? (ahora.getTime() - salida.fechaHoraInicioReal.getTime()) / HORA_MS : 0;
    if (!primerAvance && horasDesdeInicio > salida.paquete.circuito.horasPrimerAvance) alertas.push("SIN_AVANCES");
    if (hoy.getTime() > salida.fechaFin.getTime() + DIA_MS) alertas.push("SIN_FINALIZAR");
  }

  // B4, A2b y 12.3: aparecen apenas pasa, sin esperar DIAS_ALERTA. avisos lleva el detalle legible
  const avisos: { alerta: string; mensaje: string }[] = [];
  const puedeConfirmar = salida.estado === ESTADO_SALIDA.PUBLICADA && !venta.ventaAbierta && salida.fechaInicio > hoy;
  if (SALIDAS_NO_INICIADAS.includes(salida.estado)) {
    const r = revisarRecursos(s, equipo, pasajerosConfirmados);
    avisos.push(...r.faltas.map((mensaje) => ({ alerta: "FALTA_RECURSO", mensaje })));
    if (venta.ventaAbierta) avisos.push(...r.riesgos.map((mensaje) => ({ alerta: "RIESGO_STOCK", mensaje })));
    avisos.push(...r.noAptos.map((mensaje) => ({ alerta: "PERSONAL_NO_APTO", mensaje })));
  }
  if (puedeConfirmar) {
    avisos.push({ alerta: "PENDIENTE_CONFIRMAR", mensaje: `La venta cerró el ${fecha(venta.ultimoDiaVenta)}: falta confirmar la salida` });
  }
  alertas.push(...new Set(avisos.map((a) => a.alerta)));

  return {
    ...salida,
    paquete,
    ...venta,
    precioPorPasajero: tarifa ? { monto: tarifa.monto, moneda: tarifa.moneda, temporada: tarifa.temporada } : null,
    totalVendido,
    puedeConfirmar,
    // Decisión 12 del contrato: la forma de SalidaServicio, armada desde Ocupacion (el hotel, una vez aunque ocupe dos tramos)
    servicios: unaPorServicio(ocupaciones).map((o) => ({
      idsalida: o.idsalida,
      idservicio: o.idservicio,
      tipo: o.tipo,
      comprobanteReserva: o.comprobanteReserva,
      servicio: { nombreServicio: o.servicio.nombreServicio },
    })),
    pasajerosConfirmados,
    cantidadPersonal,
    guias,
    permisosFaltantes,
    etapaEsperada,
    etapaInformada,
    // La esperada es la que el grupo está caminando y la informada la última que completó:
    // al día cuando completó la anterior a la esperada, o la esperada misma
    etapaDesfasada:
      etapaEsperada !== null &&
      ((etapaInformada ?? 0) < etapaEsperada - 1 || (etapaInformada ?? 0) > etapaEsperada),
    primerAvance,
    alertas,
    avisos,
  };
}
