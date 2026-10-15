export interface ItemDevolucion {
  idservicio: number;
  cantidadBuenEstado: number;
  cantidadDaniada: number;
  observaciones?: string;
}

export class DevolucionEquipamientoDto {
  private constructor(
    public items: ItemDevolucion[],
    public observacionesGenerales: string | null
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, DevolucionEquipamientoDto?] {
    const { items, observacionesGenerales } = obj ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return ["Debe enviar una lista de items a devolver (items)."];
    }

    const itemsLimpios: ItemDevolucion[] = [];
    const idsVistos = new Set<number>();

    for (const it of items) {
      if (!it || typeof it !== "object") {
        return ["Cada item debe ser un objeto válido."];
      }

      const idservicio = parseInt(it.idservicio);
      if (isNaN(idservicio) || idservicio <= 0) {
        return ["idservicio debe ser un número entero mayor a 0."];
      }

      if (idsVistos.has(idservicio)) {
        return [`El servicio #${idservicio} está duplicado en la lista de devolución.`];
      }
      idsVistos.add(idservicio);

      const cantidadBuenEstado = parseInt(it.cantidadBuenEstado);
      const cantidadDaniada = parseInt(it.cantidadDaniada ?? 0);

      if (isNaN(cantidadBuenEstado) || cantidadBuenEstado < 0) {
        return [`cantidadBuenEstado para el servicio #${idservicio} debe ser un entero mayor o igual a 0.`];
      }

      if (isNaN(cantidadDaniada) || cantidadDaniada < 0) {
        return [`cantidadDaniada para el servicio #${idservicio} debe ser un entero mayor o igual a 0.`];
      }

      if (cantidadBuenEstado === 0 && cantidadDaniada === 0) {
        return [`El servicio #${idservicio} debe devolver al menos una unidad (en buen estado o dañada).`];
      }

      let obsItem: string | undefined = undefined;
      if (typeof it.observaciones === "string") {
        const textoObs = it.observaciones.trim();
        if (textoObs.length > 250) {
          return [`Las observaciones del item #${idservicio} no pueden superar los 250 caracteres.`];
        }
        if (textoObs.length > 0) {
          obsItem = textoObs;
        }
      }

      const itemDto: ItemDevolucion = {
        idservicio,
        cantidadBuenEstado,
        cantidadDaniada,
      };
      if (obsItem !== undefined) {
        itemDto.observaciones = obsItem;
      }

      itemsLimpios.push(itemDto);
    }

    let obsGen: string | null = null;
    if (typeof observacionesGenerales === "string" && observacionesGenerales.trim().length > 0) {
      obsGen = observacionesGenerales.trim();
      if (obsGen.length > 500) {
        return ["observacionesGenerales no puede superar los 500 caracteres."];
      }
    }

    return [undefined, new DevolucionEquipamientoDto(itemsLimpios, obsGen)];
  }
}
