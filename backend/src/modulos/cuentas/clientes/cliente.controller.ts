import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";
import { ClienteService } from "./cliente.service";

const service = new ClienteService();

export class ClienteController {
  consultarClientes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultados = await service.consultarClientes();
      return res.status(200).json({ data: resultados });
    } catch (error) {
      next(error);
    }
  };

  consultarClientePorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID debe ser un número válido");

      const resultado = await service.consultarClientePorId(id);

      // SEG-01: Si el usuario autenticado es CLIENTE, solo puede ver sus propios datos
      const usuarioAutenticado = req.usuarioAutenticado;
      if (usuarioAutenticado && usuarioAutenticado.rol === "CLIENTE" && resultado.idusuario !== usuarioAutenticado.idusuario) {
        throw CustomError.forbidden("No tiene permisos para acceder a los datos de otro cliente.");
      }

      return res.status(200).json({ data: resultado });
    } catch (error) {
      next(error);
    }
  };

  crearCliente = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [error, dto] = CrearClienteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.crearCliente(dto!);
      return res.status(201).json({ mensaje: "Cliente creado con éxito", data: resultado });
    } catch (error) {
      next(error);
    }
  };

  modificarCliente = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID debe ser un número válido");

      const cliente = await service.consultarClientePorId(id);

      // SEG-01: Si el usuario autenticado es CLIENTE, solo puede modificar sus propios datos
      const usuarioAutenticado = req.usuarioAutenticado;
      if (usuarioAutenticado && usuarioAutenticado.rol === "CLIENTE" && cliente.idusuario !== usuarioAutenticado.idusuario) {
        throw CustomError.forbidden("No tiene permisos para modificar los datos de otro cliente.");
      }

      const [error, dto] = ModificarClienteDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      const resultado = await service.modificarCliente(id, dto!);
      return res.status(200).json({ mensaje: "Cliente modificado", data: resultado });
    } catch (error) {
      next(error);
    }
  };

  darDeBajaCliente = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID debe ser un número válido");

      const cliente = await service.consultarClientePorId(id);

      // CTA-02 & SEG-01: Si el usuario autenticado es CLIENTE, solo puede dar de baja su propia cuenta
      const usuarioAutenticado = req.usuarioAutenticado;
      if (usuarioAutenticado && usuarioAutenticado.rol === "CLIENTE" && cliente.idusuario !== usuarioAutenticado.idusuario) {
        throw CustomError.forbidden("No tiene permisos para dar de baja la cuenta de otro cliente.");
      }

      const resultado = await service.darDeBajaCliente(id);
      return res.status(200).json({ mensaje: "Cliente dado de baja", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
