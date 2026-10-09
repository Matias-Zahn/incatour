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

    // 2. Verificar estado activo
    if (usuario.estado === "INACTIVO") {
      throw CustomError.unauthorized("Su cuenta ha sido desactivada");
    }

    // 3. Comparar contraseñas
    const coincide = await bcrypt.compare(dto.contrasenia, usuario.contrasenia);
    if (!coincide) {
      throw CustomError.unauthorized("Credenciales inválidas");
    }

    // 4. Generar Payload del JWT (datos no sensibles para el frontend)
    const payload = {
      idusuario: usuario.idusuario,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };

    // 5. Firmar el Token
    const token = jwt.sign(payload, envs.JWT_SEED, { expiresIn: "8h" });

    return {
      usuario: payload,
      token
    };
  }
}
