export interface PasajeroInput {
  nombreCompleto: string;
  nroPasaporte: string;
  nacionalidad: string;
  fechaVencimientoPasaporte: string;
}

export class CrearReservaDto {
  private constructor(
    public idsalida: number,
    public idcliente: number,
    public pasajeros: PasajeroInput[],
    public medioPago: string,
    public montoTransaccion: number
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearReservaDto?] {
    const { idsalida, idcliente, pasajeros, medioPago, montoTransaccion } = obj;

    if (!idsalida || typeof idsalida !== 'number') return ["idsalida válido es requerido."];
    if (!idcliente || typeof idcliente !== 'number') return ["idcliente válido es requerido."];
    if (!medioPago || typeof medioPago !== 'string') return ["medioPago es requerido."];
    if (!montoTransaccion || typeof montoTransaccion !== 'number') return ["montoTransaccion válido es requerido."];
    if (!pasajeros || !Array.isArray(pasajeros) || pasajeros.length === 0) {
      return ["Debe registrar al menos un pasajero nominal para la reserva."];
    }

    for (const p of pasajeros) {
      if (!p.nombreCompleto) return ["nombreCompleto es requerido en todos los pasajeros."];
      if (!p.nroPasaporte) return ["nroPasaporte es requerido en todos los pasajeros."];
      if (!p.nacionalidad) return ["nacionalidad es requerido en todos los pasajeros."];
      if (!p.fechaVencimientoPasaporte) return ["fechaVencimientoPasaporte válida es requerida."];
    }

    return [undefined, new CrearReservaDto(idsalida, idcliente, pasajeros, medioPago, montoTransaccion)];
  }
}
