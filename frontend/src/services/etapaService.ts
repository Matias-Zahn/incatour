import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

export type EstadoCircuito = "ACTIVO" | "INACTIVO";

export type Circuito = {
    idcircuito: number;
    id: number;
    nombreCircuito: string;
    duracionDias: number;
    dificultad: string;
    minimoGuias: number;
    parametrosPorteadores: string | null;
    estado: EstadoCircuito;
};

export const esquemaEtapa = z.object({
    numeroOrden: z
        .number({ message: "El orden debe ser un número entero positivo." })
        .int("El orden debe ser un número entero.")
        .min(1, "El número de orden debe ser al menos 1."),
    puntoInicio: z
        .string()
        .trim()
        .min(1, "El punto de inicio es obligatorio.")
        .max(120, "Máximo 120 caracteres."),
    puntoFin: z
        .string()
        .trim()
        .min(1, "El punto de fin es obligatorio.")
        .max(120, "Máximo 120 caracteres."),
    campamentoPrevisto: z
        .string()
        .trim()
        .max(120, "Máximo 120 caracteres.")
        .optional()
        .nullable(),
});

export const esquemaSecuenciaEtapas = z
    .object({
        etapas: z.array(esquemaEtapa).min(1, "La secuencia de etapas no puede estar vacía."),
    })
    .superRefine(({ etapas }, contexto) => {
        const ordenes = etapas.map((e) => e.numeroOrden).sort((a, b) => a - b);
        for (let i = 0; i < ordenes.length; i++) {
            if (ordenes[i] !== i + 1) {
                contexto.addIssue({
                    code: "custom",
                    path: ["etapas"],
                    message: `La correlatividad temporal falló. Se esperaba la etapa ${i + 1} pero se encontró la ${ordenes[i]}.`,
                });
                return;
            }
        }

        const ordenadas = [...etapas].sort((a, b) => a.numeroOrden - b.numeroOrden);
        for (let i = 0; i < ordenadas.length - 1; i++) {
            const actual = ordenadas[i];
            const siguiente = ordenadas[i + 1];
            if (actual && siguiente && actual.puntoFin.trim() !== siguiente.puntoInicio.trim()) {
                contexto.addIssue({
                    code: "custom",
                    path: ["etapas", i + 1, "puntoInicio"],
                    message: `Discontinuidad espacial: El fin de la etapa ${actual.numeroOrden} ('${actual.puntoFin.trim()}') no coincide con el inicio de la etapa ${siguiente.numeroOrden} ('${siguiente.puntoInicio.trim()}').`,
                });
                return;
            }
        }
    });

export type DatosEtapa = z.infer<typeof esquemaEtapa>;
export type DatosSecuenciaEtapas = z.infer<typeof esquemaSecuenciaEtapas>;

export type Etapa = {
    id: number;
    idcircuito: number;
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto: string;
};

export type DiscontinuidadEspacial = {
    numeroOrdenActual: number;
    numeroOrdenAnterior: number;
    puntoFinAnterior: string;
    puntoInicioActual: string;
};

export type ResultadoConfirmarSecuencia = {
    mensaje: string;
    data: Etapa[];
};

type EtapaApi = {
    idcircuito?: number;
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto?: string | null;
};

type CircuitoApi = Omit<Circuito, "id">;
type RespuestaDatos<T> = { data: T };
type RespuestaAccion<T> = { mensaje?: string; data: T };

export function normalizarEtapa(etapa: EtapaApi, idCircuitoFallback = 0): Etapa {
    return {
        id: etapa.numeroOrden,
        idcircuito: etapa.idcircuito ?? idCircuitoFallback,
        numeroOrden: etapa.numeroOrden,
        puntoInicio: etapa.puntoInicio,
        puntoFin: etapa.puntoFin,
        campamentoPrevisto: etapa.campamentoPrevisto ?? "",
    };
}

function normalizarCircuito(circuito: CircuitoApi): Circuito {
    return {
        ...circuito,
        id: circuito.idcircuito,
    };
}

