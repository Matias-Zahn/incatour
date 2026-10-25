import { hoyUTC } from "../../../shared/fechas";
import { db } from "../../../config/postgresDatabase";
import { ESTADO, SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { ConsultarPersonalDto, ModificarPersonalDto, ROL_GUIA, ROL_PORTEADOR } from "./personal.dto";

export interface DatosPersonal {
  nombre: string;
  apellido: string;
  nroPasaporte: string;
  nacionalidad: string;
  fechaVencimientoPasaporte: Date;
}

export interface DatosGuia extends DatosPersonal {
  email?: string | undefined; // sin email, el guía queda sin cuenta (CTA-03)
  nroHabilitacion: string;
  fechaHabilitacion: Date;
}

export class PersonalRepository {
  async checkEmailExists(email: string) {
    return db.usuario.findUnique({ where: { email } });
  }

  async checkPasaporteExists(nroPasaporte: string) {
    return db.personal.findUnique({ where: { nroPasaporte } });
  }

  // Guía = Usuario (acceso) + Personal (legajo) + Guia (habilitación), todo en una transacción
  // Sin cuenta (email y contraseña ausentes) solo se crean Personal y Guia (CTA-03)
  async crearGuia(data: DatosGuia, contraseniaHasheada?: string) {
    return db.$transaction(async (tx) => {
      const usuario =
        data.email && contraseniaHasheada
          ? await tx.usuario.create({
              data: {
                nombre: data.nombre,
                apellido: data.apellido,
                email: data.email,
                contrasenia: contraseniaHasheada,
                rol: "GUIA", // Rol de sistema
                estado: "ACTIVO",
              },
            })
          : null;

      // El usuario ya NO se enlaza desde Personal: se enlaza desde Guia
      const personal = await tx.personal.create({
        data: {
          nombreCompleto: `${data.nombre} ${data.apellido}`,
          nroPasaporte: data.nroPasaporte,
          nacionalidad: data.nacionalidad,
          fechaVencimientoPasaporte: data.fechaVencimientoPasaporte,
          rol: ROL_GUIA,
          estado: "ACTIVO",
          guia: {
            create: {
              idusuario: usuario?.idusuario ?? null,
              nroHabilitacion: data.nroHabilitacion,
              fechaHabilitacion: data.fechaHabilitacion,
            },
          },
        },
        include: { guia: true },
      });

      return { personal, usuario };
    });
  }

  // Porteador = solo Personal. No tiene cuenta de acceso ni fila en Guia.
  async crearPorteador(data: DatosPersonal) {
    return db.personal.create({
      data: {
        nombreCompleto: `${data.nombre} ${data.apellido}`,
        nroPasaporte: data.nroPasaporte,
        nacionalidad: data.nacionalidad,
        fechaVencimientoPasaporte: data.fechaVencimientoPasaporte,
        rol: ROL_PORTEADOR,
        estado: "ACTIVO",
      },
    });
  }

  // CU-22: la habilitación es del guía, así que filtrar por vigencia deja solo guías
  async buscar(dto: ConsultarPersonalDto) {
    const hoy = hoyUTC();
    return db.personal.findMany({
      where: {
        ...(dto.rol && { rol: dto.rol }),
        ...(dto.estado && { estado: dto.estado }),
        ...(dto.habilitacionVigente !== undefined && {
          guia: { fechaHabilitacion: dto.habilitacionVigente ? { gte: hoy } : { lt: hoy } },
        }),
      },
      include: { guia: { select: { nroHabilitacion: true, fechaHabilitacion: true } } },
      orderBy: { nombreCompleto: "asc" },
    });
  }

  async buscarPorId(idpersonal: number) {
    return db.personal.findUnique({ where: { idpersonal }, include: { guia: true } });
  }

  // CU-24: Personal y, si corresponde, Guia en una sola operación
  async modificar(
    idpersonal: number,
    dto: ModificarPersonalDto,
    usuario?: { idusuario: number; nombre: string; apellido: string }
  ) {
    return db.$transaction(async (tx) => {
      const personal = await tx.personal.update({
        where: { idpersonal },
        data: {
          ...(dto.nombreCompleto && { nombreCompleto: dto.nombreCompleto }),
          ...(dto.nroPasaporte && { nroPasaporte: dto.nroPasaporte }),
          ...(dto.nacionalidad && { nacionalidad: dto.nacionalidad }),
          ...(dto.fechaVencimientoPasaporte && { fechaVencimientoPasaporte: dto.fechaVencimientoPasaporte }),
          ...(dto.modificaHabilitacion && {
            guia: {
              update: {
                ...(dto.nroHabilitacion && { nroHabilitacion: dto.nroHabilitacion }),
                ...(dto.fechaHabilitacion && { fechaHabilitacion: dto.fechaHabilitacion }),
              },
            },
          }),
        },
        include: { guia: { select: { nroHabilitacion: true, fechaHabilitacion: true } } },
      });
      if (usuario) {
        await tx.usuario.update({
          where: { idusuario: usuario.idusuario },
          data: { nombre: usuario.nombre, apellido: usuario.apellido },
        });
      }
      return personal;
    });
  }

  /**
   * CU-25: el chequeo de salidas sin finalizar y la baja van en la misma transacción
   * (mismo patrón que la baja de cuenta del CU-46). Si es guía, también se desactiva su cuenta.
   */
  async darDeBaja(idpersonal: number, idusuario: number | null) {
    return db.$transaction(async (tx) => {
      const pendientes = await tx.asignacionPersonal.count({
        where: { idpersonal, salida: { estado: { in: SALIDAS_ACTIVAS } } },
      });
      if (pendientes > 0) return { bloqueadoPor: pendientes } as const;

      const personal = await tx.personal.update({
        where: { idpersonal },
        data: { estado: ESTADO.INACTIVO },
      });
      if (idusuario) {
        await tx.usuario.update({ where: { idusuario }, data: { estado: ESTADO.INACTIVO } });
      }
      return { personal } as const;
    });
  }

  // Para los futuros endpoints del guía (CU-48, CU-49, CU-50):
  // el token trae idusuario, y antes se llegaba al legajo por personal.idusuario.
  // Ahora el camino es Usuario -> Guia -> Personal.
  async obtenerIdPersonalPorUsuario(idusuario: number) {
    const guia = await db.guia.findUnique({
      where: { idusuario },
      select: { idpersonal: true },
    });
    return guia?.idpersonal ?? null;
  }
}
