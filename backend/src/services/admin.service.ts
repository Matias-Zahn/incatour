import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { RegistroAdminDto } from '../dtos/registro-admin.dto';

const prisma = new PrismaClient();

export class AdminService {
  async registrarAdmin(datos: RegistroAdminDto) {
    // 1. Verificar si el correo ya existe en todo el sistema
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: datos.email }
    });

    if (usuarioExistente) {
      throw new Error('El correo electrónico ya está registrado.');
    }

    // 2. Encriptar contraseña
    const saltRounds = 10;
    const contraseniaHasheada = await bcrypt.hash(datos.contrasenia, saltRounds);

    // 3. Crear Usuario y Administrador en una sola transacción
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email: datos.email,
        contrasenia: contraseniaHasheada,
        nombre:datos.nombre,
        apellido:datos.apellido,
        rol: 'ADMINISTRADOR', // Asegúrate de que coincida con tu Enum de Prisma
        estado: 'ACTIVO',
        }
      });

    // 4. Ocultar la contraseña antes de responder
    const { contrasenia, ...usuarioSinPass } = nuevoUsuario;
    return usuarioSinPass;
  }
}