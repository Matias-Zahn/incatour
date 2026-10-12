import { CustomError } from "../../../error/CustomError";
import { ESTADO_RESERVA, ESTADO_SALIDA, redondear2 } from "../../../shared/constantes";
import { FiltrosReseniaDto, PublicarReseniaDto } from "./resenia.dto";
import { ReseniaRepository } from "./resenia.repository";

export class ReseniaService {
  private repository: ReseniaRepository;

  constructor() {
    this.repository = new ReseniaRepository();
  }

  // DCD consultarHistorialReservas (CU-47, pasos 1 a 4)
  async consultarHistorialReservas(idusuario: number) {
    const cliente = await this.obtenerCliente(idusuario);
    const reservas = await this.repository.findHistorialReservas(cliente.idcliente);

    return reservas.map((r) => {
      const { resenias, ...salida } = r.salida;
      const resenia = resenias[0] ?? null;
      return {
        idreserva: r.idreserva,
        nroReserva: r.nroReserva,
        estadoReserva: r.estado,
        salida,
        resenia,
        // Reserva confirmada + salida finalizada + sin reseña previa (precondiciones 2, 3 y 4)
        puedeResenar:
          r.estado === ESTADO_RESERVA.CONFIRMADA && salida.estado === ESTADO_SALIDA.FINALIZADA && !resenia,
      };
    });
  }

  // DCD confirmarPublicacion (CU-47, pasos 11 a 14)
  async publicarResenia(idusuario: number, dto: PublicarReseniaDto) {
    const cliente = await this.obtenerCliente(idusuario);

    const salida = await this.repository.findSalida(dto.idsalida);
    if (!salida) throw CustomError.notFound(`No se encontró la salida con ID ${dto.idsalida}.`);

    // Regla 1: solo quien participó en la salida con una reserva confirmada
    if (!(await this.repository.tieneReservaConfirmada(cliente.idcliente, dto.idsalida))) {
      throw CustomError.forbidden("Solo podés reseñar salidas en las que participaste con una reserva confirmada.");
    }

    // Precondición 3: la salida debe estar Finalizada
    if (salida.estado !== ESTADO_SALIDA.FINALIZADA) {
      throw CustomError.badRequest("Solo se pueden reseñar salidas finalizadas.");
    }

    // Regla 2 / flujo alternativo 1: una única reseña por salida
    const MENSAJE_DUPLICADA = "No es posible registrar más de una reseña por salida.";
    if (await this.repository.existeResenia(cliente.idcliente, dto.idsalida)) {
      throw CustomError.badRequest(MENSAJE_DUPLICADA);
    }

    const resenia = await this.repository.crear(cliente.idcliente, dto);
    if (!resenia) throw CustomError.badRequest(MENSAJE_DUPLICADA); // carrera entre dos pedidos simultáneos

    return resenia;
  }

  // CU-43: consulta del administrador (reseñas de los clientes)
  async consultarResenias(filtros: FiltrosReseniaDto) {
    const [resenias, resumen] = await Promise.all([
      this.repository.findConFiltros(filtros),
      this.repository.resumen(filtros),
    ]);

    return {
      resumen: {
        cantidad: resumen.cantidad,
        promedio: resumen.promedio === null ? null : redondear2(resumen.promedio),
      },
      resenias,
    };
  }

  private async obtenerCliente(idusuario: number) {
    const cliente = await this.repository.findClientePorUsuario(idusuario);
    if (!cliente) throw CustomError.forbidden("El usuario no tiene un perfil de cliente.");
    return cliente;
  }
}