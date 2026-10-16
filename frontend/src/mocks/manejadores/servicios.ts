import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { DatosServicio, Servicio } from "../../services/servicioService";
import { serviciosSemilla } from "../datos/servicios";

let servicios: Servicio[] = [...serviciosSemilla];

export const manejadoresServicios = [
    http.get(construirUrl("/proveedores/:idproveedor/servicios"), async ({ params }) => {
        await delay();
        const idProveedor = Number(params.idproveedor);
        return HttpResponse.json({ data: servicios.filter((servicio) => servicio.idproveedor === idProveedor) });
    }),
    http.post(construirUrl("/proveedores/:idproveedor/servicios"), async ({ params, request }) => {
        await delay();
        const datos = (await request.json()) as DatosServicio;
        const id = Math.max(0, ...servicios.map((servicio) => servicio.id)) + 1;
        const idproveedor = Number(params.idproveedor);
        const nuevo: Servicio = { ...datos, id, idservicio: id, idproveedor, estado: "ACTIVO" };
        servicios = [...servicios, nuevo];
        return HttpResponse.json({ mensaje: "Servicio registrado exitosamente", data: nuevo }, { status: 201 });
    }),
    http.put(construirUrl("/servicios/:id"), async ({ params, request }) => {
        await delay();
        const id = Number(params.id);
        const existente = servicios.find((servicio) => servicio.id === id);
        if (!existente) return HttpResponse.json({ mensaje: "Servicio no encontrado." }, { status: 404 });
        const actualizado = { ...existente, ...(await request.json() as Partial<DatosServicio>) };
        servicios = servicios.map((servicio) => servicio.id === id ? actualizado : servicio);
        return HttpResponse.json({ mensaje: "Servicio modificado exitosamente", data: actualizado });
    }),
    http.patch(construirUrl("/servicios/:id/baja"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const existente = servicios.find((servicio) => servicio.id === id);
        if (!existente) return HttpResponse.json({ mensaje: "Servicio no encontrado." }, { status: 404 });
        const actualizado = { ...existente, estado: "INACTIVO" as const };
        servicios = servicios.map((servicio) => servicio.id === id ? actualizado : servicio);
        return HttpResponse.json({ mensaje: "Servicio dado de baja exitosamente", data: actualizado });
    }),
];
