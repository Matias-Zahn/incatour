import { CustomError } from "../../../error/CustomError";
import { ESTADO } from "../../../shared/constantes";
import { obtenerAutoridad } from "../autoridad.wiring";
import { calcularDotacion } from "./salida.dotacion";
import { ConsultarSalidasDto, CrearSalidaDto } from "./salida.dto";
import { SalidaRepository } from "./salida.repository";

const DIA_MS = 24 * 60 * 60 * 1000;

export class SalidaService {
  private repository = new SalidaRepository();

  // CU-35: Consultar salidas
  async consultarSalidas(dto: ConsultarSalidasDto) {
    return this.repository.buscar(dto);
  }

  // CU-36 pasos 4 a 7: dotación, total de lugares y alojamientos que se pueden bloquear
  async consultarOpcionesSalida(dto: CrearSalidaDto) {
    const { paquete, dotacion, totalLugares, alojamientos } = await this.prepararSalida(dto);
    return {
      paquete: { idpaquete: paquete.idpaquete, nombrePaquete: paquete.nombrePaquete },
      tamanoMaximo: dto.tamanoMaximo,
      dotacion,
      totalLugares,
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

    if (dto.fechaInicio <= new Date()) throw CustomError.badRequest("La fecha de inicio tiene que ser futura");

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
