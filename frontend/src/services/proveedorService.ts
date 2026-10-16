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

export type DatosProveedor = z.infer<typeof esquemaProveedor>;
export type Proveedor = DatosProveedor & {
    id: number;
    idproveedor: number;
    cantidadServicios: number;
};

type ProveedorApi = Omit<Proveedor, "id">;
const normalizarProveedor = (proveedor: ProveedorApi): Proveedor => ({
    ...proveedor,
    id: proveedor.idproveedor,
});

export function listarProveedores(): Promise<Proveedor[]> {
    return solicitarApi<{ data: ProveedorApi[] }>("/proveedores")
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarProveedor));
}

export function registrarProveedor(datos: DatosProveedor): Promise<Proveedor> {
    return solicitarApi<{ data: ProveedorApi }>("/proveedores", {
        method: "POST",
        body: JSON.stringify(datos),
    }).then(respuestaDatos).then(normalizarProveedor);
}

export function modificarProveedor(
    id: number,
    datos: Partial<DatosProveedor>,
): Promise<Proveedor> {
    return solicitarApi<{ data: ProveedorApi }>(`/proveedores/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    }).then(respuestaDatos).then(normalizarProveedor);
}

export function darDeBajaProveedor(id: number): Promise<Proveedor> {
    return solicitarApi<{ data: ProveedorApi }>(`/proveedores/${id}/baja`, {
        method: "PATCH",
    }).then(respuestaDatos).then(normalizarProveedor);
}

export const clavesProveedores = {
    todos: ["proveedores"] as const,
};

export function useProveedores() {
    return useQuery({
        queryKey: clavesProveedores.todos,
        queryFn: listarProveedores,
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
        mutationFn: ({ id, datos }: { id: number; datos: Partial<DatosProveedor> }) =>
            modificarProveedor(id, datos),
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
