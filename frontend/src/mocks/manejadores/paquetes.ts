import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type {
    DatosCrearPaquete,
    DatosModificarPaquete,
} from "../../services/paqueteService";
import { circuitosIniciales } from "../datos/circuitos";
import { paquetesIniciales, type PaqueteMock } from "../datos/paquetes";
import { temporadasIniciales } from "../datos/temporadas";

let paquetes: PaqueteMock[] = [...paquetesIniciales];
let proximoId =
    Math.max(0, ...paquetes.map((paquete) => paquete.idpaquete)) + 1;

function respuestaError(mensajeError: string, status: number) {
    return HttpResponse.json(
        { error: mensajeError, mensaje: mensajeError },
        { status },
    );
}

export const manejadoresPaquetes = [
    // CU-10: GET /api/paquetes
    http.get(construirUrl("/paquetes"), async () => {
        await delay(150);
        const activos = paquetes.filter(
            (paquete) => paquete.estado === "ACTIVO",
        );
        return HttpResponse.json({ data: activos });
    }),

    // GET /api/paquetes/:id
    http.get(construirUrl("/paquetes/:id"), async ({ params }) => {
        await delay(150);
        const id = Number(params.id);
        const paquete = paquetes.find(
            (item) => item.idpaquete === id && item.estado === "ACTIVO",
        );
        if (!paquete) {
            return respuestaError(
                "Paquete no encontrado o inactivo.",
                404,
            );
        }
        return HttpResponse.json({ data: paquete });
    }),

    // CU-11: POST /api/paquetes
    http.post(construirUrl("/paquetes"), async ({ request }) => {
        await delay(200);
        const cuerpo = (await request.json()) as Partial<DatosCrearPaquete>;

        if (!cuerpo.nombrePaquete?.trim()) {
            return respuestaError("nombrePaquete es requerido.", 400);
        }
        if (!cuerpo.idcircuito) {
            return respuestaError("idcircuito es requerido.", 400);
        }
        if (
            !Array.isArray(cuerpo.matrizPrecios) ||
            cuerpo.matrizPrecios.length === 0
        ) {
            return respuestaError(
                "La matriz de precios es obligatoria y debe contener al menos una tarifa.",
                400,
            );
        }

        const id = proximoId++;
        const nroPaquete = `PKG-${String(id).padStart(4, "0")}`;
        const circuito = circuitosIniciales.find(
            (c) => c.idcircuito === cuerpo.idcircuito,
        );

        const nuevo: PaqueteMock = {
            idpaquete: id,
            idcircuito: cuerpo.idcircuito,
            nroPaquete,
            nombrePaquete: cuerpo.nombrePaquete.trim(),
            condiciones: cuerpo.condiciones?.trim() || null,
            estado: "ACTIVO",
            tipoGarantia: cuerpo.tipoGarantia ?? "POR_CATEGORIA",
            localidadGarantizada: cuerpo.localidadGarantizada ?? null,
            categoriaGarantizada: cuerpo.categoriaGarantizada ?? null,
            tipoHabitacionGarantizada:
                cuerpo.tipoHabitacionGarantizada ?? null,
            nochesPrevias: cuerpo.nochesPrevias ?? 0,
            nochesPosteriores: cuerpo.nochesPosteriores ?? 0,
            diasDisponibles: cuerpo.diasDisponibles ?? null,
            tieneSalidasActivas: false,
            circuito,
            tarifas: cuerpo.matrizPrecios.map((t) => ({
                idpaquete: id,
                idtemporada: t.idtemporada,
                monto: t.monto,
                moneda: t.moneda,
                temporada: temporadasIniciales.find(
                    (temp) => temp.idtemporada === t.idtemporada,
                ),
            })),
        };

        paquetes = [...paquetes, nuevo];

        return HttpResponse.json(
            {
                mensaje: "Paquete turístico creado y publicado exitosamente",
                data: nuevo,
            },
            { status: 201 },
        );
    }),

    // CU-12: PUT /api/paquetes/:id
    http.put(construirUrl("/paquetes/:id"), async ({ params, request }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = paquetes.find(
            (item) => item.idpaquete === id && item.estado === "ACTIVO",
        );
        if (!actual) {
            return respuestaError(
                "Paquete no encontrado o inactivo.",
                404,
            );
        }

        const cuerpo = (await request.json()) as DatosModificarPaquete;
        const actualizado: PaqueteMock = {
            ...actual,
            nombrePaquete: cuerpo.nombrePaquete?.trim() ?? actual.nombrePaquete,
            condiciones:
                cuerpo.condiciones !== undefined
                    ? cuerpo.condiciones.trim() || null
                    : actual.condiciones,
            nochesPrevias:
                cuerpo.nochesPrevias !== undefined
                    ? cuerpo.nochesPrevias
                    : actual.nochesPrevias,
            nochesPosteriores:
                cuerpo.nochesPosteriores !== undefined
                    ? cuerpo.nochesPosteriores
                    : actual.nochesPosteriores,
            diasDisponibles:
                cuerpo.diasDisponibles !== undefined
                    ? cuerpo.diasDisponibles.trim() || null
                    : actual.diasDisponibles,
            tarifas: cuerpo.matrizPrecios
                ? cuerpo.matrizPrecios.map((t) => ({
                      idpaquete: id,
                      idtemporada: t.idtemporada,
                      monto: t.monto,
                      moneda: t.moneda,
                      temporada: temporadasIniciales.find(
                          (temp) => temp.idtemporada === t.idtemporada,
                      ),
                  }))
                : actual.tarifas,
        };

        paquetes = paquetes.map((item) =>
            item.idpaquete === id ? actualizado : item,
        );

        return HttpResponse.json({
            mensaje: "Paquete turístico modificado exitosamente",
            data: actualizado,
        });
    }),

    // CU-13: PATCH /api/paquetes/:id/baja
    http.patch(construirUrl("/paquetes/:id/baja"), async ({ params }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = paquetes.find(
            (item) => item.idpaquete === id && item.estado === "ACTIVO",
        );
        if (!actual) {
            return respuestaError(
                "Paquete no encontrado o ya inactivo.",
                404,
            );
        }
        if (actual.tieneSalidasActivas) {
            return respuestaError(
                "No se puede dar de baja porque tiene salidas activas (abiertas, cerradas o en curso).",
                400,
            );
        }

        const dadoDeBaja: PaqueteMock = {
            ...actual,
            estado: "INACTIVO",
        };

        paquetes = paquetes.map((item) =>
            item.idpaquete === id ? dadoDeBaja : item,
        );

        return HttpResponse.json({
            mensaje: "Paquete turístico dado de baja exitosamente",
            data: dadoDeBaja,
        });
    }),

    // POST / PUT /api/paquetes/:id/carrusel y /api/paquetes/:id/imagen
    http.post(
        construirUrl("/paquetes/:id/carrusel"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const formData = await request.formData();
            const archivos = [
                ...formData.getAll("imagenes"),
                ...formData.getAll("imagen"),
            ].filter((item): item is File => item instanceof File);

            if (archivos.length === 0) {
                return respuestaError(
                    "Debe adjuntar al menos una imagen en el campo 'imagenes'.",
                    400,
                );
            }
            const urls = archivos.slice(0, 5).map((archivo, idx) => {
                const ext =
                    archivo.name.split(".").pop()?.toLowerCase() || "jpg";
                const nombre =
                    idx === 0 ? `principal.${ext}` : `foto_${idx + 1}.${ext}`;
                return `/imagenes/paquetes/${id}/${nombre}`;
            });
            return HttpResponse.json({
                mensaje: `Carrusel subido exitosamente con ${urls.length} imagen(es).`,
                data: {
                    idpaquete: id,
                    totalImagenes: urls.length,
                    principal: urls[0],
                    carrusel: urls,
                },
            });
        },
    ),

    http.put(
        construirUrl("/paquetes/:id/carrusel"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const formData = await request.formData();
            const archivos = [
                ...formData.getAll("imagenes"),
                ...formData.getAll("imagen"),
            ].filter((item): item is File => item instanceof File);

            if (archivos.length === 0) {
                return respuestaError(
                    "Debe adjuntar al menos una imagen en el campo 'imagenes'.",
                    400,
                );
            }
            const urls = archivos.slice(0, 5).map((archivo, idx) => {
                const ext =
                    archivo.name.split(".").pop()?.toLowerCase() || "jpg";
                const nombre =
                    idx === 0 ? `principal.${ext}` : `foto_${idx + 1}.${ext}`;
                return `/imagenes/paquetes/${id}/${nombre}`;
            });
            return HttpResponse.json({
                mensaje: `Carrusel subido exitosamente con ${urls.length} imagen(es).`,
                data: {
                    idpaquete: id,
                    totalImagenes: urls.length,
                    principal: urls[0],
                    carrusel: urls,
                },
            });
        },
    ),

    http.put(
        construirUrl("/paquetes/:id/carrusel/:nombreFoto"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const nombreFoto = String(params.nombreFoto || "principal");
            const formData = await request.formData();
            const archivo = formData.get("imagen");
            if (!(archivo instanceof File)) {
                return respuestaError(
                    "Debe adjuntar el nuevo archivo de imagen en el campo 'imagen'.",
                    400,
                );
            }
            const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
            const url = `/imagenes/paquetes/${id}/${nombreFoto}.${ext}`;
            return HttpResponse.json({
                mensaje: `La foto '${nombreFoto}' fue reemplazada exitosamente.`,
                data: {
                    idpaquete: id,
                    fotoModificada: nombreFoto,
                    url,
                },
            });
        },
    ),

    http.delete(
        construirUrl("/paquetes/:id/carrusel/:nombreFoto"),
        async ({ params }) => {
            await delay(200);
            const id = Number(params.id);
            const nombreFoto = String(params.nombreFoto || "foto_2");
            return HttpResponse.json({
                mensaje: `La foto '${nombreFoto}' fue eliminada exitosamente.`,
                data: {
                    idpaquete: id,
                    fotoEliminada: nombreFoto,
                },
            });
        },
    ),
];
