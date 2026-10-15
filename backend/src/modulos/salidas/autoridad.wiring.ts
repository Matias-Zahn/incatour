import { CustomError } from "../../error/CustomError";
import { IApiAutoridad } from "../../integraciones/autoridad/autoridad.interface";

/**
 * Punto único donde se conecta la integración con la autoridad (ApiDDCGobierno / IApiAutoridad).
 * Se configura una vez al arrancar, en app.ts: configurarAutoridad(new AutoridadMock()).
 * Lo usan el CU-36 (bloquear cupo) y el CU-37 (liberar cupos).
 */

// Una sola instancia para todo el backend: la simulación guarda el cupo en memoria,
// así que el CU-36 (bloquea) y el CU-37 (libera) tienen que usar la misma.
let autoridad: IApiAutoridad | null = null;

export const configurarAutoridad = (implementacion: IApiAutoridad) => {
  autoridad = implementacion;
};

export const obtenerAutoridad = (): IApiAutoridad => {
  if (!autoridad) {
    throw CustomError.internalServerError(
      "La integración con la autoridad no está configurada (falta llamar a configurarAutoridad en app.ts)."
    );
  }
  return autoridad;
};