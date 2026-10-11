export interface PasajeroInput {
  nombreCompleto: string;
  nroPasaporte: string;
  nacionalidad: string;
  fechaVencimientoPasaporte: string;
}

export interface EquipajeInput {
  pesoDeclarado: number;
}

// Datos de la tarjeta: solo viajan hasta la pasarela. NUNCA se guardan ni se loguean.
export interface TarjetaInput {
  numero: string;
  titular: string;
  vencimiento: string; // MM/YY
  cvv: string;
}

export class CrearReservaDto {
  private constructor(
    public idsalida: number,
    public pasajeros: PasajeroInput[],
    public equipaje: EquipajeInput[],
    public medioPago: string,
    public tarjeta: TarjetaInput
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearReservaDto?] {
    const { idsalida, pasajeros, equipaje, medioPago, tarjeta } = obj;

    // El cliente NO viene en el body: se toma del token (usuario autenticado).
    // El monto tampoco: lo calcula el servidor a partir de la tarifa vigente.
    if (!Number.isInteger(idsalida)) return ["idsalida es requerido y debe ser un número entero."];
    if (!medioPago) return ["medioPago es requerido."];
    if (!pasajeros || !Array.isArray(pasajeros) || pasajeros.length === 0) {
      return ["Debe registrar al menos un pasajero para la reserva."];
    }

    for (const p of pasajeros) {
      if (!p.nombreCompleto) return ["nombreCompleto es requerido para todos los pasajeros."];
      if (!p.nroPasaporte) return ["nroPasaporte es requerido para todos los pasajeros."];
      if (!p.nacionalidad) return ["nacionalidad es requerido para todos los pasajeros."];
      if (!p.fechaVencimientoPasaporte) return ["fechaVencimientoPasaporte es requerida."];
      if (isNaN(new Date(p.fechaVencimientoPasaporte).getTime())) {
        return [`fechaVencimientoPasaporte inválida para ${p.nombreCompleto}.`];
      }
    }

    // El equipaje es opcional; si viene, un elemento por pasajero (mismo orden).
    const equipajeNormalizado: EquipajeInput[] = equipaje ?? [];
    if (!Array.isArray(equipajeNormalizado)) return ["equipaje debe ser un arreglo."];
    if (equipajeNormalizado.length > 0 && equipajeNormalizado.length !== pasajeros.length) {
      return ["equipaje debe tener un elemento por cada pasajero."];
    }
    for (const e of equipajeNormalizado) {
      if (typeof e.pesoDeclarado !== "number" || e.pesoDeclarado < 0) {
        return ["pesoDeclarado debe ser un número mayor o igual a 0."];
      }
    }

    if (!tarjeta || !tarjeta.numero || !tarjeta.titular || !tarjeta.vencimiento || !tarjeta.cvv) {
      return ["Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."];
    }

    return [undefined, new CrearReservaDto(idsalida, pasajeros, equipajeNormalizado, medioPago, tarjeta)];
  }
}