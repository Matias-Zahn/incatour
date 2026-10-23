import { http, HttpResponse, delay } from "msw";
import { alojamientosSalidaMock, salidasMockIniciales } from "../datos/salidas";
import { paquetesIniciales } from "../datos/paquetes";
import type { SalidaApi } from "../../services/salidaService";

const salidas: SalidaApi[] = structuredClone(salidasMockIniciales);

export const manejadoresSalidas = [
    // GET /api/salidas (CU-35)
    http.get("*/api/salidas", async ({ request }) => {
        await delay(150);
        const url = new URL(request.url);

        const idpaqueteParam = url.searchParams.get("idpaquete");
        const idcircuitoParam = url.searchParams.get("idcircuito");
        const estadoParam = url.searchParams.get("estado");
        const desdeParam = url.searchParams.get("desde");
        const hastaParam = url.searchParams.get("hasta");
        const idguiaParam = url.searchParams.get("idguia");

        let idcircuito: number | undefined;
        if (idcircuitoParam) {
            const parsed = Number(idcircuitoParam);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                return HttpResponse.json(
                    { error: "idcircuito debe ser un número entero positivo" },
                    { status: 400 },
                );
            }
            idcircuito = parsed;
        }

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
            if (idcircuito && salida.paquete?.circuito?.idcircuito !== idcircuito) {
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

    // GET /api/salidas/opciones (CU-36)
    http.get("*/api/salidas/opciones", async ({ request }) => {
        await delay(150);
        const url = new URL(request.url);

        const idpaqueteParam = url.searchParams.get("idpaquete");
        const fechaInicioParam = url.searchParams.get("fechaInicio");
        const tamanoMaximoParam = url.searchParams.get("tamanoMaximo");
        const simular = url.searchParams.get("simular");

        const idpaquete = Number(idpaqueteParam);
        if (!Number.isInteger(idpaquete) || idpaquete <= 0) {
            return HttpResponse.json(
                { error: "idpaquete es requerido y debe ser un entero positivo" },
                { status: 400 },
            );
        }

        const tamanoMaximo = Number(tamanoMaximoParam);
        if (!Number.isInteger(tamanoMaximo) || tamanoMaximo <= 0) {
            return HttpResponse.json(
                { error: "tamanoMaximo es requerido y debe ser un entero positivo" },
                { status: 400 },
            );
        }

        if (
            !fechaInicioParam ||
            !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioParam) ||
            isNaN(new Date(fechaInicioParam).getTime())
        ) {
            return HttpResponse.json(
                { error: "fechaInicio es requerida y debe ser una fecha válida (AAAA-MM-DD)" },
                { status: 400 },
            );
        }

        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hoyIso = `${yyyy}-${mm}-${dd}`;
        if (fechaInicioParam <= hoyIso) {
            return HttpResponse.json(
                { error: "La fecha de inicio tiene que ser futura" },
                { status: 400 },
            );
        }

        const paquete = paquetesIniciales.find((p) => p.idpaquete === idpaquete);
        if (!paquete) {
            return HttpResponse.json({ error: "El paquete no existe" }, { status: 404 });
        }

        if (
            paquete.estado !== "ACTIVO" ||
            !paquete.circuito ||
            paquete.circuito.estado !== "ACTIVO"
        ) {
            return HttpResponse.json(
                { error: "El paquete o su circuito no están activos" },
                { status: 400 },
            );
        }

        const guias = paquete.circuito?.minimoGuias ?? 2;
        const porteadores = Math.ceil(tamanoMaximo / 2) * 1;
        const totalLugares = tamanoMaximo + guias + porteadores;

        let cupoAutoridad: { lugaresDisponibles: number; alcanza: boolean } | null;
        if (simular === "autoridad_caida" || fechaInicioParam.endsWith("-31")) {
            cupoAutoridad = null;
        } else if (
            simular === "cupo_insuficiente" ||
            fechaInicioParam.endsWith("-30") ||
            tamanoMaximo >= 490
        ) {
            cupoAutoridad = {
                lugaresDisponibles: Math.max(1, totalLugares - 4),
                alcanza: false,
            };
        } else {
            cupoAutoridad = {
                lugaresDisponibles: 500,
                alcanza: 500 >= totalLugares,
            };
        }

        let alojamientos: {
            idservicio: number;
            nombreServicio: string;
            localidad: string;
            categoria?: string | null;
            capacidadDisponible?: number | null;
            alcanza: boolean;
        }[] = [];
        if (idpaquete !== 3 && simular !== "sin_alojamiento") {
            alojamientos = alojamientosSalidaMock.map((a) => ({
                idservicio: a.idservicio,
                nombreServicio: a.nombreServicio,
                localidad: a.localidad,
                categoria: a.categoria,
                capacidadDisponible: a.capacidadDisponible,
                alcanza: (a.capacidadDisponible ?? 0) >= tamanoMaximo,
            }));
        }

        return HttpResponse.json({
            data: {
                paquete: {
                    idpaquete: paquete.idpaquete,
                    nombrePaquete: paquete.nombrePaquete,
                },
                tamanoMaximo,
                dotacion: { guias, porteadores },
                totalLugares,
                cupoAutoridad,
                alojamientos,
            },
        });
    }),

    // POST /api/salidas (CU-36)
    http.post("*/api/salidas", async ({ request }) => {
        await delay(200);
        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return HttpResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
        }

        const idpaquete = Number(body.idpaquete);
        if (!Number.isInteger(idpaquete) || idpaquete <= 0) {
            return HttpResponse.json(
                { error: "idpaquete es requerido y debe ser un entero positivo" },
                { status: 400 },
            );
        }

        const tamanoMaximo = Number(body.tamanoMaximo);
        if (!Number.isInteger(tamanoMaximo) || tamanoMaximo <= 0) {
            return HttpResponse.json(
                { error: "tamanoMaximo es requerido y debe ser un entero positivo" },
                { status: 400 },
            );
        }

        const fechaInicio = String(body.fechaInicio ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}/.test(fechaInicio)) {
            return HttpResponse.json(
                { error: "fechaInicio es requerida y debe ser una fecha válida (AAAA-MM-DD)" },
                { status: 400 },
            );
        }

        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hoyIso = `${yyyy}-${mm}-${dd}`;
        if (fechaInicio.slice(0, 10) <= hoyIso) {
            return HttpResponse.json(
                { error: "La fecha de inicio tiene que ser futura" },
                { status: 400 },
            );
        }

        const paquete = paquetesIniciales.find((p) => p.idpaquete === idpaquete);
        if (!paquete) {
            return HttpResponse.json({ error: "El paquete no existe" }, { status: 404 });
        }

        // FA2: Autoridad no disponible (503)
        if (fechaInicio.slice(0, 10).endsWith("-31") || body.simular === "autoridad_caida") {
            return HttpResponse.json(
                {
                    error: "No fue posible comunicarse con el servicio de la autoridad. Reintentá más tarde",
                },
                { status: 503 },
            );
        }

        const guias = paquete.circuito?.minimoGuias ?? 2;
        const porteadores = Math.ceil(tamanoMaximo / 2) * 1;
        const totalLugares = tamanoMaximo + guias + porteadores;

        // FA1: Cupo insuficiente ante la autoridad (400)
        if (
            fechaInicio.slice(0, 10).endsWith("-30") ||
            body.simular === "cupo_insuficiente" ||
            tamanoMaximo >= 490
        ) {
            const disponibles = Math.max(1, totalLugares - 4);
            return HttpResponse.json(
                {
                    error: `No hay cupo suficiente: la salida necesita ${totalLugares} lugares y hay ${disponibles} disponibles para esa fecha`,
                },
                { status: 400 },
            );
        }

        // Validación de alojamiento con bloqueo
        const conPlazas =
            idpaquete !== 3
                ? alojamientosSalidaMock.filter(
                      (a) => (a.capacidadDisponible ?? 0) >= tamanoMaximo,
                  )
                : [];

        const idalojamiento = body.idalojamiento
            ? Number(body.idalojamiento)
            : undefined;

        if (idalojamiento && !conPlazas.some((a) => a.idservicio === idalojamiento)) {
            return HttpResponse.json(
                {
                    error: "El alojamiento elegido no cumple la garantía del paquete, no confirma por bloqueo de plazas o no tiene capacidad suficiente",
                },
                { status: 400 },
            );
        }

        // FA3: si hay alojamientos con plazas suficientes, es obligatorio elegir uno
        if (!idalojamiento && conPlazas.length > 0) {
            return HttpResponse.json(
                {
                    error: "Hay alojamientos que confirman por bloqueo de plazas: elegí uno (idalojamiento)",
                },
                { status: 400 },
            );
        }

        // Creación exitosa de la salida
        const fechaInicioDate = new Date(fechaInicio.slice(0, 10) + "T08:00:00.000Z");
        const duracionDias = paquete.circuito?.duracionDias ?? 4;
        const fechaFinDate = new Date(
            fechaInicioDate.getTime() + (duracionDias - 1) * 24 * 60 * 60 * 1000,
        );
        fechaFinDate.setUTCHours(18, 0, 0, 0);

        const anio = fechaInicioDate.getUTCFullYear();
        const delAnio = salidas.filter((s) => s.nroSalida.startsWith(`SAL-${anio}-`)).length;
        const nroSalida = `SAL-${anio}-${String(delAnio + 1).padStart(3, "0")}`;
        const idbloqueo = `BLQ-MSW-${Date.now().toString(16).toUpperCase().slice(-8)}`;

        const hotelElegido = idalojamiento
            ? alojamientosSalidaMock.find((a) => a.idservicio === idalojamiento)
            : undefined;

        const nuevaSalida: SalidaApi = {
            idsalida: salidas.length + 100,
            idpaquete: paquete.idpaquete,
            nroSalida,
            idbloqueo,
            stockLocal: tamanoMaximo,
            stockLocalAlojamiento: idalojamiento ? tamanoMaximo : 0,
            tamanoMaximo,
            fechaInicio: fechaInicioDate.toISOString(),
            fechaFin: fechaFinDate.toISOString(),
            estado: "PUBLICADA",
            ultimaEtapaAlcanzada: null,
            paquete: {
                nroPaquete: paquete.nroPaquete,
                nombrePaquete: paquete.nombrePaquete,
                circuito: {
                    idcircuito: paquete.circuito?.idcircuito ?? 1,
                    nombreCircuito: paquete.circuito?.nombreCircuito ?? "Camino del Inca",
                    duracionDias,
                    _count: { etapas: duracionDias },
                },
            },
            personalAsignado: [],
            servicios:
                idalojamiento && hotelElegido
                    ? [
                          {
                              idsalida: salidas.length + 100,
                              idservicio: hotelElegido.idservicio,
                              tipo: "ALOJAMIENTO",
                              comprobanteReserva: null,
                              servicio: {
                                  nombreServicio: hotelElegido.nombreServicio,
                              },
                          },
                      ]
                    : [],
            pasajerosConfirmados: 0,
            cantidadPersonal: 0,
            guias: [],
            permisosFaltantes: 0,
            etapaEsperada: null,
            etapaInformada: null,
            etapaDesfasada: false,
            alertas: [],
        };

        salidas.unshift(nuevaSalida);

        return HttpResponse.json(
            {
                mensaje: "Salida creada y publicada exitosamente",
                data: {
                    salida: nuevaSalida,
                    dotacion: { guias, porteadores },
                    totalLugares,
                },
            },
            { status: 201 },
        );
    }),
];
