import { CustomError } from "../../../error/CustomError";
import { ESTADO_PERMISO, SALIDAS_NO_INICIADAS } from "../../../shared/constantes";
import { PermisoEmitido } from "../../../integraciones/autoridad/autoridad.interface";
import { ROL_GUIA } from "../../cuentas/personal/personal.dto";
import { obtenerAutoridad } from "../autoridad.wiring";
import { AsignacionRepository } from "../asignacion/asignacion.repository";
import { habilitacionVigente } from "../asignacion/asignacion.service";
import { ConfirmarReemplazoDto } from "./reemplazo.dto";
import { ReemplazoRepository } from "./reemplazo.repository";

type SalidaConPersonal = NonNullable<Awaited<ReturnType<ReemplazoRepository["buscarSalida"]>>>;

export class ReemplazoService {
  private repository = new ReemplazoRepository();
  private asignacion = new AsignacionRepository();

  // CU-38 paso 4: logística y personal asignado, con el permiso de cada uno
  async consultarPersonalSalida(idsalida: number) {
    const salida = await this.salidaNoIniciada(idsalida);
    return {
      salida: { idsalida, nroSalida: salida.nroSalida, fechaInicio: salida.fechaInicio, fechaFin: salida.fechaFin, estado: salida.estado },
      personal: salida.personalAsignado.map(({ personal }) => ({
        idpersonal: personal.idpersonal,
        nombreCompleto: personal.nombreCompleto,
        rol: personal.rol,
        permiso: permisoVigente(salida, personal.idpersonal)?.nroPermiso ?? null,
      })),
      servicios: salida.servicios.map((s) => ({ tipo: s.tipo, nombreServicio: s.servicio.nombreServicio })),
      equipamiento: salida.equipamientos.map((e) => ({ nombreServicio: e.servicio.nombreServicio, cantidad: e.cantidad })),
    };
  }

  // CU-38 paso 8: personal del mismo rol, libre en esas fechas y, si es guía, con la habilitación vigente
  async consultarReemplazantesDisponibles(idsalida: number, idoriginal: number) {
    const salida = await this.salidaNoIniciada(idsalida);
    const original = this.asignado(salida, idoriginal);
    const libres = await this.asignacion.personalLibre(salida);
    return libres
      .filter((p) => p.rol === original.rol && !salida.personalAsignado.some((a) => a.idpersonal === p.idpersonal))
      .filter((p) => p.rol !== ROL_GUIA || habilitacionVigente(p.guia, salida.fechaFin))
      .map((p) => ({ idpersonal: p.idpersonal, nombreCompleto: p.nombreCompleto, rol: p.rol }));
  }

