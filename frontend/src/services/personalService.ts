import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";
import { clavesCuentasGuia } from "./cuentaGuiaService";

export const rolesPersonal = ["Guía", "Porteador"] as const;
export type RolPersonal = (typeof rolesPersonal)[number];
export type EstadoPersonal = "ACTIVO" | "INACTIVO";

const regexSoloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

export function esFechaFuturaOVigente(valor: string): boolean {
    const partes = valor.slice(0, 10).split("-").map(Number);
    if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return false;
    const [anio, mes, dia] = partes as [number, number, number];
    const fecha = new Date(anio, mes - 1, dia);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha >= hoy;
}

export const esquemaCrearPersonal = z
    .object({
        nombre: z
            .string()
            .trim()
            .min(1, "El nombre es obligatorio.")
            .max(64, "El nombre debe tener entre 1 y 64 caracteres.")
            .regex(regexSoloLetras, "El nombre solo puede contener letras y espacios."),
        apellido: z
            .string()
            .trim()
            .min(1, "El apellido es obligatorio.")
            .max(64, "El apellido debe tener entre 1 y 64 caracteres.")
            .regex(regexSoloLetras, "El apellido solo puede contener letras y espacios."),
        email: z.string().trim().optional(),
        contrasenia: z.string().optional(),
        nroPasaporte: z.string().trim().min(1, "El número de pasaporte es obligatorio.").max(40),
        nacionalidad: z.string().trim().min(1, "La nacionalidad es obligatoria.").max(64),
        fechaVencimientoPasaporte: z
            .string()
            .trim()
            .min(1, "La fecha de vencimiento del pasaporte es obligatoria.")
            .refine(
                esFechaFuturaOVigente,
                "No se puede registrar personal con un pasaporte vencido.",
            ),
        rolOperativo: z.enum(rolesPersonal),
        nroHabilitacion: z.string().trim().optional(),
        fechaHabilitacion: z.string().trim().optional(),
    })
    .superRefine((datos, contexto) => {
        if (datos.rolOperativo !== "Guía") return;

        if (!datos.email) {
            contexto.addIssue({
                code: "custom",
                path: ["email"],
                message: "El email es requerido para un guía.",
            });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
            contexto.addIssue({
                code: "custom",
                path: ["email"],
                message: "Ingresá un email válido.",
            });
        }

        if (!datos.contrasenia || datos.contrasenia.length < 8) {
            contexto.addIssue({
                code: "custom",
                path: ["contrasenia"],
                message: "La contraseña debe tener como mínimo 8 caracteres.",
            });
        }

        if (!datos.nroHabilitacion) {
            contexto.addIssue({
                code: "custom",
                path: ["nroHabilitacion"],
                message: "El número de habilitación es requerido para un guía.",
            });
        }

        if (!datos.fechaHabilitacion) {
            contexto.addIssue({
                code: "custom",
                path: ["fechaHabilitacion"],
                message: "La fecha de la habilitación es requerida para un guía.",
            });
        } else if (!esFechaFuturaOVigente(datos.fechaHabilitacion)) {
            contexto.addIssue({
                code: "custom",
                path: ["fechaHabilitacion"],
                message: "No se puede registrar un guía con la habilitación vencida.",
            });
        }
    });

export const esquemaModificarPersonal = z.object({
    nombreCompleto: z
        .string()
        .trim()
        .min(1, "El nombre completo es obligatorio.")
        .max(128, "El nombre completo debe tener entre 1 y 128 caracteres.")
        .regex(regexSoloLetras, "El nombre completo solo puede contener letras y espacios."),
    nroPasaporte: z.string().trim().min(1, "El número de pasaporte es obligatorio.").max(40),
    nacionalidad: z.string().trim().min(1, "La nacionalidad es obligatoria.").max(64),
    fechaVencimientoPasaporte: z
        .string()
        .trim()
        .min(1, "La fecha de vencimiento del pasaporte es obligatoria.")
        .refine(esFechaFuturaOVigente, "El pasaporte no puede estar vencido."),
    nroHabilitacion: z.string().trim().optional(),
    fechaHabilitacion: z
        .string()
        .trim()
        .optional()
        .refine(
            (valor) => !valor || esFechaFuturaOVigente(valor),
            "La habilitación no puede estar vencida.",
        ),
});

