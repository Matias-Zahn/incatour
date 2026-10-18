import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

export const tiposServicio = ["ALOJAMIENTO", "TRANSPORTE", "TREN", "EQUIPAMIENTO"] as const;
export type TipoServicio = (typeof tiposServicio)[number];
export type EstadoServicio = "ACTIVO" | "INACTIVO";

export const modalidadesConfirmacion = ["BLOQUEO_PLAZAS", "A_SOLICITUD"] as const;
export type ModalidadConfirmacion = (typeof modalidadesConfirmacion)[number];

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS_VALIDOS = new Set(["L", "M", "X", "J", "V", "S", "D"]);

export function esDiasOperacionValido(valor: string): boolean {
    const dias = valor.trim().toUpperCase().split("-");
    return (
        dias.length > 0 &&
        dias.every((dia) => DIAS_VALIDOS.has(dia)) &&
        new Set(dias).size === dias.length
    );
}

const camposComunes = {
    tipo: z.enum(tiposServicio),
    nombreServicio: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    descripcion: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
    costoBase: z
        .number({ message: "Ingresá un costo numérico válido." })
        .min(0, "El costo no puede ser negativo."),
    localidad: z.string().trim().min(1, "La localidad es obligatoria.").max(80),
};

export const esquemaServicio = z
    .object({
        ...camposComunes,
        categoria: z.string().trim().max(40).optional(),
        tipoHabitacion: z.string().trim().max(40).optional(),
        capacidadDisponible: z.number().int().min(0, "No puede ser negativa.").optional(),
        modalidadConfirmacion: z.string().trim().optional(),
        capacidadVehiculo: z.number().int().min(1, "Debe ser al menos 1.").optional(),
        pesoEquipajeIncluido: z.number().min(0, "No puede ser negativo.").optional(),
        costoPorKgExcedente: z.number().min(0, "No puede ser negativo.").optional(),
        horarioSalida: z.string().trim().optional(),
        horarioLlegada: z.string().trim().optional(),
        diasOperacion: z.string().trim().optional(),
        tipoEquipamiento: z.string().trim().max(60).optional(),
        cantidadDisponible: z.number().int().min(0, "No puede ser negativa.").optional(),
        inventarioTotal: z.number().int().min(0, "No puede ser negativo.").optional(),
    })
    .superRefine((datos, contexto) => {
        const requeridos: Record<TipoServicio, [keyof DatosServicio, string][]> = {
            ALOJAMIENTO: [
                ["categoria", "La categoría es obligatoria."],
                ["tipoHabitacion", "El tipo de habitación es obligatorio."],
                ["capacidadDisponible", "La capacidad es obligatoria."],
                ["modalidadConfirmacion", "La modalidad es obligatoria."],
            ],
            TRANSPORTE: [
                ["capacidadVehiculo", "La capacidad es obligatoria."],
                ["pesoEquipajeIncluido", "El peso incluido es obligatorio."],
                ["costoPorKgExcedente", "El costo excedente es obligatorio."],
            ],
            TREN: [
                ["horarioSalida", "El horario de salida es obligatorio."],
                ["horarioLlegada", "El horario de llegada es obligatorio."],
                ["diasOperacion", "Los días de operación son obligatorios."],
            ],
            EQUIPAMIENTO: [
                ["tipoEquipamiento", "El tipo de equipamiento es obligatorio."],
                ["cantidadDisponible", "La cantidad es obligatoria."],
            ],
        };

        for (const [campo, mensaje] of requeridos[datos.tipo]) {
            const esCantidadEquipamientoConInventario =
                datos.tipo === "EQUIPAMIENTO" &&
                campo === "cantidadDisponible" &&
                datos.cantidadDisponible === undefined &&
                datos.inventarioTotal !== undefined;

            if (!esCantidadEquipamientoConInventario) {
                const valor = datos[campo];
                if (
                    valor === undefined ||
                    valor === "" ||
                    (typeof valor === "number" && Number.isNaN(valor))
                ) {
                    contexto.addIssue({ code: "custom", path: [campo], message: mensaje });
                }
            }
        }

        if (datos.tipo === "ALOJAMIENTO" && datos.modalidadConfirmacion) {
            if (
                !(modalidadesConfirmacion as readonly string[]).includes(
                    datos.modalidadConfirmacion,
                )
            ) {
                contexto.addIssue({
                    code: "custom",
                    path: ["modalidadConfirmacion"],
                    message: "Elegí BLOQUEO_PLAZAS o A_SOLICITUD.",
                });
            }
        }

        if (datos.tipo === "TREN") {
            if (datos.horarioSalida && !REGEX_HORA.test(datos.horarioSalida)) {
                contexto.addIssue({
                    code: "custom",
                    path: ["horarioSalida"],
                    message: "El horario de salida debe tener formato HH:MM.",
                });
            }
            if (datos.horarioLlegada && !REGEX_HORA.test(datos.horarioLlegada)) {
                contexto.addIssue({
                    code: "custom",
                    path: ["horarioLlegada"],
                    message: "El horario de llegada debe tener formato HH:MM.",
                });
            }
            if (
                datos.horarioSalida &&
                datos.horarioLlegada &&
                datos.horarioSalida === datos.horarioLlegada
            ) {
                contexto.addIssue({
                    code: "custom",
                    path: ["horarioLlegada"],
                    message: "El horario de salida y el de llegada no pueden ser iguales.",
                });
            }
            if (datos.diasOperacion && !esDiasOperacionValido(datos.diasOperacion)) {
                contexto.addIssue({
                    code: "custom",
                    path: ["diasOperacion"],
                    message:
                        "Usá días válidos sin repetir separados por guion (ej: L-M-X-J-V-S-D).",
                });
            }
        }
    });

