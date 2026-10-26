import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../../error/CustomError";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";
import { ClienteService } from "./cliente.service";

const service = new ClienteService();

// CTA-11: se autoriza antes de buscar, así un CLIENTE recibe 403 por cualquier id ajeno, exista o no
async function verificarPropietario(req: Request, idcliente: number, mensaje: string) {
  const usuario = req.usuarioAutenticado;
  if (usuario?.rol !== "CLIENTE") return;
  const propio = await service.consultarMiPerfil(usuario.idusuario);
  if (propio.idcliente !== idcliente) throw CustomError.forbidden(mensaje);
}

export class ClienteController {
  consultarClientes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultados = await service.consultarClientes();
      return res.status(200).json({ data: resultados });
    } catch (error) {
      next(error);
    }
  };

  consultarMiPerfil = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = await service.consultarMiPerfil(req.usuarioAutenticado!.idusuario);
      return res.status(200).json({ data: resultado });
    } catch (error) {
      next(error);
    }
  };

  consultarClientePorId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) throw CustomError.badRequest("El ID debe ser un número válido");

      // SEG-01: Si el usuario autenticado es CLIENTE, solo puede ver sus propios datos
      await verificarPropietario(req, id, "No tiene permisos para acceder a los datos de otro cliente.");
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

      // SEG-01: Si el usuario autenticado es CLIENTE, solo puede modificar sus propios datos
      await verificarPropietario(req, id, "No tiene permisos para modificar los datos de otro cliente.");

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

      // CTA-02 & SEG-01: Si el usuario autenticado es CLIENTE, solo puede dar de baja su propia cuenta
      await verificarPropietario(req, id, "No tiene permisos para dar de baja la cuenta de otro cliente.");

      const resultado = await service.darDeBajaCliente(id);
      return res.status(200).json({ mensaje: "Cliente dado de baja", data: resultado });
    } catch (error) {
      next(error);
    }
  };
}
