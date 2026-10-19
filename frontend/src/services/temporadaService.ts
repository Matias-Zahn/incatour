import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

export const esquemaTemporada = z
    .object({
        nombre: z
            .string()
            .trim()
            .min(1, "El nombre de la temporada es obligatorio.")
            .max(100, "El nombre no puede superar los 100 caracteres."),
        fechaInicio: z
            .string()
            .min(1, "La fecha de inicio es obligatoria."),
        fechaFin: z
            .string()
            .min(1, "La fecha de fin es obligatoria."),
    })
    .refine(
        (datos) => {
            if (!datos.fechaInicio || !datos.fechaFin) return true;
            return new Date(datos.fechaInicio) < new Date(datos.fechaFin);
        },
        {
            message: "La fecha de inicio debe ser anterior a la fecha de fin.",
            path: ["fechaFin"],
        },
    );

export type DatosTemporada = z.infer<typeof esquemaTemporada>;

export type Temporada = {
    id: number;
    idtemporada: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    estado: "ACTIVO" | "INACTIVO";
};

type TemporadaApi = Omit<Temporada, "id">;

type RespuestaDatos<T> = {
    mensaje?: string;
    data: T;
};

function respuestaDatos<T>(respuesta: RespuestaDatos<T>): T {
    return respuesta.data;
}

function normalizarTemporada(temporada: TemporadaApi): Temporada {
    return {
        ...temporada,
        id: temporada.idtemporada,
    };
}

export function listarTemporadas(): Promise<Temporada[]> {
    return solicitarApi<RespuestaDatos<TemporadaApi[]>>("/temporadas")
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarTemporada));
}

export function registrarTemporada(datos: DatosTemporada): Promise<Temporada> {
    return solicitarApi<RespuestaDatos<TemporadaApi>>("/temporadas", {
        method: "POST",
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarTemporada);
}

export function modificarTemporada(
    id: number,
    datos: Partial<DatosTemporada>,
): Promise<Temporada> {
    return solicitarApi<RespuestaDatos<TemporadaApi>>(`/temporadas/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarTemporada);
}

export function darDeBajaTemporada(id: number): Promise<Temporada> {
    return solicitarApi<RespuestaDatos<TemporadaApi>>(
        `/temporadas/${id}/baja`,
        {
            method: "PATCH",
        },
    )
        .then(respuestaDatos)
        .then(normalizarTemporada);
}

export const clavesTemporadas = {
    todas: ["temporadas"] as const,
};

export function useTemporadas() {
    return useQuery({
        queryKey: clavesTemporadas.todas,
        queryFn: listarTemporadas,
    });
}

export function useRegistrarTemporada() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: registrarTemporada,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({
                queryKey: clavesTemporadas.todas,
            }),
    });
}

export function useModificarTemporada() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            datos,
        }: {
            id: number;
            datos: Partial<DatosTemporada>;
        }) => modificarTemporada(id, datos),
        onSuccess: () =>
            clienteConsultas.invalidateQueries({
                queryKey: clavesTemporadas.todas,
            }),
    });
}

export function useDarDeBajaTemporada() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaTemporada,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({
                queryKey: clavesTemporadas.todas,
            }),
    });
}
