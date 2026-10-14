import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { DatosProveedor, Proveedor } from "../../services/proveedorService";
import { proveedoresSemilla } from "../datos/proveedores";

// "Base de datos" en memoria; se reinicia al recargar la página.
let proveedores: Proveedor[] = [...proveedoresSemilla];

const noEncontrado = () =>
    HttpResponse.json({ mensaje: "Proveedor no encontrado." }, { status: 404 });

export const manejadoresProveedores = [
    http.get(construirUrl("/proveedores"), async () => {
        await delay();
        return HttpResponse.json(proveedores);
    }),

    http.post(construirUrl("/proveedores"), async ({ request }) => {
        await delay();
        const datos = (await request.json()) as DatosProveedor;
        const nuevo: Proveedor = {
            id: Math.max(0, ...proveedores.map((p) => p.id)) + 1,
            ...datos,
        };
        proveedores = [...proveedores, nuevo];
        return HttpResponse.json(nuevo, { status: 201 });
    }),

    http.put(construirUrl("/proveedores/:id"), async ({ params, request }) => {
        await delay();
        const id = Number(params.id);
        const existente = proveedores.find((p) => p.id === id);
        if (!existente) return noEncontrado();
        const datos = (await request.json()) as DatosProveedor;
        const actualizado: Proveedor = { ...existente, ...datos };
        proveedores = proveedores.map((p) => (p.id === id ? actualizado : p));
        return HttpResponse.json(actualizado);
    }),

    http.delete(construirUrl("/proveedores/:id"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        if (!proveedores.some((p) => p.id === id)) return noEncontrado();
        proveedores = proveedores.filter((p) => p.id !== id);
        return new HttpResponse(null, { status: 204 });
    }),
];
