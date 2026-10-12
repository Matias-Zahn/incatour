import { CustomError } from "../../error/CustomError";

/**
 * Contrato MÍNIMO que el rol 2 necesita de la autoridad (ApiDDCGobierno en el DCD / IApiAutoridad, PR #23 del rol 3):
 * liberar la totalidad de los cupos bloqueados de una salida (CU-37).
 *
 * Este archivo evita acoplar el módulo a la clase exacta del rol 3. Se conecta UNA vez al arrancar, en app.ts:
 *
 *   import { configurarAutoridad } from "./modulos/salidas/autoridad.wiring";
 *   import { <ImplementacionSimulada> } from "./integraciones/autoridad/<archivo>";
 *   configurarAutoridad(new <ImplementacionSimulada>());
 *
 * Si el método real tiene otro nombre o firma, se adapta acá (un único lugar).
 */
export interface AutoridadLiberaCupos {
  liberarTotalidadCupos(idBloqueo: string): Promise<unknown>;
}

let autoridad: AutoridadLiberaCupos | null = null;

export const configurarAutoridad = (implementacion: AutoridadLiberaCupos) => {
  autoridad = implementacion;
};

export const obtenerAutoridad = (): AutoridadLiberaCupos => {
  if (!autoridad) {
    throw CustomError.internalServerError(
      "La integración con la autoridad no está configurada (falta llamar a configurarAutoridad en app.ts)."
    );
  }
  return autoridad;
};