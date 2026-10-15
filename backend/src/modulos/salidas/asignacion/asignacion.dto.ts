export interface ItemCamping {
  idservicio: number;
  cantidad: number;
}

// CU-40: confirmarAsignacion(salidaId, personalIds, transpId, itemsCamping)
export class ConfirmarAsignacionDto {
  private constructor(
    public personalIds: number[],
    public idtransporte: number,
    public itemsCamping: ItemCamping[],
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ConfirmarAsignacionDto?] {
    const { personalIds, idtransporte, itemsCamping = [] } = obj;

    if (!Array.isArray(personalIds) || personalIds.length === 0 || !personalIds.every(esEnteroPositivo)) {
      return ["personalIds debe ser una lista de ids de personal"];
    }
    if (new Set(personalIds).size !== personalIds.length) return ["personalIds tiene ids repetidos"];

    if (!esEnteroPositivo(idtransporte)) return ["idtransporte es requerido y debe ser un entero positivo"];

    if (!Array.isArray(itemsCamping)) return ["itemsCamping debe ser una lista"];
    for (const item of itemsCamping) {
      if (!esEnteroPositivo(item?.idservicio) || !esEnteroPositivo(item?.cantidad)) {
        return ["Cada artículo de camping necesita idservicio y una cantidad entera positiva"];
      }
    }
    const servicios = itemsCamping.map((i: ItemCamping) => i.idservicio);
    if (new Set(servicios).size !== servicios.length) return ["itemsCamping repite un mismo artículo"];

    return [undefined, new ConfirmarAsignacionDto(personalIds, idtransporte, itemsCamping)];
  }
}

const esEnteroPositivo = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
