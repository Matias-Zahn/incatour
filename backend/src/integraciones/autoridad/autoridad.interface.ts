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

export interface PermisoRechazado {
  titular: Pick<TitularPermiso, "tipo" | "id">;
  motivo: string;
}

export interface ResultadoEmision {
  emitidos: PermisoEmitido[];
  rechazados: PermisoRechazado[];
}

export type ResultadoBloqueo =
  | { aprobado: true; idBloqueo: string }
  | { aprobado: false; lugaresDisponibles: number };

export interface IApiAutoridad {
  solicitarBloqueoCupo(
    fechaInicio: Date,
    totalLugares: number,
  ): Promise<ResultadoBloqueo>;
  consultarDisponibilidad(fechaInicio: Date): Promise<number>; // lugares libres ese día
  liberarLugaresSobrantes(idBloqueo: string, sobrantes: number): Promise<void>;
  liberarTotalidadCupos(idBloqueo: string): Promise<void>;
  solicitarEmisionNominal(
    idBloqueo: string,
    nomina: TitularPermiso[],
  ): Promise<ResultadoEmision>;
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

// Pasaporte vacío o vencido antes del día del bloqueo (fecha = "2026-11-15"); null si el titular puede viajar
export function motivoRechazo(titular: TitularPermiso, fecha: string): string | null {
  if (!titular.nroPasaporte?.trim()) return "Sin número de pasaporte";
  if (titular.fechaVencimientoPasaporte < new Date(fecha)) return "Pasaporte vencido antes de la salida";
  return null;
}

// Parte la nómina entre quienes pueden recibir permiso y quienes no (los rechazados no ocupan lugar)
export function separarNomina(nomina: TitularPermiso[], fecha: string) {
  const aceptados: TitularPermiso[] = [];
  const rechazados: PermisoRechazado[] = [];
  for (const titular of nomina) {
    const motivo = motivoRechazo(titular, fecha);
    if (motivo) rechazados.push({ titular: { tipo: titular.tipo, id: titular.id }, motivo });
    else aceptados.push(titular);
  }
  return { aceptados, rechazados };
}
