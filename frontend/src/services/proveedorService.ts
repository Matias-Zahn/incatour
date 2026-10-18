import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

const respuestaDatos = <T,>(respuesta: { data: T }): T => respuesta.data;

export const tiposProveedor = [
    "ALOJAMIENTO",
    "TRANSPORTE",
    "TREN",
    "EQUIPAMIENTO",
] as const;

export const esquemaProveedor = z.object({
    tipoProveedor: z.enum(tiposProveedor),
    razonSocial: z.string().trim().min(1, "La razón social es obligatoria.").max(120),
    localidad: z.string().trim().min(1, "La localidad es obligatoria.").max(80),
    datosContacto: z.string().trim().min(1, "Los datos de contacto son obligatorios.").max(200),
    canalComunicacion: z.string().trim().min(1, "El canal de comunicación es obligatorio.").max(60),
    estado: z.enum(["ACTIVO", "INACTIVO"]),
});

/** Cuerpo de alta (POST /proveedores). */
export type ProveedorCrear = DatosProveedor;
/** Cuerpo de modificación (PUT /proveedores/:id): solo lo que cambia. */
export type ProveedorModificar = Partial<DatosProveedor>;
export type DatosProveedor = z.infer<typeof esquemaProveedor>;
export type Proveedor = DatosProveedor & {
    idproveedor: number;
};

/** Éxito de una consulta: `{ data }`. */
type RespuestaDatos<T> = { data: T };
/** Éxito de una acción: `{ mensaje, data }`. Los errores (`{ error }`) los lanza clienteApi como ErrorApi. */
type RespuestaAccion<T> = { mensaje: string; data: T };

/** Filtros opcionales de GET /proveedores (van por query string). */
export type FiltrosProveedor = {
    tipoProveedor?: (typeof tiposProveedor)[number];
    estado?: "ACTIVO" | "INACTIVO";
    localidad?: string;
};

export function listarProveedores(filtros: FiltrosProveedor = {}): Promise<Proveedor[]> {
    const parametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor) parametros.set(clave, valor);
    });
    const consulta = parametros.toString();
    return solicitarApi<RespuestaDatos<Proveedor[]>>(
        `/proveedores${consulta ? `?${consulta}` : ""}`,
    ).then(respuestaDatos);
}

export function obtenerProveedor(idproveedor: number): Promise<Proveedor> {
    return solicitarApi<RespuestaDatos<Proveedor>>(`/proveedores/${idproveedor}`).then(
        respuestaDatos,
    );
}

export function registrarProveedor(datos: ProveedorCrear): Promise<Proveedor> {
    return solicitarApi<RespuestaAccion<Proveedor>>("/proveedores", {
        method: "POST",
        body: JSON.stringify(datos),
    }).then(respuestaDatos);
}

export function modificarProveedor(
    idproveedor: number,
    datos: ProveedorModificar,
): Promise<Proveedor> {
    return solicitarApi<RespuestaAccion<Proveedor>>(`/proveedores/${idproveedor}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    }).then(respuestaDatos);
}

export function darDeBajaProveedor(idproveedor: number): Promise<Proveedor> {
    return solicitarApi<RespuestaAccion<Proveedor>>(`/proveedores/${idproveedor}/baja`, {
        method: "PATCH",
    }).then(respuestaDatos);
}

export const clavesProveedores = {
    todos: ["proveedores"] as const,
    uno: (idproveedor: number) => ["proveedores", idproveedor] as const,
};

export function useProveedores(filtros: FiltrosProveedor = {}) {
    return useQuery({
        queryKey: [...clavesProveedores.todos, "lista", filtros] as const,
        queryFn: () => listarProveedores(filtros),
    });
}

export function useProveedor(idproveedor: number) {
    return useQuery({
        queryKey: clavesProveedores.uno(idproveedor),
        queryFn: () => obtenerProveedor(idproveedor),
        enabled: Number.isInteger(idproveedor) && idproveedor > 0,
    });
}

export function useRegistrarProveedor() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: registrarProveedor,
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}

export function useModificarProveedor() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({ idproveedor, datos }: { idproveedor: number; datos: ProveedorModificar }) =>
            modificarProveedor(idproveedor, datos),
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}

export function useDarDeBajaProveedor() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaProveedor,
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}
