import { http, HttpResponse, delay } from "msw";
import { alojamientosSalidaMock, salidasMockIniciales } from "../datos/salidas";
import { paquetesIniciales } from "../datos/paquetes";
import { personalSemilla } from "../datos/personal";
import type {
    ItemDevolucionPayload,
    ItemEquipamientoAsignado,
    PanelLogistica,
    RecursoDisponibleEquipamiento,
    RecursoDisponibleTransporte,
    SalidaApi,
} from "../../services/salidaService";

const salidas: SalidaApi[] = structuredClone(salidasMockIniciales);
const devolucionesRegistradasMock = new Set<number>();

const equipamientoSalidasMock: Record<number, ItemEquipamientoAsignado[]> = {
    2: [
        {
            idservicio: 5,
            nombreServicio: "Carpa de alta montaña 4 estaciones",
            tipoEquipamiento: "Carpas",
            proveedor: "Andes Outdoor",
            cantidadAsignada: 4,
            stockActualDisponible: 12,
        },
        {
            idservicio: 6,
            nombreServicio: "Bolsa de dormir -10°C",
            tipoEquipamiento: "Bolsas de dormir",
            proveedor: "Andes Outdoor",
            cantidadAsignada: 8,
            stockActualDisponible: 20,
        },
    ],
};

// ---- FE-51: datos y ayudas de los manejadores de CU-37 a CU-40 ----
const proveedorMock = { idproveedor: 4, razonSocial: "Andes Outdoor" };
const equipamientosMock: RecursoDisponibleEquipamiento[] = [
    { idservicio: 5, nombreServicio: "Carpa de alta montaña 4 estaciones", localidad: "Cusco", costoBase: 25, proveedor: proveedorMock, disponibilidad: { tipoEquipamiento: "Carpas", cantidadDisponible: 12 } },
    { idservicio: 6, nombreServicio: "Bolsa de dormir -10°C", localidad: "Cusco", costoBase: 10, proveedor: proveedorMock, disponibilidad: { tipoEquipamiento: "Bolsas de dormir", cantidadDisponible: 20 } },
];
const transportesMock: RecursoDisponibleTransporte[] = [
    { idservicio: 3, nombreServicio: "Bus Cusco - Km 82", localidad: "Cusco", costoBase: 120, proveedor: { idproveedor: 2, razonSocial: "Trans Urubamba" }, disponibilidad: { capacidadVehiculo: 20, pasajerosConfirmados: 0 } },
];