export type DatosCrearPersonal = z.infer<typeof esquemaCrearPersonal>;
export type DatosModificarPersonal = z.infer<typeof esquemaModificarPersonal>;
export type PersonalModificar = Partial<DatosModificarPersonal>;

export type GuiaPersonal = {
    nroHabilitacion: string;
    fechaHabilitacion: string;
};

export type Personal = {
    idpersonal: number;
    id: number;
    nombreCompleto: string;
    nroPasaporte: string;
    nacionalidad: string;
    fechaVencimientoPasaporte: string;
    estado: EstadoPersonal;
    rol: RolPersonal;
    guia: GuiaPersonal | null;
    nroHabilitacion?: string;
    fechaHabilitacion?: string;
};

export type CredencialesAccesoGuia = {
    idusuario: number;
    email: string;
    nombre: string;
    apellido: string;
    rol: string;
    estado: EstadoPersonal;
};

export type ResultadoCrearPersonal = {
    mensaje: string;
    perfilOperativo: Personal;
    credencialesAcceso: CredencialesAccesoGuia | null;
};

export type FiltrosPersonal = {
    rol?: RolPersonal;
    estado?: EstadoPersonal;
    habilitacionVigente?: boolean;
};

type PersonalApi = {
    idpersonal: number;
    nombreCompleto: string;
    nroPasaporte: string;
    nacionalidad: string;
    fechaVencimientoPasaporte: string;
    estado: EstadoPersonal;
    rol: RolPersonal;
    guia?: {
        nroHabilitacion: string | null;
        fechaHabilitacion: string | null;
    } | null;
};

type RespuestaDatos<T> = { data: T };
type RespuestaAccion<T> = { mensaje: string; data: T };
/** Excepción del contrato API: POST /api/personal devuelve { mensaje, perfilOperativo, credencialesAcceso } sin data. */
type RespuestaCrearPersonalApi = {
    mensaje: string;
    perfilOperativo: PersonalApi;
    credencialesAcceso: CredencialesAccesoGuia | null;
};

const extraer = <T,>(respuesta: RespuestaDatos<T>): T => respuesta.data;

function normalizarFechaIso(fecha: string | null | undefined): string {
    if (!fecha) return "";
    return fecha.slice(0, 10);
}

export function normalizarPersonal(personal: PersonalApi): Personal {
    const nroHabilitacion = personal.guia?.nroHabilitacion ?? undefined;
    const fechaHabilitacion = personal.guia?.fechaHabilitacion
        ? normalizarFechaIso(personal.guia.fechaHabilitacion)
        : undefined;

    return {
        ...personal,
        id: personal.idpersonal,
        fechaVencimientoPasaporte: normalizarFechaIso(personal.fechaVencimientoPasaporte),
        guia: personal.guia
            ? {
                  nroHabilitacion: personal.guia.nroHabilitacion ?? "",
                  fechaHabilitacion: normalizarFechaIso(personal.guia.fechaHabilitacion),
              }
            : null,
        nroHabilitacion,
        fechaHabilitacion,
    };
}

function construirQueryPersonal(filtros: FiltrosPersonal = {}): string {
    const parametros = new URLSearchParams();
    if (filtros.rol) parametros.set("rol", filtros.rol);
    if (filtros.estado) parametros.set("estado", filtros.estado);
    if (filtros.habilitacionVigente !== undefined) {
        parametros.set("habilitacionVigente", String(filtros.habilitacionVigente));
    }
    const query = parametros.toString();
    return query ? `?${query}` : "";
}

