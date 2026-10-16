import { db } from "../../../config/postgresDatabase";
import { ESTADO_PERMISO } from "../../../shared/constantes";
import { PermisoEmitido } from "../../../integraciones/autoridad/autoridad.interface";

export class ReemplazoRepository {
  // CU-38 paso 4: la salida con su logística, su personal y el permiso de cada uno
  async buscarSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        personalAsignado: { include: { personal: { include: { guia: true } } } },
        permisos: true,
        servicios: { include: { servicio: { select: { nombreServicio: true } } } },
        equipamientos: { include: { servicio: { select: { nombreServicio: true } } } },
      },
    });
  }

  async buscarPersonal(idpersonal: number) {
    return db.personal.findUnique({ where: { idpersonal }, include: { guia: true } });
  }

  // Si la autoridad dio de baja el permiso pero falló la emisión del nuevo, queda registrado para el reintento
  async marcarPermisoDadoDeBaja(idpermisopersonal: number) {
    return db.permisoPersonal.update({
      where: { idpermisopersonal },
      data: { estadoTramite: ESTADO_PERMISO.DADO_DE_BAJA },
    });
  }

  /**
   * CU-38 pasos 14, 15, 18 y 20, en una transacción: desvincular al original, asignar al reemplazante,
   * dejar el permiso viejo dado de baja, registrar el nuevo y auditar el cambio con su motivo.
   */
  async reemplazar(p: {
    idsalida: number;
    idoriginal: number;
    idreemplazante: number;
    motivo: string;
    usuario: string;
    idpermisoAnterior: number | undefined;
    permisoNuevo: PermisoEmitido | undefined;
  }) {
    return db.$transaction(async (tx) => {
      await tx.asignacionPersonal.delete({
        where: { idsalida_idpersonal: { idsalida: p.idsalida, idpersonal: p.idoriginal } },
      });
      await tx.asignacionPersonal.create({ data: { idsalida: p.idsalida, idpersonal: p.idreemplazante } });

      if (p.idpermisoAnterior) {
        await tx.permisoPersonal.update({
          where: { idpermisopersonal: p.idpermisoAnterior },
          data: { estadoTramite: ESTADO_PERMISO.DADO_DE_BAJA },
        });
      }
      const nuevo = p.permisoNuevo
        ? await tx.permisoPersonal.create({
            data: {
              idsalida: p.idsalida,
              idpersonal: p.idreemplazante,
              nroPermiso: p.permisoNuevo.nroPermiso,
              fechaEmision: p.permisoNuevo.fechaEmision,
              estadoTramite: ESTADO_PERMISO.EMITIDO,
            },
          })
        : null;

      await tx.registroAuditoria.create({
        data: {
          idsalida: p.idsalida,
          usuario: p.usuario,
          motivo: p.motivo,
          cambios: {
            accion: "REEMPLAZAR_PERSONAL",
            sale: p.idoriginal,
            entra: p.idreemplazante,
            permisoNuevo: p.permisoNuevo?.nroPermiso ?? null,
          },
        },
      });

      return nuevo;
    });
  }
}
