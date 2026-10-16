import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { DatosProveedor, Proveedor } from "../../services/proveedorService";
import { proveedoresSemilla } from "../datos/proveedores";

let proveedores: Proveedor[] = [...proveedoresSemilla];

const respuestaNoEncontrado = () =>
    HttpResponse.json({ mensaje: "Proveedor no encontrado." }, { status: 404 });

export const manejadoresProveedores = [
    http.get(construirUrl("/proveedores"), async () => {
        await delay();
        return HttpResponse.json({ data: proveedores });
    }),
    http.post(construirUrl("/proveedores"), async ({ request }) => {
        await delay();
        const datos = (await request.json()) as DatosProveedor;
        const nuevo: Proveedor = {
            id: Math.max(0, ...proveedores.map((p) => p.idproveedor)) + 1,
            idproveedor: Math.max(0, ...proveedores.map((p) => p.idproveedor)) + 1,
            ...datos,
            _count: { servicios: 0 },
        };
        proveedores = [...proveedores, nuevo];
        return HttpResponse.json(
            { mensaje: "Proveedor registrado exitosamente", data: nuevo },
            { status: 201 },
        );
    }),
    http.put(construirUrl("/proveedores/:id"), async ({ params, request }) => {
        await delay();
        const id = Number(params.id);
        const existente = proveedores.find((p) => p.idproveedor === id);
        if (!existente) return respuestaNoEncontrado();
        const datos = (await request.json()) as Partial<DatosProveedor>;
        const actualizado: Proveedor = { ...existente, ...datos };
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor modificado exitosamente", data: actualizado });
    }),
    http.patch(construirUrl("/proveedores/:id/baja"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const existente = proveedores.find((p) => p.idproveedor === id);
        if (!existente) return respuestaNoEncontrado();
        const actualizado = { ...existente, estado: "INACTIVO" as const };
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor dado de baja exitosamente", data: actualizado });
    }),
];