export function consultarPersonal(filtros: FiltrosPersonal = {}): Promise<Personal[]> {
    return solicitarApi<RespuestaDatos<PersonalApi[]>>(
        `/personal${construirQueryPersonal(filtros)}`,
    )
        .then(extraer)
        .then((datos) => datos.map(normalizarPersonal));
}

export const listarPersonal = consultarPersonal;

export function crearPersonal(datos: DatosCrearPersonal): Promise<ResultadoCrearPersonal> {
    const cuerpo =
        datos.rolOperativo === "Guía"
            ? {
                  nombre: datos.nombre.trim(),
                  apellido: datos.apellido.trim(),
                  email: datos.email?.trim().toLowerCase(),
                  contrasenia: datos.contrasenia,
                  nroPasaporte: datos.nroPasaporte.trim(),
                  nacionalidad: datos.nacionalidad.trim(),
                  fechaVencimientoPasaporte: datos.fechaVencimientoPasaporte,
                  rolOperativo: datos.rolOperativo,
                  nroHabilitacion: datos.nroHabilitacion?.trim(),
                  fechaHabilitacion: datos.fechaHabilitacion,
              }
            : {
                  nombre: datos.nombre.trim(),
                  apellido: datos.apellido.trim(),
                  nroPasaporte: datos.nroPasaporte.trim(),
                  nacionalidad: datos.nacionalidad.trim(),
                  fechaVencimientoPasaporte: datos.fechaVencimientoPasaporte,
                  rolOperativo: datos.rolOperativo,
              };

    return solicitarApi<RespuestaCrearPersonalApi>("/personal", {
        method: "POST",
        body: JSON.stringify(cuerpo),
    }).then((respuesta) => ({
        mensaje: respuesta.mensaje,
        perfilOperativo: normalizarPersonal(respuesta.perfilOperativo),
        credencialesAcceso: respuesta.credencialesAcceso,
    }));
}

export const registrarPersonal = crearPersonal;

export function modificarPersonal(
    id: number,
    datos: PersonalModificar,
): Promise<Personal> {
    return solicitarApi<RespuestaAccion<PersonalApi>>(`/personal/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    })
        .then(extraer)
        .then(normalizarPersonal);
}

export function darDeBajaPersonal(id: number): Promise<Personal> {
    return solicitarApi<RespuestaAccion<PersonalApi>>(`/personal/${id}/baja`, {
        method: "PATCH",
    })
        .then(extraer)
        .then(normalizarPersonal);
}

export const darDeBaja = darDeBajaPersonal;

export const clavesPersonal = {
    todos: ["personal"] as const,
    lista: (filtros?: FiltrosPersonal) => ["personal", "lista", filtros ?? {}] as const,
};

export function usePersonal(filtros?: FiltrosPersonal) {
    return useQuery({
        queryKey: clavesPersonal.lista(filtros),
        queryFn: () => consultarPersonal(filtros),
    });
}

export function useCrearPersonal() {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: crearPersonal,
        onSuccess: () => {
            consultas.invalidateQueries({ queryKey: clavesPersonal.todos });
            consultas.invalidateQueries({ queryKey: clavesCuentasGuia.todas });
        },
    });
}

export const useRegistrarPersonal = useCrearPersonal;

export function useModificarPersonal() {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: ({ id, datos }: { id: number; datos: PersonalModificar }) =>
            modificarPersonal(id, datos),
        onSuccess: () => {
            consultas.invalidateQueries({ queryKey: clavesPersonal.todos });
            consultas.invalidateQueries({ queryKey: clavesCuentasGuia.todas });
        },
    });
}

export function useDarDeBajaPersonal() {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaPersonal,
        onSuccess: () => {
            consultas.invalidateQueries({ queryKey: clavesPersonal.todos });
            consultas.invalidateQueries({ queryKey: clavesCuentasGuia.todas });
        },
    });
}