const buscarSalida = (id: unknown) => salidas.find((s) => s.idsalida === Number(id));
const noExiste = () => HttpResponse.json({ error: "La salida no existe" }, { status: 404 });
const cabecera = (s: SalidaApi) => ({ idsalida: s.idsalida, nroSalida: s.nroSalida, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin });
const personaDe = (idpersonal: number) => {
    const p = personalSemilla.find((x) => x.idpersonal === idpersonal);
    return { nombreCompleto: p?.nombreCompleto ?? `Personal ${idpersonal}`, rol: p?.rol ?? "Porteador" };
};
const panelLogistica = (s: SalidaApi): PanelLogistica => {
    const transporte = s.servicios.find((x) => x.tipo === "TRANSPORTE");
    return {
        ...cabecera(s),
        estado: s.estado,
        equipamiento: (equipamientoSalidasMock[s.idsalida] ?? []).map((e) => ({
            idservicio: e.idservicio,
            nombreServicio: e.nombreServicio,
            tipoEquipamiento: e.tipoEquipamiento,
            cantidad: e.cantidadAsignada,
            proveedor: proveedorMock,
        })),
        transporte: transporte
            ? { idservicio: transporte.idservicio, nombreServicio: transporte.servicio.nombreServicio, comprobanteReserva: transporte.comprobanteReserva, proveedor: { idproveedor: 2, razonSocial: "Trans Urubamba" } }
            : null,
        requerimientosSinAsignar: [],
    };
};

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
            lugaresPorLiberar: 0,
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

    // POST /api/salidas/:idsalida/asignacion/liberar-sobrantes (CU-40 paso 12)
    http.post("*/api/salidas/:idsalida/asignacion/liberar-sobrantes", async ({ params }) => {
        await delay(200);
        const idsalida = Number(params.idsalida);
        const salida = salidas.find((s) => s.idsalida === idsalida);
        if (!salida) {
            return HttpResponse.json({ error: "La salida no existe" }, { status: 404 });
        }
        if (salida.estado !== "CERRADA" || !salida.idbloqueo) {
            return HttpResponse.json(
                { error: "La salida no tiene lugares sobrantes por liberar" },
                { status: 400 },
            );
        }
        const n = salida.lugaresPorLiberar ?? 0;
        salida.lugaresPorLiberar = 0;
        return HttpResponse.json({
            data: {
                lugaresLiberados: n,
            },
        });
    }),

    // GET /api/salidas/:idsalida/equipamiento-asignado (CU-41)
    http.get("*/api/salidas/:idsalida/equipamiento-asignado", async ({ params }) => {
        await delay(150);
        const idsalida = Number(params.idsalida);
        if (!Number.isInteger(idsalida) || idsalida <= 0) {
            return HttpResponse.json(
                { error: "idsalida debe ser un número entero." },
                { status: 400 },
            );
        }
        const salida = salidas.find((s) => s.idsalida === idsalida);
        if (!salida) {
            return HttpResponse.json(
                { error: `La salida #${idsalida} no existe.` },
                { status: 404 },
            );
        }

        const equipamientos = equipamientoSalidasMock[idsalida] ?? [];
        return HttpResponse.json({
            data: {
                idsalida: salida.idsalida,
                nroSalida: salida.nroSalida,
                estado: salida.estado,
                fechaFin: salida.fechaFin,
                equipamientos,
            },
        });
    }),

    // POST /api/salidas/:idsalida/devolucion-equipamiento (CU-41)
    http.post("*/api/salidas/:idsalida/devolucion-equipamiento", async ({ params, request }) => {
        await delay(250);
        const idsalida = Number(params.idsalida);
        if (!Number.isInteger(idsalida) || idsalida <= 0) {
            return HttpResponse.json(
                { error: "idsalida debe ser un número entero." },
                { status: 400 },
            );
        }

        const salida = salidas.find((s) => s.idsalida === idsalida);
        if (!salida) {
            return HttpResponse.json(
                { error: `La salida #${idsalida} no existe.` },
                { status: 404 },
            );
        }

        if (salida.estado === "CANCELADA") {
            return HttpResponse.json(
                {
                    error: "No se puede registrar la devolución de una salida cancelada (el equipamiento ya fue reintegrado al cancelar).",
                },
                { status: 400 },
            );
        }

        const ahora = new Date();
        const yaConcluyo = salida.estado === "FINALIZADA" || new Date(salida.fechaFin) <= ahora;
        if (!yaConcluyo) {
            return HttpResponse.json(
                {
                    error: "Solo se puede registrar la devolución del equipamiento de una salida concluida o en estado FINALIZADA.",
                },
                { status: 400 },
            );
        }

        if (devolucionesRegistradasMock.has(idsalida)) {
            return HttpResponse.json(
                {
                    error: `La devolución de equipamiento para la salida #${idsalida} ya fue registrada previamente.`,
                },
                { status: 400 },
            );
        }

        const equipamientos = equipamientoSalidasMock[idsalida] ?? [];
        if (equipamientos.length === 0) {
            return HttpResponse.json(
                {
                    error: `La salida #${idsalida} no tenía equipamiento de camping asignado.`,
                },
                { status: 400 },
            );
        }

        let body: { items?: unknown; observacionesGenerales?: unknown };
        try {
            body = (await request.json()) as {
                items?: unknown;
                observacionesGenerales?: unknown;
            };
        } catch {
            return HttpResponse.json(
                { error: "Debe enviar una lista de items a devolver (items)." },
                { status: 400 },
            );
        }

        const itemsRaw = body?.items;
        if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
            return HttpResponse.json(
                { error: "Debe enviar una lista de items a devolver (items)." },
                { status: 400 },
            );
        }

        const items = itemsRaw as ItemDevolucionPayload[];

        const mapaAsignados = new Map<number, number>();
        for (const eq of equipamientos) {
            mapaAsignados.set(eq.idservicio, eq.cantidadAsignada);
        }

        const idsVistos = new Set<number>();
        for (const it of items) {
            const idservicio = Number(it.idservicio);
            if (!Number.isInteger(idservicio) || idservicio <= 0) {
                return HttpResponse.json(
                    { error: "idservicio debe ser un número entero mayor a 0." },
                    { status: 400 },
                );
            }
            if (idsVistos.has(idservicio)) {
                return HttpResponse.json(
                    { error: `El servicio #${idservicio} está duplicado en la lista de devolución.` },
                    { status: 400 },
                );
            }
            idsVistos.add(idservicio);

            const buenEstado = Number(it.cantidadBuenEstado ?? 0);
            const daniada = Number(it.cantidadDaniada ?? 0);

            if (buenEstado < 0 || daniada < 0) {
                return HttpResponse.json(
                    { error: `Las cantidades del servicio #${idservicio} deben ser mayores o iguales a 0.` },
                    { status: 400 },
                );
            }

            if (buenEstado === 0 && daniada === 0) {
                return HttpResponse.json(
                    { error: `El servicio #${idservicio} debe devolver al menos una unidad (en buen estado o dañada).` },
                    { status: 400 },
                );
            }

            const cantidadAsignada = mapaAsignados.get(idservicio);
            if (cantidadAsignada === undefined) {
                return HttpResponse.json(
                    { error: `El servicio #${idservicio} no formaba parte del equipamiento asignado a la salida #${idsalida}.` },
                    { status: 400 },
                );
            }

            if (buenEstado + daniada > cantidadAsignada) {
                return HttpResponse.json(
                    { error: `La cantidad devuelta para el servicio #${idservicio} (${buenEstado + daniada}) supera la cantidad que la salida tenía asignada (${cantidadAsignada}).` },
                    { status: 400 },
                );
            }

            if (typeof it.observaciones === "string" && it.observaciones.trim().length > 250) {
                return HttpResponse.json(
                    { error: `Las observaciones del item #${idservicio} no pueden superar los 250 caracteres.` },
                    { status: 400 },
                );
            }
        }

        if (typeof body.observacionesGenerales === "string" && body.observacionesGenerales.trim().length > 500) {
            return HttpResponse.json(
                { error: "observacionesGenerales no puede superar los 500 caracteres." },
                { status: 400 },
            );
        }

        devolucionesRegistradasMock.add(idsalida);

        return HttpResponse.json({
            mensaje: "Devolución de equipamiento registrada y stock reintegrado exitosamente.",
            data: {
                idsalida,
                auditoriaId: 900 + idsalida,
                detalle: items.map((it: ItemDevolucionPayload) => ({
                    idservicio: Number(it.idservicio),
                    cantidadReintegradaAlStock: Number(it.cantidadBuenEstado ?? 0),
                    cantidadDaniadaOExtraviada: Number(it.cantidadDaniada ?? 0),
                    observaciones: it.observaciones ? String(it.observaciones).trim() : null,
                })),
            },
        });
    }),
    // ---- FE-51: lo mínimo de CU-37 a CU-40 para que esas pantallas funcionen con mocks (misma forma que el back) ----

    // GET /api/salidas/:idsalida/asignacion (CU-40)
    http.get("*/api/salidas/:idsalida/asignacion", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const vendidos = salida.tamanoMaximo - salida.stockLocal;
        const asignados = new Set(salida.personalAsignado.map((a) => a.idpersonal));
        return HttpResponse.json({
            data: {
                salida: cabecera(salida),
                pasajerosConfirmados: vendidos,
                dotacionRequerida: { guias: 2, porteadores: Math.ceil(vendidos / 2) },
                bloqueoInicial: salida.tamanoMaximo,
                lugaresSobrantes: salida.stockLocal,
                personalDisponible: personalSemilla
                    .filter((p) => p.estado === "ACTIVO" && !asignados.has(p.idpersonal))
                    .map((p) => ({ idpersonal: p.idpersonal, nombreCompleto: p.nombreCompleto, rol: p.rol })),
                transportesDisponibles: transportesMock.map((t) => ({
                    idservicio: t.idservicio,
                    nombreServicio: t.nombreServicio,
                    capacidadVehiculo: t.disponibilidad.capacidadVehiculo,
                })),
                stockCamping: equipamientosMock.map((e) => ({
                    idservicio: e.idservicio,
                    nombreServicio: e.nombreServicio,
                    tipoEquipamiento: e.disponibilidad.tipoEquipamiento,
                    cantidadDisponible: e.disponibilidad.cantidadDisponible,
                })),
            },
        });
    }),

    // POST /api/salidas/:idsalida/asignacion (CU-40)
    http.post("*/api/salidas/:idsalida/asignacion", async ({ params, request }) => {
        await delay(250);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const { personalIds = [] } = (await request.json()) as { personalIds?: number[] };
        const vendidos = salida.tamanoMaximo - salida.stockLocal;
        const lugaresLiberados = salida.stockLocal;
        salida.personalAsignado = personalIds.map((idpersonal) => ({
            idsalida: salida.idsalida,
            idpersonal,
            personal: personaDe(idpersonal),
        }));
        salida.estado = "CERRADA";
        salida.stockLocal = 0;
        return HttpResponse.json({
            mensaje: "Asignación confirmada y permisos de la nómina emitidos",
            data: { salida, permisosEmitidos: vendidos + personalIds.length, rechazados: [], lugaresLiberados },
        });
    }),

    // GET /api/salidas/:idsalida/personal (CU-38)
    http.get("*/api/salidas/:idsalida/personal", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        return HttpResponse.json({
            data: {
                salida: { ...cabecera(salida), estado: salida.estado },
                personal: salida.personalAsignado.map((a) => ({
                    idpersonal: a.idpersonal,
                    nombreCompleto: a.personal.nombreCompleto,
                    rol: a.personal.rol,
                    permiso: `PER-MOCK-${salida.idsalida}-${a.idpersonal}`,
                })),
                servicios: salida.servicios.map((s) => ({ tipo: s.tipo, nombreServicio: s.servicio.nombreServicio })),
                equipamiento: (equipamientoSalidasMock[salida.idsalida] ?? []).map((e) => ({
                    nombreServicio: e.nombreServicio,
                    cantidad: e.cantidadAsignada,
                })),
            },
        });
    }),

    // GET /api/salidas/:idsalida/personal/:idpersonal/reemplazantes (CU-38)
    http.get("*/api/salidas/:idsalida/personal/:idpersonal/reemplazantes", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const original = salida.personalAsignado.find((a) => a.idpersonal === Number(params.idpersonal));
        if (!original) {
            return HttpResponse.json({ error: "Esa persona no está asignada a la salida" }, { status: 400 });
        }
        const asignados = new Set(salida.personalAsignado.map((a) => a.idpersonal));
        return HttpResponse.json({
            data: personalSemilla
                .filter((p) => p.estado === "ACTIVO" && p.rol === original.personal.rol && !asignados.has(p.idpersonal))
                .map((p) => ({ idpersonal: p.idpersonal, nombreCompleto: p.nombreCompleto, rol: p.rol })),
        });
    }),

    // POST /api/salidas/:idsalida/reemplazos (CU-38)
    http.post("*/api/salidas/:idsalida/reemplazos", async ({ params, request }) => {
        await delay(250);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const { idoriginal, idreemplazante } = (await request.json()) as { idoriginal: number; idreemplazante: number };
        const asignacion = salida.personalAsignado.find((a) => a.idpersonal === idoriginal);
        if (!asignacion) {
            return HttpResponse.json({ error: "Esa persona no está asignada a la salida" }, { status: 400 });
        }
        const sale = { idpersonal: idoriginal, nombreCompleto: asignacion.personal.nombreCompleto };
        asignacion.idpersonal = idreemplazante;
        asignacion.personal = personaDe(idreemplazante);
        return HttpResponse.json({
            mensaje: "Reemplazo registrado",
            data: {
                sale,
                entra: { idpersonal: idreemplazante, nombreCompleto: asignacion.personal.nombreCompleto },
                permisoDadoDeBaja: `PER-MOCK-${salida.idsalida}-${idoriginal}`,
                permisoNuevo: `PER-MOCK-${salida.idsalida}-${idreemplazante}`,
            },
        });
    }),

    // GET /api/salidas/:idsalida/logistica/disponibles?tipo= (CU-39)
    http.get("*/api/salidas/:idsalida/logistica/disponibles", async ({ request }) => {
        await delay(150);
        const tipo = new URL(request.url).searchParams.get("tipo");
        return HttpResponse.json({ data: tipo === "TRANSPORTE" ? transportesMock : equipamientosMock });
    }),

    // GET /api/salidas/:idsalida/logistica (CU-39)
    http.get("*/api/salidas/:idsalida/logistica", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        return HttpResponse.json({ data: panelLogistica(salida) });
    }),

    // PUT /api/salidas/:idsalida/logistica (CU-39)
    http.put("*/api/salidas/:idsalida/logistica", async ({ params, request }) => {
        await delay(250);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const { itemsDesasignar = [], itemsNuevos = [] } = (await request.json()) as {
            itemsDesasignar?: { tipo: string; idservicio: number }[];
            itemsNuevos?: { tipo: string; idservicio: number; cantidad?: number }[];
        };
        const quitados = new Set(itemsDesasignar.filter((i) => i.tipo === "EQUIPAMIENTO").map((i) => i.idservicio));
        const lista = (equipamientoSalidasMock[salida.idsalida] ?? []).filter((e) => !quitados.has(e.idservicio));
        for (const nuevo of itemsNuevos.filter((i) => i.tipo === "EQUIPAMIENTO")) {
            const eq = equipamientosMock.find((e) => e.idservicio === nuevo.idservicio);
            if (!eq) continue;
            lista.push({
                idservicio: eq.idservicio,
                nombreServicio: eq.nombreServicio,
                tipoEquipamiento: eq.disponibilidad.tipoEquipamiento ?? "",
                proveedor: eq.proveedor.razonSocial,
                cantidadAsignada: nuevo.cantidad ?? 1,
                stockActualDisponible: eq.disponibilidad.cantidadDisponible,
            });
        }
        equipamientoSalidasMock[salida.idsalida] = lista;
        return HttpResponse.json({
            mensaje: "Logística modificada",
            data: { panel: panelLogistica(salida), advertencias: [] },
        });
    }),

    // GET /api/salidas/:idsalida/cancelacion (CU-37)
    http.get("*/api/salidas/:idsalida/cancelacion", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        if (salida.estado === "CANCELADA") {
            return HttpResponse.json({ error: "La salida ya se encuentra cancelada" }, { status: 400 });
        }
        const vendidos = salida.tamanoMaximo - salida.stockLocal;
        return HttpResponse.json({
            data: {
                idsalida: salida.idsalida,
                nroSalida: salida.nroSalida,
                paquete: salida.paquete?.nombrePaquete ?? "",
                fechaInicio: salida.fechaInicio,
                reservasAfectadas: vendidos > 0 ? 1 : 0,
                totalAReembolsar: vendidos * 650,
                permisosQuePasanAPerdido: salida.estado === "CERRADA" ? vendidos + salida.personalAsignado.length : 0,
                recursosQueSeLiberan: {
                    personal: salida.personalAsignado.length,
                    equipamiento: (equipamientoSalidasMock[salida.idsalida] ?? []).length,
                    servicios: salida.servicios.length,
                },
                notificaAClientes: vendidos > 0,
            },
        });
    }),

    // POST /api/salidas/:idsalida/cancelar (CU-37)
    http.post("*/api/salidas/:idsalida/cancelar", async ({ params }) => {
        await delay(250);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const vendidos = salida.tamanoMaximo - salida.stockLocal;
        salida.estado = "CANCELADA";
        return HttpResponse.json({
            mensaje: "Salida cancelada",
            data: {
                idsalida: salida.idsalida,
                nroSalida: salida.nroSalida,
                estado: "CANCELADA",
                reservasCanceladas: vendidos > 0 ? 1 : 0,
                reembolsoTotal: vendidos * 650,
                notificaciones: { enviadas: vendidos > 0 ? 1 : 0, fallidas: 0, salidasAlternativasOfrecidas: 0 },
            },
        });
    }),
];
