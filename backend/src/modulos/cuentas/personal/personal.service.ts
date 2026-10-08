import bcrypt from "bcrypt";
import { CustomError } from "../../../error/CustomError";
import { PersonalRepository } from "./personal.repository";
import { CrearPersonalDto } from "./personal.dto";

export class PersonalService {
  private repository = new PersonalRepository();

  async crearPersonal(data: CrearPersonalDto) {
    // 1. Validar que el email no esté en uso
    const existeEmail = await this.repository.checkEmailExists(data.email);
    if (existeEmail) throw CustomError.badRequest("El email ya está registrado en el sistema");

    // 2. Validar unicidad del pasaporte
    const existePasaporte = await this.repository.checkPasaporteExists(data.nroPasaporte);
    if (existePasaporte) throw CustomError.badRequest("Este número de pasaporte ya está registrado en la base de datos");

    // 3. Regla de Negocio: El pasaporte no puede estar vencido al momento de registrarlo
    const hoy = new Date();
    if (data.fechaVencimientoPasaporte < hoy) {
      throw CustomError.badRequest("No se puede registrar personal con un pasaporte vencido");
    }

    // 4. Hasheo de Contraseña
    const salt = await bcrypt.genSalt(10);
    const contraseniaHasheada = await bcrypt.hash(data.contrasenia, salt);

    // 5. Inserción Transaccional
    const resultado = await this.repository.createWithUser(data, contraseniaHasheada);
    
    // 6. Limpieza de datos confidenciales antes de responder a la API
    const { contrasenia, ...usuarioSeguro } = resultado.usuario;
    return { 
      mensaje: "Personal registrado exitosamente",
      perfilOperativo: resultado.personal, 
      credencialesAcceso: usuarioSeguro 
    };
  }
}
