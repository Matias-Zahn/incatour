import { Router } from "express";
import { ReservaController } from "./reserva.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class ReservaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new ReservaController();

    /**
     * @swagger
     * /api/reservas:
     *   post:
     *     summary: Comprar un paquete (CU-30)
     *     description: >
     *       **RESTRINGIDO A CLIENTE.** Valida la salida y los pasajeros, calcula el precio con la
     *       tarifa vigente, descuenta los cupos, cobra en la pasarela y registra la reserva.
     *       Si el pago es rechazado, los cupos vuelven a la venta.
     *     tags: [Reservas]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [idsalida, pasajeros, medioPago, tarjeta]
     *             properties:
     *               idsalida: { type: integer }
     *               medioPago: { type: string, example: TARJETA }
     *               pasajeros:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     nombreCompleto: { type: string }
     *                     nroPasaporte: { type: string }
     *                     nacionalidad: { type: string }
     *                     fechaVencimientoPasaporte: { type: string, format: date }
     *               equipaje:
     *                 type: array
     *                 description: Un elemento por pasajero, en el mismo orden.
     *                 items:
     *                   type: object
     *                   properties:
     *                     pesoDeclarado: { type: number }
     *               tarjeta:
     *                 type: object
     *                 properties:
     *                   numero: { type: string }
     *                   titular: { type: string }
     *                   vencimiento: { type: string, example: "12/29" }
     *                   cvv: { type: string }
     *     responses:
     *       201:
     *         description: Reserva confirmada.
     *       400:
     *         description: Datos inválidos, sin cupo o pago rechazado.
     *       401:
     *         description: Token no proporcionado o inválido.
     *       403:
     *         description: Se requiere el perfil CLIENTE.
     */
    router.post("/", autenticar, requierePerfil("CLIENTE"), controller.crearReserva);

    return router;
  }
}
