import type { SalidaApi } from "../../services/salidaService";

const ahora = new Date();
const fechaRelativa = (dias: number, horaUtc = 8): string => {
    const f = new Date(ahora);
    f.setUTCDate(f.getUTCDate() + dias);
    f.setUTCHours(horaUtc, 0, 0, 0);
    return f.toISOString();
};

const isoFechaRelativa = (dias: number): string => fechaRelativa(dias, 8).slice(0, 10);

export const salidasMockIniciales: SalidaApi[] = [
    {
        idsalida: 1,
        idpaquete: 1,
        nroSalida: "SAL-2026-001",
        idbloqueo: "BLQ-001",
        stockLocal: 4,
        stockLocalAlojamiento: 4,
        tamanoMaximo: 8,
        fechaInicio: fechaRelativa(2),
        fechaFin: fechaRelativa(5, 18),
        estado: "PUBLICADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: null,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(-1),
        ventaAbierta: false,
        puedeConfirmar: true,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [
            {
                idsalida: 1,
                idpersonal: 1,
                personal: {
                    nombreCompleto: "Carlos Mamani",
                    rol: "Guía",
                },
            },
            {
                idsalida: 1,
                idpersonal: 2,
                personal: {
                    nombreCompleto: "Mateo Quispe",
                    rol: "Porteador",
                },
            },
            {
                idsalida: 1,
                idpersonal: 4,
                personal: {
                    nombreCompleto: "Pedro Condori",
                    rol: "Porteador",
                },
            },
        ],
        servicios: [
            {
                idsalida: 1,
                idservicio: 1,
                tipo: "ALOJAMIENTO",
                comprobanteReserva: null,
                servicio: {
                    nombreServicio: "Hotel Montaña",
                },
            },
            {
                idsalida: 1,
                idservicio: 3,
                tipo: "TRANSPORTE",
                comprobanteReserva: null,
                servicio: {
                    nombreServicio: "Bus Cusco - Km 82",
                },
            },
        ],
        pasajerosConfirmados: 4,
        cantidadPersonal: 3,
        guias: ["Carlos Mamani"],
        permisosFaltantes: 0,
        etapaEsperada: null,
        etapaInformada: null,
        etapaDesfasada: false,
        alertas: ["PENDIENTE_CONFIRMAR"],
        avisos: [
            {
                alerta: "PENDIENTE_CONFIRMAR",
                mensaje: "La venta cerró ayer: falta confirmar la salida",
            },
        ],
    },
    {
        idsalida: 2,
        idpaquete: 1,
        nroSalida: "SAL-2026-000",
        idbloqueo: "BLQ-000",
        stockLocal: 0,
        stockLocalAlojamiento: 0,
        tamanoMaximo: 10,
        fechaInicio: fechaRelativa(-15),
        fechaFin: fechaRelativa(-12, 18),
        estado: "FINALIZADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: 4,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(-18),
        ventaAbierta: false,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [
            {
                idsalida: 2,
                idpersonal: 1,
                personal: {
                    nombreCompleto: "Carlos Mamani",
                    rol: "Guía",
                },
            },
            {
                idsalida: 2,
                idpersonal: 2,
                personal: {
                    nombreCompleto: "Luis Quispe",
                    rol: "Porteador",
                },
            },
        ],
        servicios: [
            {
                idsalida: 2,
                idservicio: 1,
                tipo: "ALOJAMIENTO",
                comprobanteReserva: "HTL-2026-000",
                servicio: {
                    nombreServicio: "Hotel Montaña",
                },
            },
        ],
        pasajerosConfirmados: 10,
        cantidadPersonal: 2,
        guias: ["Carlos Mamani"],
        permisosFaltantes: 0,
        etapaEsperada: null,
        etapaInformada: 4,
        etapaDesfasada: false,
        alertas: [],
        avisos: [],
    },
    {
        idsalida: 3,
        idpaquete: 2,
        nroSalida: "SAL-2026-002",
        idbloqueo: "BLQ-002",
        stockLocal: 0,
        stockLocalAlojamiento: 0,
        tamanoMaximo: 6,
        fechaInicio: fechaRelativa(-2),
        fechaFin: fechaRelativa(2, 18),
        estado: "EN_CURSO",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: 1,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(-5),
        ventaAbierta: false,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-INC-02",
            nombrePaquete: "Inca VIP Hotel Montaña",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [
            {
                idsalida: 3,
                idpersonal: 3,
                personal: {
                    nombreCompleto: "Rosa Huamán",
                    rol: "Guía",
                },
            },
            {
                idsalida: 3,
                idpersonal: 2,
                personal: {
                    nombreCompleto: "Mateo Quispe",
                    rol: "Porteador",
                },
            },
        ],
        servicios: [
            {
                idsalida: 3,
                idservicio: 2,
                tipo: "ALOJAMIENTO",
                comprobanteReserva: "HTL-2026-002",
                servicio: {
                    nombreServicio: "Hotel Valle Sagrado",
                },
            },
        ],
        pasajerosConfirmados: 6,
        cantidadPersonal: 2,
        guias: ["Rosa Huamán"],
        permisosFaltantes: 0,
        etapaEsperada: 3,
        etapaInformada: 1,
        etapaDesfasada: true,
        alertas: [],
        avisos: [],
    },
    {
        idsalida: 4,
        idpaquete: 1,
        nroSalida: "SAL-2026-003",
        idbloqueo: "BLQ-003",
        stockLocal: 0,
        stockLocalAlojamiento: 0,
        tamanoMaximo: 8,
        fechaInicio: fechaRelativa(5),
        fechaFin: fechaRelativa(8, 18),
        estado: "CERRADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: null,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(2),
        ventaAbierta: false,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [
            {
                idsalida: 4,
                idpersonal: 1,
                personal: {
                    nombreCompleto: "Carlos Mamani",
                    rol: "Guía",
                },
            },
        ],
        servicios: [
            {
                idsalida: 4,
                idservicio: 3,
                tipo: "TRANSPORTE",
                comprobanteReserva: "BUS-003",
                servicio: {
                    nombreServicio: "Bus Cusco - Km 82",
                },
            },
        ],
        pasajerosConfirmados: 8,
        cantidadPersonal: 1,
        guias: ["Carlos Mamani"],
        permisosFaltantes: 1,
        etapaEsperada: null,
        etapaInformada: null,
        etapaDesfasada: false,
        alertas: ["PERMISOS_SIN_CONFIRMAR"],
        avisos: [],
    },
    {
        idsalida: 5,
        idpaquete: 1,
        nroSalida: "SAL-2026-004",
        idbloqueo: null,
        stockLocal: 8,
        stockLocalAlojamiento: null,
        tamanoMaximo: 8,
        fechaInicio: fechaRelativa(40),
        fechaFin: fechaRelativa(43, 18),
        estado: "CANCELADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: null,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(37),
        ventaAbierta: false,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [],
        servicios: [],
        pasajerosConfirmados: 0,
        cantidadPersonal: 0,
        guias: [],
        permisosFaltantes: 0,
        etapaEsperada: null,
        etapaInformada: null,
        etapaDesfasada: false,
        alertas: [],
        avisos: [],
    },
    {
        idsalida: 6,
        idpaquete: 2,
        nroSalida: "SAL-2026-005",
        idbloqueo: "BLQ-005",
        stockLocal: 2,
        stockLocalAlojamiento: 2,
        tamanoMaximo: 6,
        fechaInicio: fechaRelativa(25),
        fechaFin: fechaRelativa(29, 18),
        estado: "PUBLICADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: null,
        diasCierreVenta: 2,
        ultimoDiaVenta: isoFechaRelativa(22),
        ventaAbierta: true,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-INC-02",
            nombrePaquete: "Inca VIP Hotel Montaña",
            circuito: {
                idcircuito: 1,
                nombreCircuito: "Camino del Inca Clásico",
                duracionDias: 4,
                _count: { etapas: 4 },
            },
        },
        personalAsignado: [
            {
                idsalida: 6,
                idpersonal: 3,
                personal: {
                    nombreCompleto: "Rosa Huamán",
                    rol: "Guía",
                },
            },
        ],
        servicios: [
            {
                idsalida: 6,
                idservicio: 2,
                tipo: "ALOJAMIENTO",
                comprobanteReserva: null,
                servicio: {
                    nombreServicio: "Hotel Valle Sagrado",
                },
            },
            {
                idsalida: 6,
                idservicio: 3,
                tipo: "TRANSPORTE",
                comprobanteReserva: null,
                servicio: {
                    nombreServicio: "Bus Cusco - Km 82",
                },
            },
        ],
        pasajerosConfirmados: 4,
        cantidadPersonal: 1,
        guias: ["Rosa Huamán"],
        permisosFaltantes: 0,
        etapaEsperada: null,
        etapaInformada: null,
        etapaDesfasada: false,
        alertas: ["RIESGO_STOCK"],
        avisos: [
            {
                alerta: "RIESGO_STOCK",
                mensaje: "Si se vende completa faltarían hasta 2 carpas el día de inicio",
            },
        ],
    },
    {
        idsalida: 7,
        idpaquete: 3,
        nroSalida: "SAL-2026-006",
        idbloqueo: "BLQ-006",
        stockLocal: 6,
        stockLocalAlojamiento: 6,
        tamanoMaximo: 12,
        fechaInicio: fechaRelativa(14),
        fechaFin: fechaRelativa(19, 18),
        estado: "PUBLICADA",
        lugaresPorLiberar: 0,
        ultimaEtapaAlcanzada: null,
        diasCierreVenta: 5,
        ultimoDiaVenta: isoFechaRelativa(8),
        ventaAbierta: true,
        puedeConfirmar: false,
        paquete: {
            nroPaquete: "PAQ-SAL-01",
            nombrePaquete: "Salkantay Aventura",
            circuito: {
                idcircuito: 2,
                nombreCircuito: "Trekking Salkantay",
                duracionDias: 5,
                _count: { etapas: 5 },
            },
        },
        personalAsignado: [
            {
                idsalida: 7,
                idpersonal: 3,
                personal: {
                    nombreCompleto: "Rosa Huamán",
                    rol: "Guía",
                },
            },
        ],
        servicios: [
            {
                idsalida: 7,
                idservicio: 5,
                tipo: "ALOJAMIENTO",
                comprobanteReserva: null,
                servicio: {
                    nombreServicio: "Hotel Sol Andino",
                },
            },
        ],
        pasajerosConfirmados: 6,
        cantidadPersonal: 1,
        guias: ["Rosa Huamán"],
        permisosFaltantes: 0,
        etapaEsperada: null,
        etapaInformada: null,
        etapaDesfasada: false,
        alertas: ["SOLICITUD_PENDIENTE"],
        avisos: [],
    },
];

export const alojamientosSalidaMock: {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    categoria: string | null;
    modalidadConfirmacion: "BLOQUEO_PLAZAS" | "A_SOLICITUD";
    capacidadDisponible: number | null;
}[] = [
    {
        idservicio: 1,
        nombreServicio: "Hotel Montaña",
        localidad: "Cusco",
        categoria: "3 Estrellas",
        modalidadConfirmacion: "BLOQUEO_PLAZAS",
        capacidadDisponible: 10,
    },
    {
        idservicio: 2,
        nombreServicio: "Hotel Valle Sagrado",
        localidad: "Cusco",
        categoria: "4 Estrellas",
        modalidadConfirmacion: "BLOQUEO_PLAZAS",
        capacidadDisponible: 8,
    },
    {
        idservicio: 5,
        nombreServicio: "Hotel Sol Andino",
        localidad: "Cusco",
        categoria: "3 Estrellas",
        modalidadConfirmacion: "A_SOLICITUD",
        capacidadDisponible: null,
    },
];
