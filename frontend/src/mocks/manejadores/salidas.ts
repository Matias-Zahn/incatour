import { http, HttpResponse, delay } from "msw";
import { salidasMockIniciales } from "../datos/salidas";
import { personalSemilla } from "../datos/personal";
import { obtenerPaquetesMock } from "./paquetes";
import { obtenerServiciosMock } from "./servicios";
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
    { idservicio: 2, nombreServicio: "Bus Cusco - Km 82", localidad: "Cusco", costoBase: 120, proveedor: { idproveedor: 2, razonSocial: "Trans Urubamba" }, disponibilidad: { capacidadVehiculo: 24, pasajerosConfirmados: 0 } },
    { idservicio: 3, nombreServicio: "Combi Valle Sagrado (14 plazas)", localidad: "Cusco", costoBase: 90, proveedor: { idproveedor: 2, razonSocial: "Trans Urubamba" }, disponibilidad: { capacidadVehiculo: 14, pasajerosConfirmados: 0 } },
];

const porteadoresExtrasMock = [
    { idpersonal: 101, nombreCompleto: "Diego Puma", rol: "Porteador", salidasEnElMes: 0 },
    { idpersonal: 102, nombreCompleto: "Ramiro Ccahuana", rol: "Porteador", salidasEnElMes: 1 },
    { idpersonal: 103, nombreCompleto: "Julio Huanca", rol: "Porteador", salidasEnElMes: 1 },
    { idpersonal: 104, nombreCompleto: "Humberto Apaza", rol: "Porteador", salidasEnElMes: 2 },
    { idpersonal: 105, nombreCompleto: "Félix Ticona", rol: "Porteador", salidasEnElMes: 2 },
    { idpersonal: 106, nombreCompleto: "Sandro Cusi", rol: "Porteador", salidasEnElMes: 3 },
];

const CODIGOS_DIA = ["D", "L", "M", "X", "J", "V", "S"] as const;
const NOMBRES_DIA = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"] as const;

function sumarDiasIso(iso: string, dias: number): string {
    const f = new Date(iso.slice(0, 10) + "T12:00:00Z");
    f.setUTCDate(f.getUTCDate() + dias);
    return f.toISOString().slice(0, 10);
}

