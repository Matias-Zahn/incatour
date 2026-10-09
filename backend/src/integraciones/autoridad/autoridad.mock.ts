import crypto from "crypto";
import {
  IApiAutoridad,
  PermisoEmitido,
  ResultadoBloqueo,
  TitularPermiso,
} from "./autoridad.interface";

/**
 * Simulación de la autoridad del Camino Inca (DDC).
 *
 * - Cupo diario: 500 personas, contando turistas, guías y porteadores.
 * - new AutoridadMock(true) simula que la autoridad no responde (timeout del CU-37).
 *
 * ponytail: estado en memoria, se pierde al reiniciar el servidor; pasar a tablas propias cuando moleste.
 */
const CUPO_DIARIO = 500;

interface Bloqueo {
  fecha: string; // "2026-11-15", para usarla como clave del Map
  lugares: number;
}

interface PermisoRegistrado {
  idBloqueo: string;
  vigente: boolean;
}

export class AutoridadMock implements IApiAutoridad {
  private ocupadosPorDia = new Map<string, number>(); // fecha → lugares bloqueados
  private bloqueos = new Map<string, Bloqueo>(); // idBloqueo → bloqueo
  private permisos = new Map<string, PermisoRegistrado>(); // nroPermiso → permiso

  constructor(private caida = false) {}

  async solicitarBloqueoCupo(
    fechaInicio: Date,
    totalLugares: number,
  ): Promise<ResultadoBloqueo> {
    this.verificarConexion();
    const fecha = fechaInicio.toISOString().slice(0, 10);
    const ocupados = this.ocupadosPorDia.get(fecha) ?? 0;
    const disponibles = CUPO_DIARIO - ocupados;

    if (totalLugares > disponibles) {
      return { aprobado: false, lugaresDisponibles: disponibles };
    }

    this.ocupadosPorDia.set(fecha, ocupados + totalLugares);
    const idBloqueo = `BLQ-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    this.bloqueos.set(idBloqueo, { fecha, lugares: totalLugares });
    return { aprobado: true, idBloqueo };
  }

  async liberarLugaresSobrantes(
    idBloqueo: string,
    sobrantes: number,
  ): Promise<void> {
    this.verificarConexion();
    const bloqueo = this.buscarBloqueo(idBloqueo);
    if (sobrantes <= 0 || sobrantes > bloqueo.lugares) {
      throw new Error(
        `Sobrantes inválidos: el bloqueo ${idBloqueo} tiene ${bloqueo.lugares} lugares`,
      );
    }
    bloqueo.lugares -= sobrantes;
    this.liberarDelDia(bloqueo.fecha, sobrantes);
  }

  async liberarTotalidadCupos(idBloqueo: string): Promise<void> {
    this.verificarConexion();
    const bloqueo = this.buscarBloqueo(idBloqueo);
    this.liberarDelDia(bloqueo.fecha, bloqueo.lugares);
    this.bloqueos.delete(idBloqueo);
    for (const [nroPermiso, permiso] of this.permisos) {
      if (permiso.idBloqueo === idBloqueo) this.permisos.delete(nroPermiso);
    }
  }

  async solicitarEmisionNominal(
    idBloqueo: string,
    nomina: TitularPermiso[],
  ): Promise<PermisoEmitido[]> {
    this.verificarConexion();
    const bloqueo = this.buscarBloqueo(idBloqueo);
    if (nomina.length > bloqueo.lugares) {
      throw new Error(
        `La nómina tiene ${nomina.length} personas y el bloqueo ${bloqueo.lugares} lugares`,
      );
    }
    return nomina.map((titular) => this.emitir(idBloqueo, titular));
  }

  async darDeBajaPermiso(idBloqueo: string, nroPermiso: string): Promise<void> {
    this.verificarConexion();
    this.buscarPermiso(idBloqueo, nroPermiso).vigente = false;
  }

  async solicitarPermisoIndividual(
    idBloqueo: string,
    reemplazante: TitularPermiso,
    nroPermisoAnterior: string,
  ): Promise<PermisoEmitido> {
    this.verificarConexion();
    const anterior = this.buscarPermiso(idBloqueo, nroPermisoAnterior);
    if (anterior.vigente) {
      throw new Error(
        `El permiso ${nroPermisoAnterior} sigue vigente: primero hay que darlo de baja`,
      );
    }
    this.permisos.delete(nroPermisoAnterior); // su lugar pasa al permiso nuevo
    return this.emitir(idBloqueo, reemplazante);
  }

  private emitir(idBloqueo: string, titular: TitularPermiso): PermisoEmitido {
    const nroPermiso = `PER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    this.permisos.set(nroPermiso, { idBloqueo, vigente: true });
    return {
      titular: { tipo: titular.tipo, id: titular.id },
      nroPermiso,
      fechaEmision: new Date(),
    };
  }

  private buscarBloqueo(idBloqueo: string): Bloqueo {
    const bloqueo = this.bloqueos.get(idBloqueo);
    if (!bloqueo) throw new Error(`El bloqueo ${idBloqueo} no existe`);
    return bloqueo;
  }

  private buscarPermiso(
    idBloqueo: string,
    nroPermiso: string,
  ): PermisoRegistrado {
    const permiso = this.permisos.get(nroPermiso);
    if (!permiso || permiso.idBloqueo !== idBloqueo) {
      throw new Error(
        `El permiso ${nroPermiso} no existe en el bloqueo ${idBloqueo}`,
      );
    }
    return permiso;
  }

  private liberarDelDia(fecha: string, lugares: number) {
    this.ocupadosPorDia.set(
      fecha,
      (this.ocupadosPorDia.get(fecha) ?? 0) - lugares,
    );
  }

  private verificarConexion() {
    if (this.caida) throw new Error("La autoridad no responde");
  }
}
