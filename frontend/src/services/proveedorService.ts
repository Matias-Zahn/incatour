import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

// ---------- Esquemas y Tipos ----------

export const esquemaProveedor = z.object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio."),
    contacto: z.string().trim().min(1, "El contacto es obligatorio."),
});

export type DatosProveedor = z.infer<typeof esquemaProveedor>;

export type Proveedor = DatosProveedor & {
    id: number;
};

// ---------- Acceso a la API ----------
// TODO: alinear nombres con los métodos del controlador en el DCD.

export function listarProveedores(): Promise<Proveedor[]> {
    return solicitarApi<Proveedor[]>("/proveedores");
}

export function registrarProveedor(datos: DatosProveedor): Promise<Proveedor> {
    return solicitarApi<Proveedor>("/proveedores", {
        method: "POST",
        body: JSON.stringify(datos),
    });
}

export function modificarProveedor(id: number, datos: DatosProveedor): Promise<Proveedor> {
    return solicitarApi<Proveedor>(`/proveedores/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    });
}

export function darDeBajaProveedor(id: number): Promise<void> {
    return solicitarApi<void>(`/proveedores/${id}`, { method: "DELETE" });
}

// ---------- Hooks de TanStack Query ----------
// (el prefijo "use" es obligatorio en React para los hooks)

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
        mutationFn: (datos: DatosProveedor) => registrarProveedor(datos),
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}

export function useModificarProveedor() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({ id, datos }: { id: number; datos: DatosProveedor }) =>
            modificarProveedor(id, datos),
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}

export function useDarDeBajaProveedor() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => darDeBajaProveedor(id),
        onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: clavesProveedores.todos }),
    });
}
