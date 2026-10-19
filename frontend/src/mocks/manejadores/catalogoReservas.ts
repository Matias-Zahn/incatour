import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import { exigirRol } from "../autorizacion";
import type {
    CrearReservaPayload,
    PaqueteCatalogoPublico,
    ResultadoReservaConfirmada,
    SalidaDisponibleCatalogo,
} from "../../services/catalogoCompraService";

const salidasPorPaqueteMock: Record<number, SalidaDisponibleCatalogo[]> = {
    1: [
        {
            idsalida: 1,
            nroSalida: "SAL-2026-001",
            fechaInicio: "2026-11-15T00:00:00.000Z",
            fechaFin: "2026-11-18T00:00:00.000Z",
            stockLocal: 16,
            tamanoMaximo: 16,
            precioPersona: 650,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
        {
            idsalida: 2,
            nroSalida: "SAL-2026-002",
            fechaInicio: "2026-12-05T00:00:00.000Z",
            fechaFin: "2026-12-08T00:00:00.000Z",
            stockLocal: 8,
            tamanoMaximo: 12,
            precioPersona: 650,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
    ],
    2: [
        {
            idsalida: 3,
            nroSalida: "SAL-2026-003",
            fechaInicio: "2026-11-22T00:00:00.000Z",
            fechaFin: "2026-11-25T00:00:00.000Z",
            stockLocal: 10,
            tamanoMaximo: 10,
            precioPersona: 980,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
    ],
};

const catalogoMockInicial: PaqueteCatalogoPublico[] = [
    {
        id: 1,
        codigo: "PAQ-INC-01",
        nombre: "Inca Clásico Standard",
        imagenPrincipal: "/imagenes/catalogo/machu-picchu.jpg",
        imagenes: [
            "/imagenes/catalogo/machu-picchu.jpg",
            "/imagenes/catalogo/valle-sagrado.jpg",
        ],
        tieneImagenesPropias: false,
        circuito: {
            nombre: "Camino del Inca Clásico",
            dias: 4,
            dificultad: "Alta",
            recorrido: "Km 82 -> Wayllabamba -> Pacaymayo",
            etapas: [
                {
                    numeroOrden: 1,
                    puntoInicio: "Km 82",
                    puntoFin: "Wayllabamba",
                    campamentoPrevisto: "Wayllabamba Camp",
                },
                {
                    numeroOrden: 2,
                    puntoInicio: "Wayllabamba",
                    puntoFin: "Pacaymayo",
                    campamentoPrevisto: "Pacaymayo Camp",
                },
            ],
        },
        nochesAlojamiento: {
            previas: 1,
            posteriores: 1,
            garantia: "3 Estrellas en Cusco · Hab. Doble",
            tipoGarantia: "POR_CATEGORIA",
        },
        serviciosAdicionales: ["Hotel Montaña", "Minibus Sprinter"],
        equipajeTransporte: {
            pesoEquipajeIncluido: 15,
            costoPorKgExcedente: 2.5,
        },
        condiciones: "Incluye traslados desde Cusco y pensión completa en ruta.",
        diasDisponibles: "L-M-X-J-V-S-D",
        precios: [
            {
                idtemporada: 1,
                temporada: "Alta 2026",
                fechaInicio: "2026-10-01",
                fechaFin: "2026-12-31",
                precio: 650,
                moneda: "USD",
            },
        ],
        salidasDisponibles: salidasPorPaqueteMock[1],
    },
    {
        id: 2,
        codigo: "PAQ-INC-02",
        nombre: "Inca VIP Hotel Montaña",
        imagenPrincipal: "/imagenes/catalogo/valle-sagrado.jpg",
        imagenes: ["/imagenes/catalogo/valle-sagrado.jpg"],
        tieneImagenesPropias: false,
        circuito: {
            nombre: "Camino del Inca Clásico",
            dias: 4,
            dificultad: "Alta",
            recorrido: "Km 82 -> Wayllabamba -> Pacaymayo",
            etapas: [
                {
                    numeroOrden: 1,
                    puntoInicio: "Km 82",
                    puntoFin: "Wayllabamba",
                    campamentoPrevisto: "Wayllabamba Camp",
                },
                {
                    numeroOrden: 2,
                    puntoInicio: "Wayllabamba",
                    puntoFin: "Pacaymayo",
                    campamentoPrevisto: "Pacaymayo Camp",
                },
            ],
        },
        nochesAlojamiento: {
            previas: 2,
            posteriores: 1,
            garantia: "Hotel Montaña (Cusco)",
            tipoGarantia: "POR_ESTABLECIMIENTO",
        },
        serviciosAdicionales: ["Hotel Montaña", "IncaRail Voyager"],
        equipajeTransporte: null,
        condiciones: "Garantía directa en Hotel Montaña con tren panorámico.",
        diasDisponibles: "L-M-X-J-V-S-D",
        precios: [
            {
                idtemporada: 1,
                temporada: "Alta 2026",
                fechaInicio: "2026-10-01",
                fechaFin: "2026-12-31",
                precio: 980,
                moneda: "USD",
            },
        ],
        salidasDisponibles: salidasPorPaqueteMock[2],
    },
];

let proximoIdReserva = 100;

export const manejadoresCatalogoReservas = [
    // CU-26: GET /api/catalogo
    http.get(construirUrl("/catalogo"), async () => {
        await delay(150);
        const data = catalogoMockInicial.map((p) => ({
            ...p,
            salidasDisponibles: salidasPorPaqueteMock[p.id] ?? [],
        }));
        return HttpResponse.json({
            mensaje: "Catálogo público consultado exitosamente",
            cantidad: data.length,
            data,
        });
    }),

    // CU-30: POST /api/reservas
    http.post(construirUrl("/reservas"), async ({ request }) => {
        const denegado = exigirRol(request, "CLIENTE");
        if (denegado) return denegado;
        await delay(300);
        const body = (await request.json()) as CrearReservaPayload;

        const todasSalidas = Object.entries(salidasPorPaqueteMock).flatMap(
            ([idPaq, lista]) =>
                lista.map((s) => ({ idPaquete: Number(idPaq), salida: s })),
        );
        const encontrada = todasSalidas.find(
            (item) => item.salida.idsalida === body.idsalida,
        );
        if (!encontrada) {
            return HttpResponse.json(
                { error: "La salida no existe." },
                { status: 404 },
            );
        }

        const { idPaquete, salida } = encontrada;
        const paquete = catalogoMockInicial.find((p) => p.id === idPaquete);

        if (!body.pasajeros || body.pasajeros.length === 0) {
            return HttpResponse.json(
                {
                    error: "Debe registrar al menos un pasajero para la reserva.",
                },
                { status: 400 },
            );
        }

        if (body.pasajeros.length > salida.stockLocal) {
            return HttpResponse.json(
                {
                    error: `Solo quedan ${salida.stockLocal} lugares en esta salida.`,
                },
                { status: 400 },
            );
        }

        const pasaportes = new Set(
            body.pasajeros.map((p) => p.nroPasaporte.trim().toUpperCase()),
        );
        if (pasaportes.size !== body.pasajeros.length) {
            return HttpResponse.json(
                { error: "Hay pasajeros con el mismo número de pasaporte." },
                { status: 400 },
            );
        }

        for (const p of body.pasajeros) {
            if (
                new Date(p.fechaVencimientoPasaporte) <=
                new Date(salida.fechaFin)
            ) {
                return HttpResponse.json(
                    {
                        error: `El pasaporte de ${p.nombreCompleto} vence antes de finalizar el recorrido.`,
                    },
                    { status: 400 },
                );
            }
        }

        // Reglas de la pasarela simulada del contrato (CONTRATO_API.md)
        const numTarjeta = (body.tarjeta?.numero ?? "").replace(/\s+/g, "");
        const cvv = (body.tarjeta?.cvv ?? "").trim();

        if (numTarjeta.endsWith("0000")) {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Fondos insuficientes en la tarjeta.",
                },
                { status: 400 },
            );
        }
        if (numTarjeta.endsWith("1111")) {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Tarjeta denunciada como robada o bloqueada.",
                },
                { status: 400 },
            );
        }
        if (cvv === "999") {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Falla de validación de seguridad (CVV inválido).",
                },
                { status: 400 },
            );
        }

        // Calcular precio base + excedente de equipaje
        let extraEquipaje = 0;
        const eqTrans = paquete?.equipajeTransporte;
        if (eqTrans && body.equipaje) {
            for (const eq of body.equipaje) {
                const exceso =
                    (eq.pesoDeclarado || 0) - eqTrans.pesoEquipajeIncluido;
                if (exceso > 0) {
                    extraEquipaje += exceso * eqTrans.costoPorKgExcedente;
                }
            }
        }

        const precioCongelado =
            Math.round(
                (salida.precioPersona * body.pasajeros.length + extraEquipaje) *
                    100,
            ) / 100;

        // Descontar stockLocal
        salida.stockLocal -= body.pasajeros.length;

        const idreserva = proximoIdReserva++;
        const sufijo = Math.random().toString(16).slice(2, 8).toUpperCase();
        const nroReserva = `RES-${Date.now()}-${sufijo}`;
        const esEstablecimiento = (
            paquete?.nochesAlojamiento.tipoGarantia ?? ""
        )
            .toUpperCase()
            .includes("ESTABLECIMIENTO");

        const data: ResultadoReservaConfirmada = {
            idreserva,
            nroReserva,
            estado: "CONFIRMADA",
            estadoAlojamiento: esEstablecimiento ? "CONFIRMADO" : "PENDIENTE",
            cantidadPasajeros: body.pasajeros.length,
            precioCongelado,
            moneda: salida.moneda,
            transaccionPasarela: `TXN-${sufijo}`,
        };

        return HttpResponse.json(
            {
                mensaje: "Reserva confirmada",
                data,
            },
            { status: 201 },
        );
    }),
];
