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
