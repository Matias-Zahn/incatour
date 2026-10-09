import { db } from "../../../config/postgresDatabase";
import { CrearPersonalDto } from "./personal.dto";

export class PersonalRepository {
  async checkEmailExists(email: string) {
    return db.usuario.findUnique({ where: { email } });
  }

  async checkPasaporteExists(nroPasaporte: string) {
    return db.personal.findUnique({ where: { nroPasaporte } });
  }

  async createWithUser(data: CrearPersonalDto, contraseniaHasheada: string) {
    return db.$transaction(async (tx) => {
      // 1. Crear Credenciales de Acceso
      const usuario = await tx.usuario.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          contrasenia: contraseniaHasheada,
          rol: "GUIA", // Rol de sistema
          estado: "ACTIVO"
        }
      });

      // 2. Crear Legajo Operativo
      const personal = await tx.personal.create({
        data: {
          nombreCompleto: `${data.nombre} ${data.apellido}`,
          nroPasaporte: data.nroPasaporte,
          nacionalidad: data.nacionalidad,
          fechaVencimientoPasaporte: data.fechaVencimientoPasaporte,
          rol: data.rolOperativo,
          estado: "ACTIVO"
        }
      });

      // 3. La cuenta se vincula a través de Guia (normalización final)
      if (data.rolOperativo === "Guía") {
        await tx.guia.create({
          data: { idpersonal: personal.idpersonal, idusuario: usuario.idusuario }
        });
      }

      return { personal, usuario };
    });
  }
}
