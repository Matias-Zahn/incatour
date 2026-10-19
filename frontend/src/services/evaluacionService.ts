import { solicitarApi } from "./clienteApi";

export interface SalidaResumenAdmin {
  idsalida: number;
  idpaquete: number;
  nroSalida: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "PUBLICADA" | "CONSOLIDADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA" | string;
  paquete?: {
    nroPaquete: string;
    nombrePaquete: string;
  };
}

export interface EvaluacionRegistrada {
  idsalida: number;
  puntaje: number;
  comentario: string | null;
  fechaEvaluacion?: string;
}

export interface PersonalEvaluable {
  idpersonal: number;
  nombreCompleto: string;
  rol: string;
  evaluacion: EvaluacionRegistrada | null;
}

export interface ProveedorEvaluable {
  idproveedor: number;
  razonSocial: string;
  evaluacion: EvaluacionRegistrada | null;
}

export interface EvaluablesSalidaRespuesta {
  salida: {
    idsalida: number;
    nroSalida: string;
  };
  personal: PersonalEvaluable[];
  proveedores: ProveedorEvaluable[];
}

export interface EvaluarPayload {
  tipo: "PERSONAL" | "PROVEEDOR";
  id: number;
  puntaje: number;
  comentario?: string;
}

export interface ReseniaClienteItem {
  idcliente: number;
  idsalida: number;
  valoracion: number;
  comentario: string | null;
  fechaEnvio: string;
  cliente: {
    idcliente: number;
    usuario: {
      nombre: string;
      apellido: string;
    };
  };
  salida: {
    idsalida: number;
    nroSalida: string;
    fechaInicio: string;
    paquete: {
      idpaquete: number;
      nombrePaquete: string;
    };
  };
}

export interface EvaluacionPersonalListado {
  idsalida: number;
  idpersonal: number;
  puntaje: number;
  comentario: string | null;
  fechaEvaluacion: string;
  personal: {
    nombreCompleto: string;
    rol: string;
  };
  salida: {
    nroSalida: string;
  };
}

export interface EvaluacionProveedorListado {
  idsalida: number;
  idproveedor: number;
  puntaje: number;
  comentario: string | null;
  fechaEvaluacion: string;
  proveedor: {
    razonSocial: string;
  };
  salida: {
    nroSalida: string;
  };
}

export interface ConsultaReseniasRespuesta {
  resumen: {
    cantidad: number;
    promedio: number | null;
  };
  resenias: ReseniaClienteItem[];
  evaluaciones: {
    personal: EvaluacionPersonalListado[];
    proveedores: EvaluacionProveedorListado[];
  };
}

export interface FiltrosConsultaResenias {
  idsalida?: number;
  idpaquete?: number;
  valoracionMin?: number;
  valoracionMax?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}

export const ETIQUETAS_PUNTAJE: Record<number, string> = {
  1: "1 ★ · Deficiente",
  2: "2 ★ · Regular",
  3: "3 ★ · Aceptable",
  4: "4 ★ · Muy bueno",
  5: "5 ★ · Excelente",
};

export const COMENTARIOS_RAPIDOS_EVALUACION = [
  "Excelente puntualidad y compromiso con el grupo",
  "Muy buena atención y desempeño durante todo el circuito",
  "Cumplió con todo lo pactado sin inconvenientes",
  "Coordinación correcta, con margen de mejora en tiempos",
] as const;

// Auxiliar para poblar el selector de salidas sin pedir IDs manuales
export async function listarSalidasParaEvaluacion(): Promise<SalidaResumenAdmin[]> {
  const res = await solicitarApi<{ data: SalidaResumenAdmin[] }>("/salidas");
  return res.data ?? [];
}

// CU-42: Consultar personal y proveedores evaluables de una salida finalizada
export async function consultarEvaluablesSalida(
  idSalida: number,
): Promise<EvaluablesSalidaRespuesta> {
  const res = await solicitarApi<{ data: EvaluablesSalidaRespuesta }>(
    `/salidas/${idSalida}/evaluaciones`,
  );
  return res.data;
}

// CU-42: Registrar evaluación de personal o proveedor
export async function registrarEvaluacionSalida(
  idSalida: number,
  payload: EvaluarPayload,
): Promise<EvaluacionRegistrada> {
  const res = await solicitarApi<{ mensaje: string; data: EvaluacionRegistrada }>(
    `/salidas/${idSalida}/evaluaciones`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

// CU-43: Consultar reseñas de clientes y evaluaciones del administrador con filtros
export async function consultarReseniasYEvaluaciones(
  filtros: FiltrosConsultaResenias = {},
): Promise<ConsultaReseniasRespuesta> {
  const params = new URLSearchParams();
  if (filtros.idsalida) params.set("idsalida", String(filtros.idsalida));
  if (filtros.idpaquete) params.set("idpaquete", String(filtros.idpaquete));
  if (filtros.valoracionMin) params.set("valoracionMin", String(filtros.valoracionMin));
  if (filtros.valoracionMax) params.set("valoracionMax", String(filtros.valoracionMax));
  if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.set("fechaHasta", String(filtros.fechaHasta));

  const query = params.toString();
  const res = await solicitarApi<{ data: ConsultaReseniasRespuesta }>(
    `/resenias${query ? `?${query}` : ""}`,
  );
  return res.data;
}
