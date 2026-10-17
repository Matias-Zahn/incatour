import type { Circuito } from "../../services/circuitoService";

export type CircuitoMock = Omit<Circuito, "id"> & {
    tienePaquetesActivos?: boolean;
};

export const circuitosIniciales: CircuitoMock[] = [
    {
        idcircuito: 1,
        nombreCircuito: "Camino del Inca Clásico",
        duracionDias: 4,
        dificultad: "Alta",
        minimoGuias: 2,
        parametrosPorteadores: "1 por cada 2 pasajeros",
        estado: "ACTIVO",
        tienePaquetesActivos: true,
        etapas: [
            {
                idcircuito: 1,
                numeroOrden: 1,
                puntoInicio: "Km 82",
                puntoFin: "Wayllabamba",
                campamentoPrevisto: "Wayllabamba Camp",
            },
            {
                idcircuito: 1,
                numeroOrden: 2,
                puntoInicio: "Wayllabamba",
                puntoFin: "Pacaymayo",
                campamentoPrevisto: "Pacaymayo Camp",
            },
        ],
    },
    {
        idcircuito: 2,
        nombreCircuito: "Trekking Salkantay",
        duracionDias: 5,
        dificultad: "Alta",
        minimoGuias: 2,
        parametrosPorteadores: "1 porteador cada 3 pasajeros",
        estado: "ACTIVO",
        tienePaquetesActivos: false,
        etapas: [],
    },
    {
        idcircuito: 3,
        nombreCircuito: "Valle Sagrado Tradicional",
        duracionDias: 1,
        dificultad: "Baja",
        minimoGuias: 1,
        parametrosPorteadores: null,
        estado: "ACTIVO",
        tienePaquetesActivos: false,
        etapas: [],
    },
    {
        idcircuito: 4,
        nombreCircuito: "Montaña de Siete Colores",
        duracionDias: 1,
        dificultad: "Media",
        minimoGuias: 1,
        parametrosPorteadores: "Sin porteadores requeridos",
        estado: "ACTIVO",
        tienePaquetesActivos: false,
        etapas: [],
    },
];
