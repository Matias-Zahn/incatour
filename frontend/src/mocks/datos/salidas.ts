import type { SalidaApi } from "../../services/salidaService";

export const salidasMockIniciales: SalidaApi[] = [
    {
        idsalida: 1,
        idpaquete: 1,
        nroSalida: "SAL-2026-001",
        idbloqueo: "BLQ-001",
        stockLocal: 4,
        stockLocalAlojamiento: 4,
        tamanoMaximo: 8,
        fechaInicio: "2026-11-15T08:00:00.000Z",
        fechaFin: "2026-11-18T18:00:00.000Z",
        estado: "PUBLICADA",
        ultimaEtapaAlcanzada: null,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
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
        fechaInicio: "2026-10-01T08:00:00.000Z",
        fechaFin: "2026-10-04T18:00:00.000Z",
        estado: "FINALIZADA",
        ultimaEtapaAlcanzada: 4,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
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
    },
    {
        idsalida: 3,
        idpaquete: 2,
        nroSalida: "SAL-2026-002",
        idbloqueo: "BLQ-002",
        stockLocal: 0,
        stockLocalAlojamiento: 0,
        tamanoMaximo: 6,
        fechaInicio: "2026-10-18T08:00:00.000Z",
        fechaFin: "2026-10-22T18:00:00.000Z",
        estado: "EN_CURSO",
        ultimaEtapaAlcanzada: 2,
        paquete: {
            nroPaquete: "PAQ-INC-02",
            nombrePaquete: "Inca VIP Hotel Montaña",
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
    },
    {
        idsalida: 4,
        idpaquete: 1,
        nroSalida: "SAL-2026-003",
        idbloqueo: "BLQ-003",
        stockLocal: 0,
        stockLocalAlojamiento: 0,
        tamanoMaximo: 8,
        fechaInicio: "2026-11-01T08:00:00.000Z",
        fechaFin: "2026-11-04T18:00:00.000Z",
        estado: "CERRADA",
        ultimaEtapaAlcanzada: null,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
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
        servicios: [],
    },
    {
        idsalida: 5,
        idpaquete: 1,
        nroSalida: "SAL-2026-004",
        idbloqueo: null,
        stockLocal: 8,
        stockLocalAlojamiento: null,
        tamanoMaximo: 8,
        fechaInicio: "2026-12-01T08:00:00.000Z",
        fechaFin: "2026-12-04T18:00:00.000Z",
        estado: "CANCELADA",
        ultimaEtapaAlcanzada: null,
        paquete: {
            nroPaquete: "PAQ-INC-01",
            nombrePaquete: "Inca Clásico Standard",
        },
        personalAsignado: [],
        servicios: [],
    },
    {
        idsalida: 6,
        idpaquete: 2,
        nroSalida: "SAL-2026-005",
        idbloqueo: "BLQ-005",
        stockLocal: 2,
        stockLocalAlojamiento: 2,
        tamanoMaximo: 6,
        fechaInicio: "2026-12-10T08:00:00.000Z",
        fechaFin: "2026-12-14T18:00:00.000Z",
        estado: "PUBLICADA",
        ultimaEtapaAlcanzada: null,
        paquete: {
            nroPaquete: "PAQ-INC-02",
            nombrePaquete: "Inca VIP Hotel Montaña",
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
        ],
    },
];