  // CU-38 pasos 10 a 21: confirmarReemplazo
  async confirmarReemplazo(idsalida: number, dto: ConfirmarReemplazoDto, usuario: string) {
    const salida = await this.salidaNoIniciada(idsalida);
    const original = this.asignado(salida, dto.idoriginal);

    // Paso 10 y FA1: el reemplazante tiene que estar libre, ser del mismo rol y estar habilitado
    const reemplazante = await this.repository.buscarPersonal(dto.idreemplazante);
    if (!reemplazante) throw CustomError.notFound("El reemplazante no existe");
    if (reemplazante.rol !== original.rol) {
      throw CustomError.badRequest(`El reemplazante tiene que ser ${original.rol}, igual que ${original.nombreCompleto}`);
    }
    if (salida.personalAsignado.some((a) => a.idpersonal === reemplazante.idpersonal)) {
      throw CustomError.badRequest(`${reemplazante.nombreCompleto} ya está asignado a esta salida`);
    }
    const libre = await this.asignacion.personalLibre(salida, [reemplazante.idpersonal]);
    if (libre.length === 0) {
      throw CustomError.badRequest(`${reemplazante.nombreCompleto} no está disponible: está dado de baja o asignado a otra salida en esas fechas`);
    }
    if (reemplazante.rol === ROL_GUIA && !habilitacionVigente(reemplazante.guia, salida.fechaFin)) {
      throw CustomError.badRequest(`${reemplazante.nombreCompleto} no tiene la habilitación vigente para las fechas de la salida`);
    }
    if (reemplazante.fechaVencimientoPasaporte < salida.fechaFin) {
      throw CustomError.badRequest(`El pasaporte de ${reemplazante.nombreCompleto} vence antes del fin del recorrido`);
    }

    // Pasos 16 a 19: si el original tenía permiso, se da de baja y se emite uno nuevo sobre el mismo lugar.
    // Si estaba Rechazado (RF-47) no hay nada que dar de baja: el reemplazante pide su permiso en el lugar que quedó reservado
    // El más reciente: si la persona ya salió y volvió a esta salida, tiene permisos viejos dados de baja
    const anterior = salida.permisos.findLast(
      (p) => p.idpersonal === original.idpersonal && p.estadoTramite !== ESTADO_PERMISO.PERDIDO
    );
    const autoridad = obtenerAutoridad();
    let permisoNuevo: PermisoEmitido | undefined;

    if (anterior) {
      if (anterior.estadoTramite === ESTADO_PERMISO.EMITIDO) {
        try {
          await autoridad.darDeBajaPermiso(salida.idbloqueo!, anterior.nroPermiso!);
        } catch {
          throw CustomError.serviceUnavailable("No fue posible dar de baja el permiso ante la autoridad. Reintentá más tarde");
        }
        // Queda registrado ya, por si la emisión del nuevo falla: el reintento salta la baja
        await this.repository.marcarPermisoDadoDeBaja(anterior.idpermisopersonal);
      }
      const titular = {
        tipo: "PERSONAL" as const,
        id: reemplazante.idpersonal,
        nombreCompleto: reemplazante.nombreCompleto,
        nacionalidad: reemplazante.nacionalidad,
        nroPasaporte: reemplazante.nroPasaporte,
        fechaVencimientoPasaporte: reemplazante.fechaVencimientoPasaporte,
      };
      try {
        if (anterior.nroPermiso) {
          permisoNuevo = await autoridad.solicitarPermisoIndividual(salida.idbloqueo!, titular, anterior.nroPermiso);
        } else {
          const { emitidos, rechazados } = await autoridad.solicitarEmisionNominal(salida.idbloqueo!, [titular]);
          if (rechazados.length) throw CustomError.badRequest(`La autoridad rechazó el permiso de ${reemplazante.nombreCompleto} (${rechazados[0]?.motivo})`);
          permisoNuevo = emitidos[0];
        }
      } catch (error) {
        if (error instanceof CustomError) throw error;
        throw CustomError.serviceUnavailable(
          anterior.nroPermiso
            ? `El permiso de ${original.nombreCompleto} ya se dio de baja, pero no se pudo emitir el del reemplazante. Reintentá el reemplazo`
            : "No fue posible emitir el permiso del reemplazante ante la autoridad. Reintentá más tarde"
        );
      }
    }

    try {
      const nuevo = await this.repository.reemplazar({
        idsalida,
        idoriginal: original.idpersonal,
        idreemplazante: reemplazante.idpersonal,
        fechaInicio: salida.fechaInicio,
        fechaFin: salida.fechaFin,
        motivo: dto.motivo,
        usuario,
        idpermisoAnterior: anterior?.idpermisopersonal,
        permisoNuevo,
      });
      return {
        sale: { idpersonal: original.idpersonal, nombreCompleto: original.nombreCompleto },
        entra: { idpersonal: reemplazante.idpersonal, nombreCompleto: reemplazante.nombreCompleto },
        permisoDadoDeBaja: anterior?.nroPermiso ?? null,
        permisoNuevo: nuevo?.nroPermiso ?? null,
      };
    } catch (error) {
      // Compensación: la base falló después de emitir, así que el permiso nuevo se da de baja
      if (permisoNuevo) {
        // ponytail: si la base sigue caída el update falla y solo queda el log; reparar a mano
        await autoridad
          .darDeBajaPermiso(salida.idbloqueo!, permisoNuevo.nroPermiso)
          // El lugar ante la autoridad ahora lo ocupa el nuevo (dado de baja): el reintento lo reemplaza a ese
          .then(() => anterior && this.repository.marcarPermisoDadoDeBaja(anterior.idpermisopersonal, permisoNuevo!.nroPermiso))
          .catch((e) => console.error(`Compensación fallida con el permiso ${permisoNuevo!.nroPermiso}: revisar su baja y el registro`, e));
      }
      throw error;
    }
  }

  // FA2: no se reemplaza personal en una salida que ya empezó (o que no existe)
  private async salidaNoIniciada(idsalida: number) {
    const salida = await this.repository.buscarSalida(idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe");
    if (!SALIDAS_NO_INICIADAS.includes(salida.estado) || salida.fechaInicio <= new Date()) {
      throw CustomError.badRequest("No es posible reemplazar personal en una salida que ya inició o no está activa");
    }
    return salida;
  }

  private asignado(salida: SalidaConPersonal, idpersonal: number) {
    const asignacion = salida.personalAsignado.find((a) => a.idpersonal === idpersonal);
    if (!asignacion) throw CustomError.badRequest("Esa persona no está asignada a la salida");
    return asignacion.personal;
  }
}

const permisoVigente = (salida: SalidaConPersonal, idpersonal: number) =>
  salida.permisos.find((p) => p.idpersonal === idpersonal && p.estadoTramite === ESTADO_PERMISO.EMITIDO);
