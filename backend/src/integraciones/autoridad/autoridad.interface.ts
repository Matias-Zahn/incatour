export interface TitularPermiso {
  tipo: "PASAJERO" | "PERSONAL";
  id: number; // idpasajero o idpersonal, según el tipo
  nombreCompleto: string;
  nacionalidad: string;
  nroPasaporte: string;
  fechaVencimientoPasaporte: Date;
}

export interface PermisoEmitido {
  titular: Pick<TitularPermiso, "tipo" | "id">;
  nroPermiso: string;
  fechaEmision: Date;
}

export type ResultadoBloqueo =
  | { aprobado: true; idBloqueo: string }
  | { aprobado: false; lugaresDisponibles: number };

export interface IApiAutoridad {
  solicitarBloqueoCupo(
    fechaInicio: Date,
    totalLugares: number,
  ): Promise<ResultadoBloqueo>;
  liberarLugaresSobrantes(idBloqueo: string, sobrantes: number): Promise<void>;
  liberarTotalidadCupos(idBloqueo: string): Promise<void>;
  solicitarEmisionNominal(
    idBloqueo: string,
    nomina: TitularPermiso[],
  ): Promise<PermisoEmitido[]>;
  solicitarPermisoIndividual(
    idBloqueo: string,
    reemplazante: TitularPermiso,
    nroPermisoAnterior: string,
  ): Promise<PermisoEmitido>;
  darDeBajaPermiso(idBloqueo: string, nroPermiso: string): Promise<void>;
}

// Compartido por AutoridadMock y AutoridadSimulada para que las reglas no se separen
export const CUPO_DIARIO = 500; // personas por día, contando turistas, guías y porteadores

// fecha = día calendario a 00:00 UTC ("2026-11-15"), clave del cupo
export const diaDelCupo = (fecha: Date) => fecha.toISOString().slice(0, 10);

export function validarCantidad(n: number) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`La cantidad de lugares debe ser un entero mayor a 0 (llegó ${n})`);
  }
}
