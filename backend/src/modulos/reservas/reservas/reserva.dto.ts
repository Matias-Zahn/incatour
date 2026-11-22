export interface PasajeroInput {
  nombreCompleto: string;
  nroPasaporte: string;
  nacionalidad: string;
  fechaVencimientoPasaporte: string;
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
    public medioPago: string,
    public tarjeta: TarjetaInput
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearReservaDto?] {
    const { idsalida, pasajeros, medioPago, tarjeta } = obj;

    // El cliente NO viene en el body: se toma del token (usuario autenticado).
    // El monto tampoco: lo calcula el servidor a partir de la tarifa vigente.
    // El equipaje se pesa y cobra en persona (B6): si llega en el body, se ignora.
    if (!Number.isInteger(idsalida)) return ["idsalida es requerido y debe ser un número entero."];
    if (!medioPago) return ["medioPago es requerido."];
    if (!pasajeros || !Array.isArray(pasajeros) || pasajeros.length === 0) {
      return ["Debe registrar al menos un pasajero para la reserva."];
    }

    for (const p of pasajeros) {
      if (!p.nombreCompleto) return ["nombreCompleto es requerido para todos los pasajeros."];
      if (typeof p.nroPasaporte !== "string" || !p.nroPasaporte.trim()) {
        return ["nroPasaporte es requerido para todos los pasajeros."];
      }
      p.nroPasaporte = p.nroPasaporte.trim();
      if (!p.nacionalidad) return ["nacionalidad es requerido para todos los pasajeros."];
      if (!p.fechaVencimientoPasaporte) return ["fechaVencimientoPasaporte es requerida."];
      if (isNaN(new Date(p.fechaVencimientoPasaporte).getTime())) {
        return [`fechaVencimientoPasaporte inválida para ${p.nombreCompleto}.`];
      }
    }

    if (
      !tarjeta ||
      typeof tarjeta !== "object" ||
      [tarjeta.numero, tarjeta.titular, tarjeta.vencimiento, tarjeta.cvv].some((v) => typeof v !== "string" || !v.trim())
    ) {
      return ["Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."];
    }

    return [undefined, new CrearReservaDto(idsalida, pasajeros, medioPago, tarjeta)];
  }
}