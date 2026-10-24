import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

export const nivelesDificultad = ["Baja", "Media", "Alta"] as const;

export const esquemaCircuito = z.object({
    nombreCircuito: z
        .string()
        .trim()
        .min(1, "El nombre del circuito es obligatorio.")
        .max(120, "El nombre no puede superar los 120 caracteres."),
    duracionDias: z
        .number({ message: "Ingresá una duración válida en días." })
        .int("La duración debe ser un número entero.")
        .min(1, "La duración debe ser de al menos 1 día."),
    dificultad: z
        .string()
        .trim()
        .min(1, "La dificultad es obligatoria."),
    minimoGuias: z
        .number({ message: "Ingresá una cantidad de guías válida." })
        .int("El mínimo de guías debe ser un número entero.")
        .min(1, "El mínimo de guías debe ser de al menos 1."),
    parametrosPorteadores: z
        .string()
        .trim()
        .max(200, "Los parámetros no pueden superar los 200 caracteres.")
        .optional(),
});

export type DatosCircuito = z.infer<typeof esquemaCircuito>;

export type EtapaCircuito = {
    idcircuito: number;
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto?: string | null;
};

export type DatosEtapaCircuito = {
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto?: string | null;
};

export type Circuito = {
    id: number;
    idcircuito: number;
    nombreCircuito: string;
    duracionDias: number;
    dificultad: string;
    minimoGuias: number;
    parametrosPorteadores?: string | null;
    estado: "ACTIVO" | "INACTIVO";
    etapas?: EtapaCircuito[];
};

type CircuitoApi = Omit<Circuito, "id">;

type RespuestaDatos<T> = {
    mensaje?: string;
    data: T;
};

function respuestaDatos<T>(respuesta: RespuestaDatos<T>): T {
    return respuesta.data;
}

function normalizarCircuito(circuito: CircuitoApi): Circuito {
    return {
        ...circuito,
        id: circuito.idcircuito,
    };
}

function limpiarPayloadCircuito(
    datos: Partial<DatosCircuito>,
    esEdicion = false,
): Partial<DatosCircuito> {
    const copia: Partial<DatosCircuito> = { ...datos };
    if (copia.parametrosPorteadores !== undefined) {
        const texto = copia.parametrosPorteadores.trim();
        copia.parametrosPorteadores =
            texto.length > 0 ? texto : esEdicion ? "" : undefined;
    }
    return copia;
}

export type FiltrosCircuito = {
    estado?: "ACTIVO" | "INACTIVO" | "TODOS";
    dificultad?: string;
    duracionDias?: number;
};

export function listarCircuitos(
    filtros?: FiltrosCircuito | Record<string, unknown>,
): Promise<Circuito[]> {
    const params = new URLSearchParams();
    if (typeof filtros?.estado === "string" && filtros.estado) {
        params.set("estado", filtros.estado);
    }
    if (
        typeof filtros?.dificultad === "string" &&
        filtros.dificultad.trim()
    ) {
        params.set("dificultad", filtros.dificultad.trim());
    }
    if (
        typeof filtros?.duracionDias === "number" &&
        filtros.duracionDias > 0
    ) {
        params.set("duracionDias", String(filtros.duracionDias));
    }
    const query = params.toString();
    return solicitarApi<RespuestaDatos<CircuitoApi[]>>(
        query ? `/circuitos?${query}` : "/circuitos",
    )
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarCircuito));
}

export function registrarCircuito(datos: DatosCircuito): Promise<Circuito> {
    return solicitarApi<RespuestaDatos<CircuitoApi>>("/circuitos", {
        method: "POST",
        body: JSON.stringify(limpiarPayloadCircuito(datos, false)),
    })
        .then(respuestaDatos)
        .then(normalizarCircuito);
}

export function modificarCircuito(
    id: number,
    datos: Partial<DatosCircuito>,
): Promise<Circuito> {
    return solicitarApi<RespuestaDatos<CircuitoApi>>(`/circuitos/${id}`, {
        method: "PUT",
        body: JSON.stringify(limpiarPayloadCircuito(datos, true)),
    })
        .then(respuestaDatos)
        .then(normalizarCircuito);
}

export function darDeBajaCircuito(id: number): Promise<Circuito> {
    return solicitarApi<RespuestaDatos<CircuitoApi>>(`/circuitos/${id}/baja`, {
        method: "PATCH",
    })
        .then(respuestaDatos)
        .then(normalizarCircuito);
}

// CU-05: Consultar y reemplazar secuencia completa de etapas del circuito
export function listarEtapasCircuito(idCircuito: number): Promise<EtapaCircuito[]> {
    return solicitarApi<RespuestaDatos<EtapaCircuito[]>>(
        `/circuitos/${idCircuito}/etapas`,
    ).then(respuestaDatos);
}

export function guardarSecuenciaEtapas(
    idCircuito: number,
    etapas: DatosEtapaCircuito[],
): Promise<EtapaCircuito[]> {
    return solicitarApi<RespuestaDatos<EtapaCircuito[]>>(
        `/circuitos/${idCircuito}/etapas`,
        {
            method: "PUT",
            body: JSON.stringify({
                etapas: etapas.map((etapa, indice) => ({
                    numeroOrden: indice + 1,
                    puntoInicio: etapa.puntoInicio.trim(),
                    puntoFin: etapa.puntoFin.trim(),
                    campamentoPrevisto:
                        etapa.campamentoPrevisto?.trim() || null,
                })),
            }),
        },
    ).then(respuestaDatos);
}

export const clavesCircuitos = {
    todos: ["circuitos"] as const,
    lista: (filtros?: FiltrosCircuito) =>
        filtros
            ? (["circuitos", filtros] as const)
            : (["circuitos"] as const),
    uno: (id: number) => ["circuitos", id] as const,
    etapas: (idCircuito: number) => ["circuitos", idCircuito, "etapas"] as const,
};

export function useCircuitos(filtros?: FiltrosCircuito) {
    return useQuery({
        queryKey: clavesCircuitos.lista(filtros),
        queryFn: () => listarCircuitos(filtros),
    });
}

export function useEtapasCircuito(idCircuito: number) {
    return useQuery({
        queryKey: clavesCircuitos.etapas(idCircuito),
        queryFn: () => listarEtapasCircuito(idCircuito),
        enabled: Number.isInteger(idCircuito) && idCircuito > 0,
    });
}

export function useRegistrarCircuito() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: registrarCircuito,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({ queryKey: clavesCircuitos.todos }),
    });
}

export function useModificarCircuito() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({ id, datos }: { id: number; datos: Partial<DatosCircuito> }) =>
            modificarCircuito(id, datos),
        onSuccess: () =>
            clienteConsultas.invalidateQueries({ queryKey: clavesCircuitos.todos }),
    });
}

export function useDarDeBajaCircuito() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaCircuito,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({ queryKey: clavesCircuitos.todos }),
    });
}

export function useGuardarEtapasCircuito(idCircuito: number) {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: (etapas: DatosEtapaCircuito[]) =>
            guardarSecuenciaEtapas(idCircuito, etapas),
        onSuccess: () => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesCircuitos.etapas(idCircuito),
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesCircuitos.todos,
            });
        },
    });
}
