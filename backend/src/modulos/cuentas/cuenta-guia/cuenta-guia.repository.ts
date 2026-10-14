import { db } from "../../../config/postgresDatabase";
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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

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