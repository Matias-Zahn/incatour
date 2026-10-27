import { hoyUTC } from "../../../shared/fechas";
import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { ESTADO, SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { FiltrosCuentaGuiaDto } from "./cuenta-guia.dto";

// Salidas del guía cuyo recorrido no finalizó (CU-46, regla de negocio)
const ASIGNACIONES_PENDIENTES = {
  where: { salida: { estado: { in: SALIDAS_ACTIVAS } } },
  select: { idsalida: true },
} as const;

const INCLUDE_CUENTA = {
  usuario: { select: { idusuario: true, nombre: true, apellido: true, email: true, rol: true, estado: true, creadoEn: true } },
  personal: {
    select: {
      idpersonal: true,
      nombreCompleto: true,
      nroPasaporte: true,
      estado: true,
      asignaciones: ASIGNACIONES_PENDIENTES,
    },
  },
} as const;

export class CuentaGuiaRepository {
  // CU-44: solo los guías que ya tienen cuenta (idusuario no nulo)
  async findCuentas(f: FiltrosCuentaGuiaDto) {
    const hoy = hoyUTC();

    return db.guia.findMany({
      where: {
        idusuario: { not: null },
        usuario: {
          is: {
            ...(f.rol && { rol: f.rol }),
            ...(f.estado && { estado: f.estado }),
            ...(f.busqueda && {
              OR: [
                { nombre: { contains: f.busqueda, mode: "insensitive" } },
                { apellido: { contains: f.busqueda, mode: "insensitive" } },
                { email: { contains: f.busqueda, mode: "insensitive" } },
              ],
            }),
          },
        },
        // La habilitación se contrasta con hoy; las fechas nulas no entran en ninguno de los dos filtros
        ...(f.habilitacion === "VIGENTE" && { fechaHabilitacion: { gte: hoy } }),
        ...(f.habilitacion === "VENCIDA" && { fechaHabilitacion: { lt: hoy } }),
      },
      include: INCLUDE_CUENTA,
      orderBy: { personal: { nombreCompleto: "asc" } },
    });
  }

  async findCuenta(idusuario: number) {
    return db.guia.findUnique({ where: { idusuario }, include: INCLUDE_CUENTA });
  }

  async findPersonalGuia(idpersonal: number) {
    return db.personal.findUnique({
      where: { idpersonal },
      include: { guia: true },
    });
  }

  async checkEmailExists(email: string) {
    return db.usuario.findUnique({ where: { email } });
  }

  // CU-45: Crear cuenta de acceso para un guía ya registrado en el personal
  async crearCuentaGuia(
    idpersonal: number,
    nombre: string,
    apellido: string,
    email: string,
    contraseniaHasheada: string,
    nroHabilitacion?: string,
    fechaHabilitacion?: Date
  ) {
    return db.$transaction(async (tx) => {
      // CTA-08: con el legajo bloqueado, dos altas simultáneas para el mismo guía se serializan
      await tx.$queryRaw`SELECT 1 FROM public."Personal" WHERE idpersonal = ${idpersonal} FOR UPDATE`;
      const guiaExistente = await tx.guia.findUnique({ where: { idpersonal } });
      if (guiaExistente?.idusuario) {
        throw CustomError.badRequest("Este guía ya posee una cuenta de acceso registrada.");
      }

      const usuario = await tx.usuario.create({
        data: {
          nombre,
          apellido,
          email,
          contrasenia: contraseniaHasheada,
          rol: "GUIA",
          estado: ESTADO.ACTIVO,
        },
      });

      // Si el personal ya tiene fila en Guia, actualizamos su idusuario y habilitación si vino
      if (guiaExistente) {
        await tx.guia.update({
          where: { idpersonal },
          data: {
            idusuario: usuario.idusuario,
            ...(nroHabilitacion && { nroHabilitacion }),
            ...(fechaHabilitacion && { fechaHabilitacion }),
          },
        });
      } else {
        await tx.guia.create({
          data: {
            idpersonal,
            idusuario: usuario.idusuario,
            nroHabilitacion: nroHabilitacion ?? null,
            fechaHabilitacion: fechaHabilitacion ?? null,
          },
        });
      }

      return tx.guia.findUnique({
        where: { idusuario: usuario.idusuario },
        include: INCLUDE_CUENTA,
      });
    });
  }

  async consultarAsignacionesActivas(idpersonal: number) {
    return db.asignacionPersonal.findMany({
      where: {
        idpersonal,
        salida: { estado: { notIn: ["CANCELADA", "FINALIZADA"] } }
      },
      include: {
        salida: {
          select: {
            fechaFin: true,
            permisos: {
              where: { idpersonal },
              select: { estadoTramite: true }
            }
          }
        }
      }
    });
  }

  // Modificar cuenta de guía (por administrador)
  async modificarCuenta(
    idusuario: number,
    idpersonal: number,
    data: {
      nombre?: string | undefined;
      apellido?: string | undefined;
      email?: string | undefined;
      contraseniaHasheada?: string | undefined;
      nroHabilitacion?: string | undefined;
      fechaHabilitacion?: Date | undefined;
    }
  ) {
    return db.$transaction(async (tx) => {
      const updateUsuario: {
        nombre?: string;
        apellido?: string;
        email?: string;
        contrasenia?: string;
      } = {};

      if (data.nombre) updateUsuario.nombre = data.nombre;
      if (data.apellido) updateUsuario.apellido = data.apellido;
      if (data.email) updateUsuario.email = data.email;
      if (data.contraseniaHasheada) updateUsuario.contrasenia = data.contraseniaHasheada;

      if (Object.keys(updateUsuario).length > 0) {
        await tx.usuario.update({
          where: { idusuario },
          data: updateUsuario,
        });

        // Mantener sincronizado nombreCompleto en Personal si se actualizó nombre o apellido
        if (data.nombre || data.apellido) {
          const uActual = await tx.usuario.findUnique({ where: { idusuario } });
          if (uActual) {
            await tx.personal.update({
              where: { idpersonal },
              data: { nombreCompleto: `${uActual.nombre} ${uActual.apellido}` },
            });
          }
        }
      }

      const updateGuia: { nroHabilitacion?: string; fechaHabilitacion?: Date } = {};
      if (data.nroHabilitacion !== undefined) updateGuia.nroHabilitacion = data.nroHabilitacion;
      if (data.fechaHabilitacion !== undefined) updateGuia.fechaHabilitacion = data.fechaHabilitacion;

      if (Object.keys(updateGuia).length > 0) {
        await tx.guia.update({
          where: { idpersonal },
          data: updateGuia,
        });
      }

      return tx.guia.findUnique({
        where: { idusuario },
        include: INCLUDE_CUENTA,
      });
    });
  }

  /**
   * CU-46: la verificación de salidas pendientes y la baja ocurren en la misma transacción,
   * para que una asignación que entre en el medio no quede con el guía sin cuenta.
   * Devuelve { bloqueadoPor } con la cantidad de salidas pendientes, o { usuario } si se dio de baja.
   */
  async darDeBaja(idusuario: number, idpersonal: number) {
    return db.$transaction(async (tx) => {
      const pendientes = await tx.asignacionPersonal.count({
        where: { idpersonal, salida: { estado: { in: SALIDAS_ACTIVAS } } },
      });
      if (pendientes > 0) return { bloqueadoPor: pendientes } as const;

      // Baja LÓGICA: la fila y el historial de salidas se conservan
      const usuario = await tx.usuario.update({
        where: { idusuario },
        data: { estado: ESTADO.INACTIVO },
        select: { idusuario: true },
      });
      return { usuario } as const;
    });
  }
}
