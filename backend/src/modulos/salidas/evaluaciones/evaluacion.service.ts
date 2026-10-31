import { CustomError } from "../../../error/CustomError";
import { ESTADO_SALIDA } from "../../../shared/constantes";
import { EvaluarDto } from "./evaluacion.dto";
import { EvaluacionRepository, FiltrosEvaluacion } from "./evaluacion.repository";

type SalidaEvaluable = NonNullable<Awaited<ReturnType<EvaluacionRepository["buscarSalida"]>>>;

export class EvaluacionService {
  private repository = new EvaluacionRepository();

  // CU-42: a quién se puede evaluar en la salida y qué ya se evaluó
  async consultarEvaluables(idsalida: number) {
    const salida = await this.salidaFinalizada(idsalida);
    const proveedores = proveedoresDe(salida);
    return {
      salida: { idsalida, nroSalida: salida.nroSalida },
      personal: salida.personalAsignado.map(({ personal: p }) => ({
        ...p,
        evaluacion: salida.evaluacionesPersonal.find((e) => e.idpersonal === p.idpersonal) ?? null,
      })),
      proveedores: [...proveedores.values()].map((p) => ({
        ...p,
        evaluacion: salida.evaluacionesProveedores.find((e) => e.idproveedor === p.idproveedor) ?? null,
      })),
    };
  }

  // CU-42: cuántas evaluaciones le faltan a cada salida finalizada, para saber dónde hay trabajo sin abrirlas una por una
  async pendientes() {
    const salidas = await this.repository.salidasFinalizadas();
    return salidas.map((salida) => {
      const personal = salida.personalAsignado.filter((a) => !salida.evaluacionesPersonal.some((e) => e.idpersonal === a.idpersonal));
      const proveedores = [...proveedoresDe(salida).keys()].filter((id) => !salida.evaluacionesProveedores.some((e) => e.idproveedor === id));
      return { idsalida: salida.idsalida, pendientes: personal.length + proveedores.length };
    });
  }

  // CU-42: evaluar a una persona o a un proveedor por su desempeño en la salida
  async evaluar(idsalida: number, dto: EvaluarDto) {
    const salida = await this.salidaFinalizada(idsalida);

    if (dto.tipo === "PERSONAL") {
      if (!salida.personalAsignado.some((a) => a.idpersonal === dto.id)) {
        throw CustomError.badRequest("Esa persona no participó de la salida");
      }
      if (salida.evaluacionesPersonal.some((e) => e.idpersonal === dto.id)) {
        throw CustomError.badRequest("Esa persona ya fue evaluada en esta salida");
      }
      return this.repository.evaluarPersonal(idsalida, dto.id, dto.puntaje, dto.comentario);
    }

    if (!proveedoresDe(salida).has(dto.id)) {
      throw CustomError.badRequest("Ese proveedor no dio ningún servicio en la salida");
    }
    if (salida.evaluacionesProveedores.some((e) => e.idproveedor === dto.id)) {
      throw CustomError.badRequest("Ese proveedor ya fue evaluado en esta salida");
    }
    return this.repository.evaluarProveedor(idsalida, dto.id, dto.puntaje, dto.comentario);
  }

  // CU-43: lo usa la consulta de reseñas para sumar las evaluaciones
  async listar(filtros: FiltrosEvaluacion) {
    return this.repository.listar(filtros);
  }

  // Solo se evalúa el desempeño de una salida que ya terminó
  private async salidaFinalizada(idsalida: number) {
    const salida = await this.repository.buscarSalida(idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe");
    if (salida.estado !== ESTADO_SALIDA.FINALIZADA) {
      throw CustomError.badRequest("Solo se puede evaluar en una salida finalizada");
    }
    return salida;
  }
}

// Proveedores sin repetir, a partir de los servicios y el equipamiento de la salida
const proveedoresDe = (salida: SalidaEvaluable) =>
  new Map(
    [...salida.servicios, ...salida.equipamientos].map(({ servicio: { proveedor } }) => [proveedor.idproveedor, proveedor])
  );
