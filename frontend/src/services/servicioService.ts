import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

export const tiposServicio = ["ALOJAMIENTO", "TRANSPORTE", "TREN", "EQUIPAMIENTO"] as const;
export type TipoServicio = (typeof tiposServicio)[number];
export type EstadoServicio = "ACTIVO" | "INACTIVO";

const camposComunes = {
    tipo: z.enum(tiposServicio),
    nombreServicio: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
    descripcion: z.string().trim().max(500).optional(),
    costoBase: z.number().min(0, "El costo no puede ser negativo."),
    localidad: z.string().trim().min(1, "La localidad es obligatoria.").max(80),
};

export const esquemaServicio = z.object({
    ...camposComunes,
    categoria: z.string().optional(),
    tipoHabitacion: z.string().optional(),
    capacidadDisponible: z.number().int().min(0).optional(),
    modalidadConfirmacion: z.string().optional(),
    capacidadVehiculo: z.number().int().min(1).optional(),
    pesoEquipajeIncluido: z.number().min(0).optional(),
    costoPorKgExcedente: z.number().min(0).optional(),
    horarioSalida: z.string().optional(),
    horarioLlegada: z.string().optional(),
    diasOperacion: z.string().optional(),
    tipoEquipamiento: z.string().optional(),
    cantidadDisponible: z.number().int().min(0).optional(),
    inventarioTotal: z.number().int().min(0).optional(),
}).superRefine((datos, contexto) => {
    const requeridos: Record<TipoServicio, [keyof DatosServicio, string][]> = {
        ALOJAMIENTO: [["categoria", "La categoría es obligatoria."], ["tipoHabitacion", "El tipo de habitación es obligatorio."], ["capacidadDisponible", "La capacidad es obligatoria."], ["modalidadConfirmacion", "La modalidad es obligatoria."]],
        TRANSPORTE: [["capacidadVehiculo", "La capacidad es obligatoria."], ["pesoEquipajeIncluido", "El peso incluido es obligatorio."], ["costoPorKgExcedente", "El costo excedente es obligatorio."]],
        TREN: [["horarioSalida", "El horario de salida es obligatorio."], ["horarioLlegada", "El horario de llegada es obligatorio."], ["diasOperacion", "Los días de operación son obligatorios."]],
        EQUIPAMIENTO: [["tipoEquipamiento", "El tipo de equipamiento es obligatorio."], ["cantidadDisponible", "La cantidad es obligatoria."]],
    };
    for (const [campo, mensaje] of requeridos[datos.tipo]) {
        if (
            datos.tipo !== "EQUIPAMIENTO" ||
            campo !== "cantidadDisponible" ||
            datos.cantidadDisponible !== undefined ||
            datos.inventarioTotal === undefined
        ) {
            if (datos[campo] === undefined || datos[campo] === "") {
                contexto.addIssue({ code: "custom", path: [campo], message: mensaje });
            }
        }
    }
});

export type DatosServicio = z.infer<typeof esquemaServicio>;
export type Servicio = DatosServicio & {
    idservicio: number;
    id: number;
    idproveedor: number;
    estado: EstadoServicio;
    proveedor?: { razonSocial: string };
    cantidadComprometida?: number;
    inventarioTotal?: number;
    edicion?: {
        camposEditables: string[];
        enUsoEnSalidasActivas: boolean;
        garantizaPaquetesActivos: boolean;
        aplicaSoloAFuturasSalidas: boolean;
    };
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
    edicion?: Servicio["edicion"];
};

function normalizarServicio(servicio: ServicioApi): Servicio {
    const camposEspecificos = { ...servicio.datos, ...servicio.disponibilidad };
    return {
        ...servicio,
        ...camposEspecificos,
        id: servicio.idservicio,
        idproveedor: servicio.idproveedor ?? 0,
        descripcion: servicio.descripcion ?? "",
    } as Servicio;
}

type Respuesta<T> = { data: T };
const extraer = <T,>(respuesta: Respuesta<T>): T => respuesta.data;

export function listarServicios(idProveedor: number, incluirInactivos = true): Promise<Servicio[]> {
    const filtro = incluirInactivos ? "" : "?estado=ACTIVO";
    return solicitarApi<Respuesta<ServicioApi[]>>(`/proveedores/${idProveedor}/servicios${filtro}`)
        .then(extraer)
        .then((datos) => datos.map(normalizarServicio));
}

export function registrarServicio(idProveedor: number, datos: DatosServicio): Promise<Servicio> {
    const datosAlta = { ...datos };
    delete datosAlta.inventarioTotal;
    return solicitarApi<Respuesta<ServicioApi>>(`/proveedores/${idProveedor}/servicios`, {
        method: "POST",
        body: JSON.stringify(datosAlta),
    }).then(extraer).then(normalizarServicio);
}

export function obtenerServicio(id: number): Promise<Servicio> {
    return solicitarApi<Respuesta<ServicioApi>>(`/servicios/${id}`)
        .then(extraer)
        .then(normalizarServicio);
}

export function modificarServicio(id: number, datos: Partial<DatosServicio>): Promise<Servicio> {
    return solicitarApi<Respuesta<ServicioApi>>(`/servicios/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    }).then(extraer).then(normalizarServicio);
}

export function darDeBajaServicio(id: number): Promise<Servicio> {
    return solicitarApi<Respuesta<ServicioApi>>(`/servicios/${id}/baja`, { method: "PATCH" }).then(extraer).then(normalizarServicio);
}

export const clavesServicios = {
    porProveedor: (id: number) => ["servicios", id] as const,
    uno: (id: number) => ["servicio", id] as const,
};

export function useServicios(idProveedor: number) {
    return useQuery({
        queryKey: clavesServicios.porProveedor(idProveedor),
        queryFn: () => listarServicios(idProveedor),
        enabled: Number.isInteger(idProveedor) && idProveedor > 0,
    });
}

export function useServicio(id: number) {
    return useQuery({
        queryKey: clavesServicios.uno(id),
        queryFn: () => obtenerServicio(id),
        enabled: Number.isInteger(id) && id > 0,
    });
}

export function useRegistrarServicio(idProveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: (datos: DatosServicio) => registrarServicio(idProveedor, datos),
        onSuccess: () => consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idProveedor) }),
    });
}

export function useModificarServicio(idProveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: ({ id, datos }: { id: number; datos: Partial<DatosServicio> }) => modificarServicio(id, datos),
        onSuccess: () => consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idProveedor) }),
    });
}

export function useDarDeBajaServicio(idProveedor: number) {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaServicio,
        onSuccess: () => consultas.invalidateQueries({ queryKey: clavesServicios.porProveedor(idProveedor) }),
    });
}
