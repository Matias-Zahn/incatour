import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { CustomError } from "../../error/CustomError";
import { AuthRepository } from "./auth.repository";
import { LoginDto } from "./auth.dto";
import { envs } from "../../config/envs";

export class AuthService {
  private repository = new AuthRepository();

  async login(dto: LoginDto) {
    // 1. Buscar usuario por email
    const usuario = await this.repository.buscarPorEmail(dto.email);
    if (!usuario) {
      throw CustomError.unauthorized("Credenciales inválidas");
    }

    // 2. SEG-05: Comparar contraseñas ANTES de evaluar estado para evitar enumeración y filtración de cuentas
    const coincide = await bcrypt.compare(dto.contrasenia, usuario.contrasenia);
    if (!coincide) {
      throw CustomError.unauthorized("Credenciales inválidas");
    }

    // 3. SEG-02 & SEG-05: Si las credenciales coinciden pero la cuenta de usuario o cliente está dada de baja
    if (usuario.estado === "INACTIVO" || usuario.cliente?.estado === "INACTIVO") {
      throw CustomError.unauthorized("Su cuenta ha sido desactivada");
    }

    // 4. Generar Payload del JWT (datos no sensibles para el frontend)
    const payload = {
      idusuario: usuario.idusuario,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
    };

    // 5. Firmar el Token
    const token = jwt.sign(payload, envs.JWT_SEED, { expiresIn: "8h" });

    return {
      usuario: payload,
      token,
    };
  }
}