function formatearDmy(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function diasPermitidosDeCadena(cadena: string): string[] {
    const limpia = cadena.trim().toUpperCase();
    if (!limpia || limpia === "TODOS") return ["L", "M", "X", "J", "V", "S", "D"];
    return limpia.split(/[-,\s]+/).filter(Boolean);
}

const buscarSalida = (id: unknown) => salidas.find((s) => s.idsalida === Number(id));
const noExiste = () => HttpResponse.json({ error: "La salida no existe" }, { status: 404 });
const cabecera = (s: SalidaApi) => ({ idsalida: s.idsalida, nroSalida: s.nroSalida, fechaInicio: s.fechaInicio, fechaFin: s.fechaFin });
const personaDe = (idpersonal: number) => {
    const p = personalSemilla.find((x) => x.idpersonal === idpersonal);
    if (p) return { nombreCompleto: p.nombreCompleto, rol: p.rol };
    const extra = porteadoresExtrasMock.find((x) => x.idpersonal === idpersonal);
    if (extra) return { nombreCompleto: extra.nombreCompleto, rol: extra.rol };
    return { nombreCompleto: `Personal ${idpersonal}`, rol: "Porteador" };
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

    // GET /api/salidas/opciones (CU-36 — §5.1)
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

        const paquete = obtenerPaquetesMock().find((p) => p.idpaquete === idpaquete);
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

        const diasCierreVenta = paquete.diasCierreVenta ?? 2;
        const hoy = new Date();
        const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
        const fechaLimiteMinima = sumarDiasIso(hoyIso, diasCierreVenta);
        if (fechaInicioParam <= fechaLimiteMinima) {
            return HttpResponse.json(
                {
                    error: `La salida tiene que empezar después del ${formatearDmy(fechaLimiteMinima)}: la venta cierra ${diasCierreVenta} ${diasCierreVenta === 1 ? "día" : "días"} antes del inicio`,
                },
                { status: 400 },
            );
        }

        const diaSemana = new Date(fechaInicioParam + "T12:00:00Z").getUTCDay();
        const codigoDia = CODIGOS_DIA[diaSemana]!;
        const nombreDia = NOMBRES_DIA[diaSemana]!;
        const diasPaquete = diasPermitidosDeCadena(paquete.diasDisponibles ?? "TODOS");
        if (!diasPaquete.includes(codigoDia)) {
            return HttpResponse.json(
                {
                    error: `El paquete no sale los ${nombreDia}: los días habilitados son ${diasPaquete.join(", ")}`,
                },
                { status: 400 },
            );
        }

        const duracionDias = paquete.circuito?.duracionDias ?? 4;
        const fechaFin = sumarDiasIso(fechaInicioParam, Math.max(0, duracionDias - 1));
        const guias = paquete.circuito?.minimoGuias ?? 1;
        const porteadores = Math.ceil(tamanoMaximo / 2);
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

        const noches = (paquete.nochesPrevias ?? 0) + (paquete.nochesPosteriores ?? 0);
        const plazasNecesarias = noches > 0 ? tamanoMaximo : 0;

        const serviciosActivos = obtenerServiciosMock().filter((s) => s.estado === "ACTIVO");
        const alojamientosDisponibles = serviciosActivos
            .filter(
                (s) =>
                    s.tipo === "ALOJAMIENTO" &&
                    (!paquete.localidadGarantizada ||
                        s.localidad.toLowerCase() ===
                            paquete.localidadGarantizada.toLowerCase()),
            )
            .map((a) => ({
                idservicio: a.idservicio,
                nombreServicio: a.nombreServicio,
                localidad: a.localidad,
                categoria: a.categoria ?? null,
                modalidadConfirmacion: (a.modalidadConfirmacion ?? "BLOQUEO_PLAZAS") as
                    | "BLOQUEO_PLAZAS"
                    | "A_SOLICITUD",
                capacidadDisponible:
                    a.modalidadConfirmacion === "A_SOLICITUD"
                        ? null
                        : (a.capacidadDisponible ?? 0),
            }));

        const alojamientos =
            plazasNecesarias > 0 && simular !== "sin_alojamiento"
                ? alojamientosDisponibles.map((a) => ({
                      ...a,
                      alcanza:
                          a.modalidadConfirmacion === "A_SOLICITUD"
                              ? true
                              : (a.capacidadDisponible ?? 0) >= plazasNecesarias,
                  }))
                : [];

        const servicioTransporte = paquete.servicios?.find(
            (s) => s.tipo === "TRANSPORTE",
        );
        const transportesServicios = serviciosActivos
            .filter((s) => s.tipo === "TRANSPORTE")
            .map((t) => ({
                idservicio: t.idservicio,
                nombreServicio: t.nombreServicio,
                capacidadVehiculo: t.capacidadVehiculo ?? 20,
            }));
        const idtransportePaquete =
            servicioTransporte?.idservicio ?? transportesServicios[0]?.idservicio ?? null;

        const transportes = transportesServicios.map((t) => ({
            idservicio: t.idservicio,
            nombreServicio: t.nombreServicio,
            capacidadVehiculo: t.capacidadVehiculo,
            delPaquete: t.idservicio === idtransportePaquete,
            libre: true,
            alcanza: t.capacidadVehiculo >= totalLugares,
        }));

        const guiasLibres = personalSemilla
            .filter(
                (p) =>
                    p.estado === "ACTIVO" &&
                    p.rol === "Guía" &&
                    (!p.fechaHabilitacion || p.fechaHabilitacion.slice(0, 10) >= fechaFin) &&
                    p.fechaVencimientoPasaporte.slice(0, 10) > fechaFin,
            )
            .map((p, idx) => ({
                idpersonal: p.idpersonal,
                nombreCompleto: p.nombreCompleto,
                rol: "Guía" as const,
                salidasEnElMes: idx,
            }))
            .sort((a, b) => a.salidasEnElMes - b.salidasEnElMes || a.nombreCompleto.localeCompare(b.nombreCompleto));

        const porteadoresLibres = [
            ...personalSemilla
                .filter(
                    (p) =>
                        p.estado === "ACTIVO" &&
                        p.rol === "Porteador" &&
                        p.fechaVencimientoPasaporte.slice(0, 10) > fechaFin,
                )
                .map((p, idx) => ({
                    idpersonal: p.idpersonal,
                    nombreCompleto: p.nombreCompleto,
                    rol: "Porteador" as const,
                    salidasEnElMes: idx,
                })),
            ...porteadoresExtrasMock.map((p) => ({
                ...p,
                rol: "Porteador" as const,
            })),
        ].sort((a, b) => a.salidasEnElMes - b.salidasEnElMes || a.nombreCompleto.localeCompare(b.nombreCompleto));

        const equipoPaquete = (paquete.servicios ?? []).filter(
            (s) => s.tipo === "EQUIPAMIENTO",
        );
        const equipo = (
            equipoPaquete.length > 0
                ? equipoPaquete.map((item) => ({
                      idservicio: item.idservicio,
                      nombreServicio: item.servicio?.nombreServicio ?? "Equipamiento",
                      tipoEquipamiento: item.servicio?.equipamiento?.tipoEquipamiento ?? "Camping",
                      cantidad: item.cantidad ?? 1,
                      cadaPasajeros: item.cadaPasajeros ?? 1,
                      stockLibre: 12,
                  }))
                : [
                      {
                          idservicio: 5,
                          nombreServicio: "Carpa de alta montaña 4 estaciones",
                          tipoEquipamiento: "Carpas",
                          cantidad: 1,
                          cadaPasajeros: 2,
                          stockLibre: 8,
                      },
                  ]
        ).map((eq) => {
            const necesitaCompleta = Math.ceil(tamanoMaximo / eq.cadaPasajeros) * eq.cantidad;
            const nivel: "OK" | "RIESGO" | "NO_ALCANZA" =
                eq.stockLibre >= necesitaCompleta
                    ? "OK"
                    : eq.stockLibre >= Math.ceil(necesitaCompleta * 0.5)
                      ? "RIESGO"
                      : "NO_ALCANZA";
            return {
                idservicio: eq.idservicio,
                nombreServicio: eq.nombreServicio,
                tipoEquipamiento: eq.tipoEquipamiento,
                cantidad: eq.cantidad,
                cadaPasajeros: eq.cadaPasajeros,
                necesitaCompleta,
                libre: eq.stockLibre,
                fechaCritica: nivel === "OK" ? null : fechaInicioParam,
                nivel,
            };
        });

        const servicioTren = paquete.servicios?.find((s) => s.tipo === "TREN");
        const tren = servicioTren
            ? {
                  idservicio: servicioTren.idservicio,
                  nombreServicio: servicioTren.servicio?.nombreServicio ?? "Tren",
                  horarioSalida: servicioTren.servicio?.tren?.horarioSalida ?? "06:10",
                  horarioLlegada: servicioTren.servicio?.tren?.horarioLlegada ?? "07:45",
                  diasOperacion: servicioTren.servicio?.tren?.diasOperacion ?? "L-M-X-J-V-S-D",
                  operaEseDia: true,
              }
            : null;

        const tarifaActual = paquete.tarifas?.[0];

        return HttpResponse.json({
            data: {
                paquete: {
                    idpaquete: paquete.idpaquete,
                    nombrePaquete: paquete.nombrePaquete,
                    idtransporte: idtransportePaquete,
                    diasCierreVenta,
                },
                fechaFin,
                tamanoMaximo,
                dotacion: { guias, porteadores },
                totalLugares,
                cupoAutoridad,
                tarifa: {
                    idtemporada: tarifaActual?.idtemporada ?? 1,
                    temporada: tarifaActual?.temporada?.nombre ?? "Temporada Alta",
                    monto: tarifaActual?.monto ?? 650,
                    moneda: tarifaActual?.moneda ?? "USD",
                },
                plazasNecesarias,
                alojamientos,
                transportes,
                personal: {
                    guias: guiasLibres,
                    porteadores: porteadoresLibres,
                },
                equipo,
                tren,
            },
        });
    }),

    // POST /api/salidas (CU-36 — §5.2 & §5.3)
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

        const paquete = obtenerPaquetesMock().find((p) => p.idpaquete === idpaquete);
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

        const alojamientosIds = Array.isArray(body.alojamientos)
            ? body.alojamientos.map(Number).filter((n) => Number.isInteger(n) && n > 0)
            : [];
        const idtransporte = Number(body.idtransporte);
        if (!Number.isInteger(idtransporte) || idtransporte <= 0) {
            return HttpResponse.json(
                { error: "idtransporte es requerido y debe ser un entero positivo" },
                { status: 400 },
            );
        }
        const personalIds = Array.isArray(body.personalIds)
            ? body.personalIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
            : [];

        const guiasMin = paquete.circuito?.minimoGuias ?? 1;
        const porteadoresMin = Math.ceil(tamanoMaximo / 2);

        const personalElegido = personalIds.map((id) => ({
            idpersonal: id,
            ...personaDe(id),
        }));
        const cantGuias = personalElegido.filter((p) => p.rol === "Guía").length;
        const cantPorteadores = personalElegido.filter((p) => p.rol === "Porteador").length;
        if (cantGuias < guiasMin || cantPorteadores < porteadoresMin) {
            return HttpResponse.json(
                {
                    error: `La salida necesita al menos ${guiasMin} guías y ${porteadoresMin} porteadores (elegiste ${cantGuias} y ${cantPorteadores})`,
                },
                { status: 400 },
            );
        }

        const totalLugares = tamanoMaximo + personalElegido.length;

        const serviciosActivosPost = obtenerServiciosMock().filter((s) => s.estado === "ACTIVO");
        const transporteElegido = serviciosActivosPost.find(
            (s) => s.tipo === "TRANSPORTE" && s.idservicio === idtransporte,
        );
        const capacidadTransporte = transporteElegido?.capacidadVehiculo ?? 0;
        if (transporteElegido && capacidadTransporte < totalLugares) {
            return HttpResponse.json(
                {
                    error: `El transporte elegido tiene ${capacidadTransporte} asientos y la salida necesita ${totalLugares} lugares (${tamanoMaximo} pasajeros y ${personalElegido.length} del personal)`,
                },
                { status: 400 },
            );
        }

        const noches = (paquete.nochesPrevias ?? 0) + (paquete.nochesPosteriores ?? 0);
        const hotelesElegidos = alojamientosIds
            .map((id) =>
                serviciosActivosPost.find(
                    (s) => s.tipo === "ALOJAMIENTO" && s.idservicio === id,
                ),
            )
            .filter((h): h is (typeof serviciosActivosPost)[number] => Boolean(h));
        if (noches > 0) {
            if (hotelesElegidos.length === 0) {
                return HttpResponse.json({ error: "Elegí al menos un hotel" }, { status: 400 });
            }
            const tieneASolicitud = hotelesElegidos.some(
                (h) => h.modalidadConfirmacion === "A_SOLICITUD",
            );
            const cubiertas = hotelesElegidos.reduce(
                (acc, h) => acc + (h.capacidadDisponible ?? 0),
                0,
            );
            if (!tieneASolicitud && cubiertas < tamanoMaximo) {
                return HttpResponse.json(
                    {
                        error: `Los hoteles elegidos cubren ${cubiertas} de ${tamanoMaximo} plazas en esas noches`,
                    },
                    { status: 400 },
                );
            }
        }

        const tieneASolicitud = hotelesElegidos.some(
            (h) => h.modalidadConfirmacion === "A_SOLICITUD",
        );
        const corteSugerido = Math.max(paquete.diasCierreVenta ?? 2, tieneASolicitud ? 5 : 0);
        const diasCierreVenta =
            typeof body.diasCierreVenta === "number" ? body.diasCierreVenta : corteSugerido;

        const hoy = new Date();
        const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
        const fechaLimiteMinima = sumarDiasIso(hoyIso, diasCierreVenta);
        if (fechaInicio.slice(0, 10) <= fechaLimiteMinima) {
            return HttpResponse.json(
                {
                    error: `La salida tiene que empezar después del ${formatearDmy(fechaLimiteMinima)}: la venta cierra ${diasCierreVenta} ${diasCierreVenta === 1 ? "día" : "días"} antes del inicio`,
                },
                { status: 400 },
            );
        }

        // Control equipo proyectado al 50% (409 con DetalleFaltaEquipo)
        if (tamanoMaximo > 24) {
            return HttpResponse.json(
                {
                    error: `No alcanza el equipo: el ${formatearDmy(fechaInicio)} hay 8 carpas libres y la salida necesita al menos ${Math.ceil(tamanoMaximo / 4)} (${Math.ceil(tamanoMaximo / 2)} si se vende completa). Probá con un máximo de 16 pasajeros`,
                    detalle: {
                        faltantes: [
                            {
                                idservicio: 5,
                                nombreServicio: "Carpa de alta montaña 4 estaciones",
                                fecha: fechaInicio.slice(0, 10),
                                libre: 8,
                                necesitaMinimo: Math.ceil(tamanoMaximo / 4),
                            },
                        ],
                        tamanoMaximoSugerido: 16,
                    },
                },
                { status: 409 },
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
        const nuevaId = salidas.length + 100;

        const ultimoDiaVenta = sumarDiasIso(fechaInicio.slice(0, 10), -(diasCierreVenta + 1));
        const advertencias: string[] = [];
        if (tamanoMaximo > 12) {
            advertencias.push(
                `Si se vende completa faltarían hasta ${Math.ceil(tamanoMaximo / 2) - 8} carpas el ${formatearDmy(fechaInicio)}`,
            );
        }

        const nuevaSalida: SalidaApi = {
            idsalida: nuevaId,
            idpaquete: paquete.idpaquete,
            nroSalida,
            idbloqueo,
            stockLocal: tamanoMaximo,
            stockLocalAlojamiento: hotelesElegidos.length > 0 ? tamanoMaximo : null,
            tamanoMaximo,
            fechaInicio: fechaInicioDate.toISOString(),
            fechaFin: fechaFinDate.toISOString(),
            estado: "PUBLICADA",
            lugaresPorLiberar: 0,
            ultimaEtapaAlcanzada: null,
            diasCierreVenta,
            ultimoDiaVenta,
            ventaAbierta: true,
            puedeConfirmar: false,
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
            personalAsignado: personalElegido.map((p) => ({
                idsalida: nuevaId,
                idpersonal: p.idpersonal,
                personal: { nombreCompleto: p.nombreCompleto, rol: p.rol },
            })),
            servicios: [
                ...hotelesElegidos.map((h) => ({
                    idsalida: nuevaId,
                    idservicio: h.idservicio,
                    tipo: "ALOJAMIENTO",
                    comprobanteReserva: null,
                    servicio: { nombreServicio: h.nombreServicio },
                })),
                ...(transporteElegido
                    ? [
                          {
                              idsalida: nuevaId,
                              idservicio: transporteElegido.idservicio,
                              tipo: "TRANSPORTE",
                              comprobanteReserva: null,
                              servicio: { nombreServicio: transporteElegido.nombreServicio },
                          },
                      ]
                    : []),
            ],
            pasajerosConfirmados: 0,
            cantidadPersonal: personalElegido.length,
            guias: personalElegido
                .filter((p) => p.rol === "Guía")
                .map((p) => p.nombreCompleto),
            permisosFaltantes: 0,
            etapaEsperada: null,
            etapaInformada: null,
            etapaDesfasada: false,
            alertas: advertencias.length > 0 ? ["RIESGO_STOCK"] : [],
            avisos: advertencias.map((mensaje) => ({ alerta: "RIESGO_STOCK", mensaje })),
        };

        salidas.unshift(nuevaSalida);

        return HttpResponse.json(
            {
                mensaje: "Salida creada y publicada exitosamente",
                data: {
                    salida: nuevaSalida,
                    dotacion: { guias: guiasMin, porteadores: porteadoresMin },
                    totalLugares,
                    advertencias,
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

    // GET /api/salidas/:idsalida/asignacion (CU-40 — §9.1 Panel de confirmación)
    http.get("*/api/salidas/:idsalida/asignacion", async ({ params }) => {
        await delay(150);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        const vendidos = salida.pasajerosConfirmados ?? Math.max(0, salida.tamanoMaximo - salida.stockLocal);
        const guiasReq = 1;
        const porteadoresReq = Math.ceil(vendidos / 2);
        const personal = salida.personalAsignado.map((a) => ({
            idpersonal: a.idpersonal,
            nombreCompleto: a.personal.nombreCompleto,
            rol: a.personal.rol,
            apto: true,
            motivo: null as string | null,
        }));
        const porteadoresAsignados = personal.filter((p) => p.rol === "Porteador").length;
        const porteadoresSobrantes = Math.max(0, porteadoresAsignados - porteadoresReq);
        const porteadoresSugeridosALiberar = porteadoresSobrantes
            ? personal.filter((p) => p.rol === "Porteador").slice(-porteadoresSobrantes).map((p) => p.idpersonal)
            : [];

        const hoteles = salida.servicios
            .filter((s) => s.tipo === "ALOJAMIENTO")
            .map((h, idx) => ({
                idservicio: h.idservicio,
                nombreServicio: h.servicio.nombreServicio,
                modalidadConfirmacion: (h.idservicio === 5 ? "A_SOLICITUD" : "BLOQUEO_PLAZAS") as
                    | "BLOQUEO_PLAZAS"
                    | "A_SOLICITUD",
                pasajeros: idx === 0 ? vendidos : 0,
            }));

        const srvTrans = salida.servicios.find((s) => s.tipo === "TRANSPORTE");
        const transMock = srvTrans
            ? transportesMock.find((t) => t.idservicio === srvTrans.idservicio)
            : null;
        const capacidad = transMock?.disponibilidad.capacidadVehiculo ?? 20;
        const transporte = srvTrans
            ? {
                  idservicio: srvTrans.idservicio,
                  nombreServicio: srvTrans.servicio.nombreServicio,
                  capacidadVehiculo: capacidad,
                  alcanza: capacidad >= vendidos + personal.length,
              }
            : null;

        const necesitaCarpas = Math.ceil(vendidos / 2);
        const equipo = [
            {
                idservicio: 5,
                nombreServicio: "Carpa de alta montaña 4 estaciones",
                tipoEquipamiento: "Carpas",
                cantidad: 1,
                cadaPasajeros: 2,
                necesita: necesitaCarpas,
                ocupado: necesitaCarpas,
                falta: 0,
                fechaFalta: null,
            },
        ];

        const reservasSinAlojamiento = salida.alertas?.includes("SOLICITUD_PENDIENTE")
            ? ["RES-2026-099"]
            : [];
        const faltantes: string[] = [];
        if (reservasSinAlojamiento.length > 0) {
            faltantes.push(
                `Hay alojamientos sin confirmar en las reservas ${reservasSinAlojamiento.join(", ")}`,
            );
        }
        if (vendidos === 0) {
            faltantes.push("La salida no tiene pasajeros confirmados: corresponde cancelarla");
        }

        const ventaAbierta = salida.ventaAbierta ?? false;
        const ultimoDiaVenta = salida.ultimoDiaVenta ?? salida.fechaInicio.slice(0, 10);
        const puedeConfirmar =
            salida.estado === "PUBLICADA" && !ventaAbierta && faltantes.length === 0;
        const motivoNoConfirmable = puedeConfirmar
            ? null
            : salida.estado !== "PUBLICADA"
              ? "La salida ya está confirmada o no está activa"
              : ventaAbierta
                ? `La venta sigue abierta hasta el ${formatearDmy(ultimoDiaVenta)}`
                : faltantes[0] ?? null;

        return HttpResponse.json({
            data: {
                salida: {
                    ...cabecera(salida),
                    estado: salida.estado,
                    ultimoDiaVenta,
                    ventaAbierta,
                },
                puedeConfirmar,
                motivoNoConfirmable,
                pasajerosConfirmados: vendidos,
                dotacionRequerida: { guias: guiasReq, porteadores: porteadoresReq },
                personal,
                porteadoresSobrantes,
                porteadoresSugeridosALiberar,
                hoteles,
                transporte,
                equipo,
                reservasSinAlojamiento,
                faltantes,
                bloqueoInicial: salida.tamanoMaximo + personal.length,
                lugaresSobrantes: Math.max(0, salida.tamanoMaximo - vendidos),
            },
        });
    }),

    // POST /api/salidas/:idsalida/asignacion (CU-40 — §9.2, §13 y §14)
    http.post("*/api/salidas/:idsalida/asignacion", async ({ params, request }) => {
        await delay(250);
        const salida = buscarSalida(params.idsalida);
        if (!salida) return noExiste();
        if (salida.estado === "CERRADA") {
            return HttpResponse.json({ error: "La salida ya está confirmada" }, { status: 400 });
        }
        if (salida.estado !== "PUBLICADA") {
            return HttpResponse.json(
                { error: "No se puede confirmar una salida que ya inició o no está activa" },
                { status: 400 },
            );
        }

        let body: { personalIds?: unknown };
        try {
            body = (await request.json()) as { personalIds?: unknown };
        } catch {
            body = {};
        }
        if (body.personalIds !== undefined) {
            if (salida.personalAsignado.length > 0) {
                return HttpResponse.json(
                    {
                        error: "La salida ya tiene personal: personalIds es solo para una salida sin personal. Se cambia con los reemplazos",
                    },
                    { status: 400 },
                );
            }
            if (
                !Array.isArray(body.personalIds) ||
                body.personalIds.length === 0 ||
                !body.personalIds.every((id) => Number.isInteger(id) && Number(id) > 0) ||
                new Set(body.personalIds).size !== body.personalIds.length
            ) {
                return HttpResponse.json(
                    { error: "personalIds debe ser una lista de ids de personal, sin repetidos" },
                    { status: 400 },
                );
            }
            salida.personalAsignado = (body.personalIds as number[]).map((idpersonal) => ({
                idsalida: salida.idsalida,
                idpersonal,
                personal: personaDe(idpersonal),
            }));
            salida.cantidadPersonal = salida.personalAsignado.length;
            salida.guias = salida.personalAsignado
                .filter((p) => p.personal.rol === "Guía")
                .map((p) => p.personal.nombreCompleto);
        }

        if (salida.ventaAbierta) {
            const ultimo = salida.ultimoDiaVenta ?? salida.fechaInicio.slice(0, 10);
            return HttpResponse.json(
                {
                    error: `La venta sigue abierta hasta el ${formatearDmy(ultimo)}: la salida se confirma después del corte`,
                },
                { status: 400 },
            );
        }
        const vendidos = salida.pasajerosConfirmados ?? 0;
        if (vendidos === 0) {
            return HttpResponse.json(
                { error: "La salida no tiene pasajeros confirmados: corresponde cancelarla" },
                { status: 400 },
            );
        }
        if (salida.alertas?.includes("SOLICITUD_PENDIENTE")) {
            const reservasSinAlojamiento = ["RES-2026-099"];
            return HttpResponse.json(
                {
                    error: `No se puede confirmar: hay alojamientos sin confirmar en las reservas ${reservasSinAlojamiento.join(", ")}`,
                    detalle: { reservasSinAlojamiento, faltantes: [] },
                },
                { status: 409 },
            );
        }
        const lugaresLiberados = Math.max(0, salida.tamanoMaximo - vendidos);
        salida.estado = "CERRADA";
        salida.stockLocal = 0;
        salida.ventaAbierta = false;
        salida.puedeConfirmar = false;
        salida.alertas = (salida.alertas ?? []).filter((a) => a !== "PENDIENTE_CONFIRMAR");
        salida.avisos = (salida.avisos ?? []).filter((a) => a.alerta !== "PENDIENTE_CONFIRMAR");
        return HttpResponse.json({
            mensaje: "Salida confirmada y permisos de la nómina emitidos",
            data: {
                salida: { idsalida: salida.idsalida, nroSalida: salida.nroSalida, estado: "CERRADA" },
                permisosEmitidos: vendidos + salida.personalAsignado.length,
                rechazados: [],
                lugaresLiberados,
            },
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
