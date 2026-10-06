import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegistroClienteDto } from './dtos/registro-cliente.dto';

const prisma = new PrismaClient();

export class ClienteService {
  async registrarCliente(datos: RegistroClienteDto) {
    // 1. Verificar si el email ya existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: datos.email }
    });

    if (usuarioExistente) {
      throw new Error('El correo electrónico ya está registrado.');
    }

    // 2. Encriptar la contraseña
    const saltRounds = 10;
    const contraseniaHasheada = await bcrypt.hash(datos.contrasenia, saltRounds);

    // 3. Generar un número de cliente (lógica de negocio)
    const nroCliente = `CLI-${Date.now()}`;

    // 4. Crear el Usuario y el Cliente en una sola transacción
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email: datos.email,
        contrasenia: contraseniaHasheada,
        rol: 'CLIENTE',
        estado: 'ACTIVO',
        cliente: {
          create: {
            nombre: datos.nombre,
            apellido: datos.apellido,
            nroCliente: nroCliente,
            estado: 'ACTIVO'
          }
        }
      },
      // Incluimos el cliente en la respuesta para confirmar la creación
      include: {
        cliente: true
      }
    });

    // Retornamos el usuario creado sin la contraseña por seguridad
    const { contrasenia, ...usuarioSinPass } = nuevoUsuario;
    return usuarioSinPass;
  }
}