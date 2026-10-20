import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type {
    DetalleSalidaGuia,
    RegistrarAvancePayload,
    RegistrarIncidentePayload,
    SalidaGuiaResumen,
} from "../../services/guiaService";
import { exigirRol } from "../autorizacion";
import {
    detallesSalidasGuiaSemilla,
    salidasGuiaSemilla,
} from "../datos/guia";

const salidas: SalidaGuiaResumen[] = [...salidasGuiaSemilla];
const detallesSalidas: Record<number, DetalleSalidaGuia> = JSON.parse(
    JSON.stringify(detallesSalidasGuiaSemilla),
);

let contadorAvance = 10;
let contadorIncidente = 10;

export const manejadoresGuia = [
    // GET /api/guia/salidas (CU-48)
    http.get(construirUrl("/guia/salidas"), async ({ request }) => {
        await delay();
        const falloAuth = exigirRol(request, "GUIA");
        if (falloAuth) return falloAuth;

        return HttpResponse.json({ data: salidas });
    }),

    // GET /api/guia/salidas/:idsalida (CU-48)
    http.get(construirUrl("/guia/salidas/:idsalida"), async ({ request, params }) => {
        await delay();
        const falloAuth = exigirRol(request, "GUIA");
        if (falloAuth) return falloAuth;

        const idsalida = Number(params.idsalida);
        const detalle = detallesSalidas[idsalida];
        if (!detalle) {
            return HttpResponse.json(
                { error: "La salida no existe o no estás asignado a ella." },
                { status: 404 },
            );
        }

        return HttpResponse.json({ data: detalle });
    }),

    // GET /api/guia/salidas/:idsalida/pasajeros (CU-50 FA1)
    http.get(
        construirUrl("/guia/salidas/:idsalida/pasajeros"),
        async ({ request, params }) => {
            await delay();
            const falloAuth = exigirRol(request, "GUIA");
            if (falloAuth) return falloAuth;

            const idsalida = Number(params.idsalida);
            const detalle = detallesSalidas[idsalida];
            if (!detalle) {
                return HttpResponse.json(
                    { error: "La salida no existe." },
                    { status: 404 },
                );
            }

            const pasajeros = detalle.nomina.map((p) => ({
                idpasajero: p.idpasajero,
                nombreCompleto: p.nombreCompleto,
                nroPasaporte: p.nroPasaporte,
            }));

            return HttpResponse.json({ data: pasajeros });
        },
    ),

    // POST /api/guia/salidas/:idsalida/avances (CU-49)
    http.post(
        construirUrl("/guia/salidas/:idsalida/avances"),
        async ({ request, params }) => {
            await delay();
            const falloAuth = exigirRol(request, "GUIA");
            if (falloAuth) return falloAuth;

            const idsalida = Number(params.idsalida);
            const detalle = detallesSalidas[idsalida];
            if (!detalle) {
                return HttpResponse.json(
                    { error: "La salida no existe." },
                    { status: 404 },
                );
            }

            const cuerpo = (await request.json()) as RegistrarAvancePayload;
            const { numeroOrden, estadoTramo, fechaHoraLlegada } = cuerpo;

            if (!numeroOrden || !estadoTramo || !fechaHoraLlegada) {
                return HttpResponse.json(
                    { error: "Datos incompletos para registrar el avance." },
                    { status: 400 },
                );
            }

            // Actualizar el itinerario en memoria
            const etapa = detalle.itinerario.find(
                (e) => e.numeroOrden === numeroOrden,
            );
            if (etapa) {
                etapa.estadoTramo = estadoTramo;
                etapa.fechaHoraLlegada = fechaHoraLlegada;
            }

            contadorAvance += 1;
            const avance = {
                idavance: contadorAvance,
                numeroOrden,
                estadoTramo,
                fechaHoraLlegada,
                fechaHoraReporte: new Date().toISOString(),
            };

            const todasCompletadas = detalle.itinerario.every(
                (e) => e.estadoTramo === "COMPLETADO",
            );
            if (todasCompletadas) {
                detalle.salida.estado = "FINALIZADA";
            } else {
                detalle.salida.estado = "EN_CURSO";
            }

            // Actualizar la lista de salidas
            const salidaEnLista = salidas.find((s) => s.idsalida === idsalida);
            if (salidaEnLista) {
                salidaEnLista.estado = detalle.salida.estado;
            }

            return HttpResponse.json(
                {
                    mensaje: "Avance registrado correctamente",
                    data: {
                        avance,
                        salida: {
                            idsalida,
                            estado: detalle.salida.estado,
                            ultimaEtapaAlcanzada: numeroOrden,
                        },
                    },
                },
                { status: 201 },
            );
        },
    ),

    // POST /api/guia/salidas/:idsalida/incidentes (CU-50)
    http.post(
        construirUrl("/guia/salidas/:idsalida/incidentes"),
        async ({ request, params }) => {
            await delay();
            const falloAuth = exigirRol(request, "GUIA");
            if (falloAuth) return falloAuth;

            const idsalida = Number(params.idsalida);
            const detalle = detallesSalidas[idsalida];
            if (!detalle) {
                return HttpResponse.json(
                    { error: "La salida no existe." },
                    { status: 404 },
                );
            }

            const cuerpo = (await request.json()) as RegistrarIncidentePayload;
            const { tipoIncidente, descripcion, nivelGravedad, fechaHoraOcurrencia } =
                cuerpo;

            if (
                !tipoIncidente ||
                !descripcion ||
                !nivelGravedad ||
                !fechaHoraOcurrencia
            ) {
                return HttpResponse.json(
                    { error: "Datos incompletos para notificar el incidente." },
                    { status: 400 },
                );
            }

            if (descripcion.trim().length < 5 || descripcion.trim().length > 1000) {
                return HttpResponse.json(
                    { error: "La descripción debe tener entre 5 y 1000 caracteres." },
                    { status: 400 },
                );
            }

            contadorIncidente += 1;
            return HttpResponse.json(
                {
                    mensaje: "Incidente registrado y visible en el panel del administrador.",
                    data: {
                        idincidente: contadorIncidente,
                        idsalida,
                        tipoIncidente,
                        descripcion,
                        nivelGravedad,
                        fechaHoraOcurrencia,
                        fechaHoraReporte: new Date().toISOString(),
                        pasajerosAfectados: cuerpo.pasajerosAfectados ?? [],
                    },
                },
                { status: 201 },
            );
        },
    ),
];
