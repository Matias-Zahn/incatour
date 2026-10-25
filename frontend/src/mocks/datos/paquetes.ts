import type { Paquete } from "../../services/paqueteService";

export type PaqueteMock = Omit<Paquete, "id"> & {
    tieneSalidasActivas?: boolean;
};

export const paquetesIniciales: PaqueteMock[] = [
    {
        idpaquete: 1,
        idcircuito: 1,
        nroPaquete: "PAQ-INC-01",
        nombrePaquete: "Inca Clásico Standard",
        condiciones: "Incluye traslados desde Cusco y pensión completa en ruta.",
        estado: "ACTIVO",
        tipoGarantia: "POR_CATEGORIA",
        categoriaGarantizada: "3 Estrellas",
        localidadGarantizada: "Cusco",
        tipoHabitacionGarantizada: "Doble",
        nochesPrevias: 1,
        nochesPosteriores: 1,
        diasMinimosReintegro: 15,
        diasDisponibles: "L-M-X-J-V-S-D",
        tieneSalidasActivas: true,
        circuito: {
            idcircuito: 1,
            nombreCircuito: "Camino del Inca Clásico",
            duracionDias: 4,
            dificultad: "Alta",
            minimoGuias: 2,
            parametrosPorteadores: "1 por cada 2 pasajeros",
            estado: "ACTIVO",
        },
        tarifas: [
            {
                idpaquete: 1,
                idtemporada: 1,
                monto: 650,
                moneda: "USD",
                temporada: {
                    idtemporada: 1,
                    nombre: "Alta 2026",
                    fechaInicio: "2026-10-01T00:00:00.000Z",
                    fechaFin: "2026-12-31T23:59:59.000Z",
                    estado: "ACTIVO",
                },
            },
        ],
    },
    {
        idpaquete: 2,
        idcircuito: 1,
        nroPaquete: "PAQ-INC-02",
        nombrePaquete: "Inca VIP Hotel Montaña",
        condiciones: "Garantía directa en Hotel Montaña con tren panorámico.",
        estado: "ACTIVO",
        tipoGarantia: "POR_ESTABLECIMIENTO",
        localidadGarantizada: null,
        categoriaGarantizada: null,
        tipoHabitacionGarantizada: null,
        nochesPrevias: 2,
        nochesPosteriores: 1,
        diasDisponibles: "L-M-X-J-V-S-D",
        tieneSalidasActivas: false,
        circuito: {
            idcircuito: 1,
            nombreCircuito: "Camino del Inca Clásico",
            duracionDias: 4,
            dificultad: "Alta",
            minimoGuias: 2,
            parametrosPorteadores: "1 por cada 2 pasajeros",
            estado: "ACTIVO",
        },
        tarifas: [
            {
                idpaquete: 2,
                idtemporada: 1,
                monto: 980,
                moneda: "USD",
                temporada: {
                    idtemporada: 1,
                    nombre: "Alta 2026",
                    fechaInicio: "2026-10-01T00:00:00.000Z",
                    fechaFin: "2026-12-31T23:59:59.000Z",
                    estado: "ACTIVO",
                },
            },
        ],
    },
];
