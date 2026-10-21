import { http, HttpResponse, delay } from "msw";
import { salidasMockIniciales } from "../datos/salidas";
import type { SalidaApi } from "../../services/salidaService";

const salidas: SalidaApi[] = structuredClone(salidasMockIniciales);

export const manejadoresSalidas = [
    // GET /api/salidas (CU-35)
    http.get("*/api/salidas", async ({ request }) => {
        await delay(150);
        const url = new URL(request.url);

        const idpaqueteParam = url.searchParams.get("idpaquete");
        const estadoParam = url.searchParams.get("estado");
        const desdeParam = url.searchParams.get("desde");
        const hastaParam = url.searchParams.get("hasta");
        const idguiaParam = url.searchParams.get("idguia");

        let fechaDesde: Date | undefined;
        let fechaHasta: Date | undefined;

        if (desdeParam) {
            fechaDesde = new Date(desdeParam);
            if (isNaN(fechaDesde.getTime())) {
                return HttpResponse.json(
                    { error: "desde debe ser una fecha válida (AAAA-MM-DD)" },
                    { status: 400 },
                );
            }
        }

        if (hastaParam) {
            fechaHasta = new Date(hastaParam);
            if (isNaN(fechaHasta.getTime())) {
                return HttpResponse.json(
                    { error: "hasta debe ser una fecha válida (AAAA-MM-DD)" },
                    { status: 400 },
                );
            }
        }

        if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
            return HttpResponse.json(
                { error: "desde no puede ser posterior a hasta" },
                { status: 400 },
            );
        }

        const idpaquete = idpaqueteParam ? Number(idpaqueteParam) : undefined;
        const idguia = idguiaParam ? Number(idguiaParam) : undefined;

        const resultado = salidas.filter((salida) => {
            if (idpaquete && salida.idpaquete !== idpaquete) {
                return false;
            }
            if (estadoParam && salida.estado !== estadoParam) {
                return false;
            }
            if (fechaDesde) {
                const inicioSalida = new Date(salida.fechaInicio);
                if (inicioSalida < fechaDesde) {
                    return false;
                }
            }
            if (fechaHasta) {
                const inicioSalida = new Date(salida.fechaInicio);
                const finDelDia = new Date(fechaHasta);
                finDelDia.setUTCHours(23, 59, 59, 999);
                if (inicioSalida > finDelDia) {
                    return false;
                }
            }
            if (idguia) {
                const tieneGuia = salida.personalAsignado.some(
                    (p) =>
                        p.idpersonal === idguia &&
                        (p.personal.rol.toLowerCase() === "guía" ||
                            p.personal.rol.toLowerCase() === "guia"),
                );
                if (!tieneGuia) {
                    return false;
                }
            }
            return true;
        });

        // Ordenar por fechaInicio ascendente según contrato
        resultado.sort(
            (a, b) =>
                new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime(),
        );

        return HttpResponse.json({ data: resultado });
    }),
];
