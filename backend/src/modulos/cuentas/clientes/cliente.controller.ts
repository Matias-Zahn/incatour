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

      const resultado = await service.darDeBajaCliente(id);
      return res.status(200).json({ mensaje: "Cliente dado de baja", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