export type DatosServicio = z.infer<typeof esquemaServicio>;
export type ServicioCrear = Omit<DatosServicio, "inventarioTotal">;
export type ServicioModificar = Partial<Omit<DatosServicio, "tipo" | "cantidadDisponible">>;

export type EdicionServicio = {
    camposEditables: string[];
    enUsoEnSalidasActivas: boolean;
    garantizaPaquetesActivos: boolean;
    aplicaSoloAFuturasSalidas: boolean;
};

export type Servicio = DatosServicio & {
    idservicio: number;
    id: number;
    idproveedor: number;
    estado: EstadoServicio;
    proveedor?: { idproveedor?: number; razonSocial: string; tipoProveedor?: TipoServicio };
    cantidadComprometida?: number;
    inventarioTotal?: number;
    edicion?: EdicionServicio;
};

export type FiltrosServicio = {
    estado?: EstadoServicio;
};

export type ResultadoModificarServicio = {
    mensaje: string;
    versionado: boolean;
    idservicioAnterior?: number;
    servicio: Servicio;
};

type ServicioApi = {
    idservicio: number;
    idproveedor?: number;
    tipo: TipoServicio;
    nombreServicio: string;
    descripcion: string | null;
    costoBase: number;
    localidad: string;
    estado: EstadoServicio;
    proveedor?: Servicio["proveedor"];
    datos: Record<string, string | number | null>;
    disponibilidad: Record<string, string | number>;
    edicion?: EdicionServicio;
};

type RespuestaDatos<T> = { data: T };
type RespuestaAccion<T> = { mensaje: string; data: T };
type RespuestaModificarApi = {
    mensaje: string;
    versionado?: boolean;
    idservicioAnterior?: number;
    data: ServicioApi;
};

const extraer = <T,>(respuesta: RespuestaDatos<T>): T => respuesta.data;

export function normalizarServicio(servicio: ServicioApi, idProveedorFallback = 0): Servicio {
    const camposEspecificos = { ...servicio.datos, ...servicio.disponibilidad };
    const idproveedor =
        servicio.idproveedor ?? servicio.proveedor?.idproveedor ?? idProveedorFallback;
    return {
        ...servicio,
        ...camposEspecificos,
        id: servicio.idservicio,
        idproveedor,
        descripcion: servicio.descripcion ?? "",
    } as Servicio;
}

export function consultarServiciosProveedor(
    idproveedor: number,
    filtros: FiltrosServicio = {},
): Promise<Servicio[]> {
    const parametros = new URLSearchParams();
    if (filtros.estado) parametros.set("estado", filtros.estado);
    const consulta = parametros.toString();
    return solicitarApi<RespuestaDatos<ServicioApi[]>>(
        `/proveedores/${idproveedor}/servicios${consulta ? `?${consulta}` : ""}`,
    )
        .then(extraer)
        .then((datos) => datos.map((item) => normalizarServicio(item, idproveedor)));
}

