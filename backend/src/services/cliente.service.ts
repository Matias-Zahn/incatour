import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegistroClienteDto } from '../dtos/registro-cliente.dto';

const prisma = new PrismaClient();

export class ClienteService {
  async registrarCliente(datos: RegistroClienteDto) {
    console.log("--> PASO 1: Entró al servicio. Buscando si el email existe...");
    
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: datos.email }
    });

    console.log("--> PASO 2: Búsqueda finalizada. ¿Existe?", !!usuarioExistente);

    if (usuarioExistente) {
      throw new Error('El correo electrónico ya está registrado.');
    }

    console.log("--> PASO 3: Encriptando contraseña con bcrypt...");
    const saltRounds = 10;
    const contraseniaHasheada = await bcrypt.hash(datos.contrasenia, saltRounds);

    console.log("--> PASO 4: Contraseña encriptada. Generando Nro Cliente...");
    const nroCliente = `CLI-${Date.now()}`;

    console.log("--> PASO 5: Guardando en PostgreSQL con Prisma...");
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
      include: {
        cliente: true
      }
    });

    console.log("--> PASO 6: Guardado exitoso. Retornando datos...");
    const { contrasenia, ...usuarioSinPass } = nuevoUsuario;
    return usuarioSinPass;
  }
}