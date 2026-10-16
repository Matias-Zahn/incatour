import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import {
    esquemaProveedor,
    type DatosProveedor,
    type Proveedor,
} from "../../services/proveedorService";
import { proveedoresSemilla } from "../datos/proveedores";

let proveedores: Proveedor[] = [...proveedoresSemilla];

const respuestaNoEncontrado = () =>
    HttpResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });

const respuestaInvalida = (error: string) =>
    HttpResponse.json({ error }, { status: 400 });

export const manejadoresProveedores = [
    http.get(construirUrl("/proveedores"), async () => {
        await delay();
        return HttpResponse.json({ data: proveedores });
    }),
    http.get(construirUrl("/proveedores/:id"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const proveedor = proveedores.find((item) => item.idproveedor === id);
        if (!proveedor) return respuestaNoEncontrado();
        return HttpResponse.json({ data: proveedor });
    }),
    http.post(construirUrl("/proveedores"), async ({ request }) => {
        await delay();
        const cuerpo = (await request.json()) as Partial<DatosProveedor>;
        const datosConEstado = { estado: "ACTIVO" as const, ...cuerpo };
        const validacion = esquemaProveedor.safeParse(datosConEstado);
        if (!validacion.success) {
            return respuestaInvalida(validacion.error.issues[0]?.message ?? "Datos inválidos.");
        }
        const datos = validacion.data;
        const duplicado = proveedores.some(
            (proveedor) =>
                proveedor.estado === "ACTIVO" &&
                proveedor.razonSocial.toLowerCase() === datos.razonSocial.toLowerCase() &&
                proveedor.localidad.toLowerCase() === datos.localidad.toLowerCase(),
        );
        if (duplicado) {
            return respuestaInvalida(
                `Ya existe un proveedor activo "${datos.razonSocial}" en ${datos.localidad}.`,
            );
        }
        const nuevo: Proveedor = {
            id: Math.max(0, ...proveedores.map((p) => p.idproveedor)) + 1,
            idproveedor: Math.max(0, ...proveedores.map((p) => p.idproveedor)) + 1,
            ...datos,
            cantidadServicios: 0,
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
        const cuerpo = (await request.json()) as Partial<DatosProveedor>;
        const validacion = esquemaProveedor.partial().safeParse(cuerpo);
        if (!validacion.success || Object.keys(cuerpo).length === 0) {
            return respuestaInvalida(
                validacion.success
                    ? "Debe enviar al menos un campo para modificar."
                    : validacion.error.issues[0]?.message ?? "Datos inválidos.",
            );
        }
        const datos = validacion.data;
        const duplicado = proveedores.some(
            (proveedor) =>
                proveedor.idproveedor !== id &&
                proveedor.estado === "ACTIVO" &&
                (datos.razonSocial ?? existente.razonSocial).toLowerCase() ===
                    proveedor.razonSocial.toLowerCase() &&
                (datos.localidad ?? existente.localidad).toLowerCase() ===
                    proveedor.localidad.toLowerCase(),
        );
        if (duplicado) {
            return respuestaInvalida(
                `Ya existe un proveedor activo "${datos.razonSocial ?? existente.razonSocial}" en ${datos.localidad ?? existente.localidad}.`,
            );
        }
        const actualizado: Proveedor = { ...existente, ...datos };
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor modificado exitosamente", data: actualizado });
    }),
    http.patch(construirUrl("/proveedores/:id/baja"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const existente = proveedores.find((p) => p.idproveedor === id);
        if (!existente) return respuestaNoEncontrado();
        if (existente.estado === "INACTIVO") {
            return respuestaInvalida("El proveedor ya se encuentra dado de baja.");
        }
        const actualizado = { ...existente, estado: "INACTIVO" as const };
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor dado de baja exitosamente", data: actualizado });
    }),
];
