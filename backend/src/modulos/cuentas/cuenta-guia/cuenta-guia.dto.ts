import { ESTADO } from "../../../shared/constantes";

// Hoy solo los guías tienen cuenta de acceso (los porteadores no, CU-23): el único rol de cuenta es GUIA.
export const ROLES_CUENTA = ["GUIA"];
const ESTADOS = [ESTADO.ACTIVO, ESTADO.INACTIVO] as string[];
export const SITUACIONES_HABILITACION = ["VIGENTE", "VENCIDA"];

// CU-44: filtros del listado de cuentas de guía
export class FiltrosCuentaGuiaDto {
  private constructor(
    public rol?: string,
    public estado?: string,
    public habilitacion?: string,
    public busqueda?: string
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosCuentaGuiaDto?] {
    const { rol, estado, habilitacion, busqueda } = query;

    if (rol !== undefined && !ROLES_CUENTA.includes(rol)) {
      return [`rol debe ser uno de: ${ROLES_CUENTA.join(", ")}.`];
    }
    if (estado !== undefined && !ESTADOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS.join(", ")}.`];
    }
    if (habilitacion !== undefined && !SITUACIONES_HABILITACION.includes(habilitacion)) {
      return [`habilitacion debe ser uno de: ${SITUACIONES_HABILITACION.join(", ")}.`];
    }
    const texto = typeof busqueda === "string" && busqueda.trim().length > 0 ? busqueda.trim() : undefined;

    return [undefined, new FiltrosCuentaGuiaDto(rol, estado, habilitacion, texto)];
  }
}