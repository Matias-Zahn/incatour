import { Request, Response } from 'express';
import { ClienteService } from '../services/cliente.service';

const clienteService = new ClienteService();

export class ClienteController {
  
  async registrar(req: Request, res: Response) {
    console.log("¡La petición llegó al controlador!", req.body);
    try {
      const datos = req.body;
      
      // Aquí podrías agregar validaciones extra del DTO (ej. con Zod o Joi)
      if (!datos.email || !datos.contrasenia || !datos.nombre || !datos.apellido) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
      }

      if (datos.contrasenia.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      }

      if (datos.nombre.trim().length > 64 ){
        return res.status(400).json({error: 'El nombre es demasiado largo.' });
      }

      if (datos.apellido.trim().length > 64 ){
        return res.status(400).json({error: 'El apellido es demasiado largo.' });
      }

      const resultado = await clienteService.registrarCliente(datos);
      
      return res.status(201).json({
        mensaje: 'Cliente registrado con éxito',
        data: resultado
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message || 'Error al registrar el cliente'
      });
    }
  }

  darDeBaja = async (req: Request, res: Response) => {
    try {
      // Capturamos el ID de la URL (ej: /api/clientes/baja/5)
      const idUsuario = parseInt(req.params.id as string);

      // Validamos que el ID sea un número
      if (isNaN(idUsuario)) {
        return res.status(400).json({ error: 'El ID proporcionado no es válido.' });
      }

      const resultado = await clienteService.darDeBajaCliente(idUsuario);

      return res.status(200).json({
        mensaje: 'Cuenta de cliente dada de baja exitosamente',
        data: resultado
      });
    } catch (error: any) {
      if (error.message === 'Cliente no encontrado.') {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({
        error: 'Error interno al intentar dar de baja la cuenta'
      });
    }
  }

}