import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import {
    esquemaProveedor,
    tiposProveedor,
    type DatosProveedor,
    type Proveedor,
} from "../../services/proveedorService";
import { exigirRol } from "../autorizacion";
import {
    proveedoresConSalidasActivas,
    proveedoresConSolicitudesPendientes,
    proveedoresSemilla,
} from "../datos/proveedores";
import { serviciosSemilla } from "../datos/servicios";

let proveedores: Proveedor[] = [...proveedoresSemilla];

const respuestaNoEncontrado = () =>
    HttpResponse.json({ error: "El proveedor no existe." }, { status: 404 });

const respuestaInvalida = (error: string) =>
    HttpResponse.json({ error }, { status: 400 });

/** Interpreta el parámetro de ruta; null si no es un entero positivo. */
const leerId = (valor: unknown): number | null => {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
};

/** Reglas de la baja (CU-17); devuelve el mensaje de error o null si puede darse de baja. */
function motivoBloqueoBaja(idproveedor: number): string | null {
    if (proveedoresConSolicitudesPendientes.has(idproveedor)) {
        return "Error. El proveedor tiene solicitudes pendientes";
    }
    if (proveedoresConSalidasActivas.has(idproveedor)) {
        return "Error. El proveedor cuenta con salidas activas";
    }
    return null;
}

const tieneServicios = (idproveedor: number) =>
    serviciosSemilla.some((servicio) => servicio.idproveedor === idproveedor);

const mismaRazonYLocalidad = (a: Pick<Proveedor, "razonSocial" | "localidad">, b: typeof a) =>
    a.razonSocial.toLowerCase() === b.razonSocial.toLowerCase() &&
    a.localidad.toLowerCase() === b.localidad.toLowerCase();

export const manejadoresProveedores = [
    http.get(construirUrl("/proveedores"), async ({ request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const parametros = new URL(request.url).searchParams;
        const tipo = parametros.get("tipoProveedor");
        const localidad = parametros.get("localidad");
        const estado = parametros.get("estado");
        if (tipo && !(tiposProveedor as readonly string[]).includes(tipo)) {
            return respuestaInvalida("El tipo de proveedor no es válido.");
        }
        if (estado && estado !== "ACTIVO" && estado !== "INACTIVO") {
            return respuestaInvalida("El estado no es válido.");
        }
        const filtrados = proveedores.filter(
            (proveedor) =>
                (!tipo || proveedor.tipoProveedor === tipo) &&
                (!estado || proveedor.estado === estado) &&
                (!localidad ||
                    proveedor.localidad.toLowerCase().includes(localidad.toLowerCase())),
        );
        return HttpResponse.json({ data: filtrados });
    }),
    http.get(construirUrl("/proveedores/:id"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) return respuestaInvalida("ID inválido.");
        const proveedor = proveedores.find((item) => item.idproveedor === id);
        if (!proveedor) return respuestaNoEncontrado();
        return HttpResponse.json({ data: proveedor });
    }),
    http.post(construirUrl("/proveedores"), async ({ request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const cuerpo = (await request.json()) as Partial<DatosProveedor>;
        const datosConEstado = { estado: "ACTIVO" as const, ...cuerpo };
        const validacion = esquemaProveedor.safeParse(datosConEstado);
        if (!validacion.success) {
            return respuestaInvalida(validacion.error.issues[0]?.message ?? "Datos inválidos.");
        }
        const datos = validacion.data;
        const duplicado = proveedores.some(
            (proveedor) => proveedor.estado === "ACTIVO" && mismaRazonYLocalidad(proveedor, datos),
        );
        if (duplicado) {
            return respuestaInvalida(
                `Ya existe un proveedor activo "${datos.razonSocial}" en ${datos.localidad}.`,
            );
        }
        const nuevo: Proveedor = {
            idproveedor: Math.max(0, ...proveedores.map((p) => p.idproveedor)) + 1,
            ...datos,
        };
        proveedores = [...proveedores, nuevo];
        return HttpResponse.json(
            { mensaje: "Proveedor registrado exitosamente", data: nuevo },
            { status: 201 },
        );
    }),
    http.put(construirUrl("/proveedores/:id"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) return respuestaInvalida("ID inválido.");
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
        const actualizado: Proveedor = { ...existente, ...datos };

        if (datos.tipoProveedor && datos.tipoProveedor !== existente.tipoProveedor && tieneServicios(id)) {
            return respuestaInvalida(
                "No se puede cambiar el tipo de un proveedor que ya tiene servicios registrados.",
            );
        }
        if (existente.estado === "ACTIVO" && actualizado.estado === "INACTIVO") {
            const bloqueo = motivoBloqueoBaja(id);
            if (bloqueo) return respuestaInvalida(bloqueo);
        }
        if (actualizado.estado === "ACTIVO") {
            const duplicado = proveedores.some(
                (proveedor) =>
                    proveedor.idproveedor !== id &&
                    proveedor.estado === "ACTIVO" &&
                    mismaRazonYLocalidad(proveedor, actualizado),
            );
            if (duplicado) {
                return respuestaInvalida(
                    `Ya existe un proveedor activo "${actualizado.razonSocial}" en ${actualizado.localidad}.`,
                );
            }
        }
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor modificado exitosamente", data: actualizado });
    }),
    http.patch(construirUrl("/proveedores/:id/baja"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) return respuestaInvalida("ID inválido.");
        const existente = proveedores.find((p) => p.idproveedor === id);
        if (!existente) return respuestaNoEncontrado();
        if (existente.estado === "INACTIVO") {
            return respuestaInvalida("El proveedor ya se encuentra dado de baja.");
        }
        const bloqueo = motivoBloqueoBaja(id);
        if (bloqueo) return respuestaInvalida(bloqueo);
        const actualizado = { ...existente, estado: "INACTIVO" as const };
        proveedores = proveedores.map((p) => (p.idproveedor === id ? actualizado : p));
        return HttpResponse.json({ mensaje: "Proveedor dado de baja exitosamente", data: actualizado });
    }),
];