export function listarServicios(
    idproveedor: number,
    incluirInactivos = true,
): Promise<Servicio[]> {
    return consultarServiciosProveedor(
        idproveedor,
        incluirInactivos ? {} : { estado: "ACTIVO" },
    );
}

export function registrarServicio(
    idproveedor: number,
    datos: DatosServicio,
): Promise<Servicio> {
    const datosAlta: Partial<DatosServicio> = { ...datos };
    delete datosAlta.inventarioTotal;
    if (datosAlta.tipo === "TREN" && datosAlta.diasOperacion) {
        datosAlta.diasOperacion = datosAlta.diasOperacion.trim().toUpperCase();
    }
    return solicitarApi<RespuestaAccion<ServicioApi>>(
        `/proveedores/${idproveedor}/servicios`,
        {
            method: "POST",
            body: JSON.stringify(datosAlta),
        },
    )
        .then(extraer)
        .then((item) => normalizarServicio(item, idproveedor));
}

export function solicitarEdicionServicio(idservicio: number): Promise<Servicio> {
    return solicitarApi<RespuestaDatos<ServicioApi>>(`/servicios/${idservicio}`)
        .then(extraer)
        .then((item) => normalizarServicio(item));
}

export const obtenerServicio = solicitarEdicionServicio;

export function modificarServicio(
    idservicio: number,
    datos: ServicioModificar,
): Promise<ResultadoModificarServicio> {
    const cuerpo: ServicioModificar = { ...datos };
    if (cuerpo.diasOperacion) {
        cuerpo.diasOperacion = cuerpo.diasOperacion.trim().toUpperCase();
    }
    return solicitarApi<RespuestaModificarApi>(`/servicios/${idservicio}`, {
        method: "PUT",
        body: JSON.stringify(cuerpo),
    }).then((respuesta) => ({
        mensaje: respuesta.mensaje,
        versionado: Boolean(respuesta.versionado),
        idservicioAnterior: respuesta.idservicioAnterior,
        servicio: normalizarServicio(respuesta.data),
    }));
}

export function darDeBajaServicio(idservicio: number): Promise<Servicio> {
    return solicitarApi<RespuestaAccion<ServicioApi>>(`/servicios/${idservicio}/baja`, {
        method: "PATCH",
    })
        .then(extraer)
        .then((item) => normalizarServicio(item));
}

export const darDeBaja = darDeBajaServicio;

export const clavesServicios = {
    porProveedor: (idproveedor: number) => ["servicios", idproveedor] as const,
    listaPorProveedor: (idproveedor: number, filtros: FiltrosServicio) =>
        ["servicios", idproveedor, "lista", filtros] as const,
    uno: (idservicio: number) => ["servicio", idservicio] as const,
};

export function useServicios(idproveedor: number, filtros: FiltrosServicio = {}) {
    return useQuery({
        queryKey: clavesServicios.listaPorProveedor(idproveedor, filtros),
        queryFn: () => consultarServiciosProveedor(idproveedor, filtros),
        enabled: Number.isInteger(idproveedor) && idproveedor > 0,
    });
}

export function useServicio(idservicio: number) {
    return useQuery({
        queryKey: clavesServicios.uno(idservicio),
        queryFn: () => solicitarEdicionServicio(idservicio),
        enabled: Number.isInteger(idservicio) && idservicio > 0,
    });
}

export const useSolicitarEdicionServicio = useServicio;

export function useRegistrarServicio(idproveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: (datos: DatosServicio) => registrarServicio(idproveedor, datos),
        onSuccess: () =>
            consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idproveedor) }),
    });
}

export function useModificarServicio(idproveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: ({ id, datos }: { id: number; datos: ServicioModificar }) =>
            modificarServicio(id, datos),
        onSuccess: (_resultado, variables) => {
            consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idproveedor) });
            consultas.invalidateQueries({ queryKey: clavesServicios.uno(variables.id) });
        },
    });
}

export function useDarDeBajaServicio(idproveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaServicio,
        onSuccess: (_servicio, idservicio) => {
            consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idproveedor) });
            consultas.invalidateQueries({ queryKey: clavesServicios.uno(idservicio) });
        },
    });
}
