// CU-37: el motivo es obligatorio (paso 3: "solicitando el motivo")
export class CancelarSalidaDto {
  private constructor(public motivo: string) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CancelarSalidaDto?] {
    const { motivo } = obj ?? {};
    if (typeof motivo !== "string" || motivo.trim().length === 0) return ["El motivo de la cancelación es requerido."];
    const limpio = motivo.trim();
    if (limpio.length < 5 || limpio.length > 300) return ["El motivo debe tener entre 5 y 300 caracteres."];
    return [undefined, new CancelarSalidaDto(limpio)];
  }
}