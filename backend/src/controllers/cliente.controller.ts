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

  

}