/**
 * Detecta tramos consecutivos donde el punto de fin de la etapa N
 * no coincide con el punto de inicio de la etapa N+1 (regla CU-05).
 */
export function detectarDiscontinuidadesEspaciales(etapas: Etapa[]): DiscontinuidadEspacial[] {
    const ordenadas = [...etapas].sort((a, b) => a.numeroOrden - b.numeroOrden);
    const discontinuidades: DiscontinuidadEspacial[] = [];

    for (let i = 1; i < ordenadas.length; i++) {
        const anterior = ordenadas[i - 1]!;
        const actual = ordenadas[i]!;
        if (anterior.puntoFin.trim() !== actual.puntoInicio.trim()) {
            discontinuidades.push({
                numeroOrdenActual: actual.numeroOrden,
                numeroOrdenAnterior: anterior.numeroOrden,
                puntoFinAnterior: anterior.puntoFin.trim(),
                puntoInicioActual: actual.puntoInicio.trim(),
            });
        }
    }

    return discontinuidades;
}

export function consultarCircuitos(): Promise<Circuito[]> {
    return solicitarApi<RespuestaDatos<CircuitoApi[]>>(
        "/circuitos?estado=TODOS",
    ).then((respuesta) => respuesta.data.map(normalizarCircuito));
}

export function consultarEtapas(idcircuito: number): Promise<Etapa[]> {
    return solicitarApi<RespuestaDatos<EtapaApi[]>>(`/circuitos/${idcircuito}/etapas`).then(
        (respuesta) =>
            respuesta.data
                .map((etapa) => normalizarEtapa(etapa, idcircuito))
                .sort((a, b) => a.numeroOrden - b.numeroOrden),
    );
}

export const listarEtapas = consultarEtapas;

export function confirmarSecuenciaCompleta(
    idcircuito: number,
    etapas: DatosEtapa[],
): Promise<ResultadoConfirmarSecuencia> {
    const etapasNormalizadas = etapas.map((etapa, indice) => ({
        numeroOrden: etapa.numeroOrden ?? indice + 1,
        puntoInicio: etapa.puntoInicio.trim(),
        puntoFin: etapa.puntoFin.trim(),
        campamentoPrevisto: etapa.campamentoPrevisto?.trim() || null,
    }));

    return solicitarApi<RespuestaAccion<EtapaApi[]>>(`/circuitos/${idcircuito}/etapas`, {
        method: "PUT",
        body: JSON.stringify({ etapas: etapasNormalizadas }),
    }).then((respuesta) => ({
        mensaje: respuesta.mensaje ?? "Secuencia de etapas establecida exitosamente",
        data: respuesta.data
            .map((etapa) => normalizarEtapa(etapa, idcircuito))
            .sort((a, b) => a.numeroOrden - b.numeroOrden),
    }));
}

export const reemplazarEtapas = confirmarSecuenciaCompleta;

export const clavesEtapas = {
    circuitos: ["circuitos", { estado: "TODOS" }] as const,
    porCircuito: (idcircuito: number) => ["etapas", idcircuito] as const,
};

export function useCircuitos() {
    return useQuery({
        queryKey: clavesEtapas.circuitos,
        queryFn: consultarCircuitos,
    });
}

export function useEtapas(idcircuito: number) {
    return useQuery({
        queryKey: clavesEtapas.porCircuito(idcircuito),
        queryFn: () => consultarEtapas(idcircuito),
        enabled: Number.isInteger(idcircuito) && idcircuito > 0,
    });
}

export function useConfirmarSecuenciaCompleta(idcircuito: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: (etapas: DatosEtapa[]) => confirmarSecuenciaCompleta(idcircuito, etapas),
        onSuccess: () => {
            consultas.invalidateQueries({ queryKey: clavesEtapas.porCircuito(idcircuito) });
        },
    });
}

export const useReemplazarEtapas = useConfirmarSecuenciaCompleta;

