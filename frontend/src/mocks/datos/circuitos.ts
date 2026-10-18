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
                puntoInicio: "Km 82 (Piscacucho)",
                puntoFin: "Wayllabamba",
                campamentoPrevisto: "Campamento Wayllabamba",
            },
            {
                idcircuito: 1,
                numeroOrden: 2,
                puntoInicio: "Wayllabamba",
                puntoFin: "Pacaymayo",
                campamentoPrevisto: "Campamento Pacaymayo",
            },
            {
                idcircuito: 1,
                numeroOrden: 3,
                puntoInicio: "Pacaymayo",
                puntoFin: "Wiñay Wayna",
                campamentoPrevisto: "Campamento Wiñay Wayna",
            },
            {
                idcircuito: 1,
                numeroOrden: 4,
                puntoInicio: "Wiñay Wayna",
                puntoFin: "Machu Picchu",
                campamentoPrevisto: null,
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
        etapas: [
            {
                idcircuito: 2,
                numeroOrden: 1,
                puntoInicio: "Mollepata",
                puntoFin: "Soraypampa",
                campamentoPrevisto: "Campamento Soraypampa",
            },
            {
                idcircuito: 2,
                numeroOrden: 2,
                puntoInicio: "Soraypampa",
                puntoFin: "Chaullay",
                campamentoPrevisto: "Campamento Chaullay",
            },
            {
                idcircuito: 2,
                numeroOrden: 3,
                puntoInicio: "Chaullay",
                puntoFin: "Aguas Calientes",
                campamentoPrevisto: "Hotel Aguas Calientes",
            },
        ],
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
        etapas: [
            {
                idcircuito: 3,
                numeroOrden: 1,
                puntoInicio: "Cusco",
                puntoFin: "Urubamba",
                campamentoPrevisto: "Hotel Valle Sagrado",
            },
            {
                idcircuito: 3,
                numeroOrden: 2,
                puntoInicio: "Urubamba",
                puntoFin: "Ollantaytambo",
                campamentoPrevisto: null,
            },
        ],
    },
    {
        idcircuito: 4,
        nombreCircuito: "Choquequirao Expedición Histórica",
        duracionDias: 4,
        dificultad: "Alta",
        minimoGuias: 2,
        parametrosPorteadores: "1 porteador cada 2 pasajeros",
        estado: "ACTIVO",
        tienePaquetesActivos: false,
        etapas: [
            {
                idcircuito: 4,
                numeroOrden: 1,
                puntoInicio: "Capuliyoc",
                puntoFin: "Chiquisca",
                campamentoPrevisto: "Campamento Chiquisca",
            },
            {
                idcircuito: 4,
                numeroOrden: 2,
                puntoInicio: "Chiquisca",
                puntoFin: "Choquequirao",
                campamentoPrevisto: "Campamento Choquequirao",
            },
        ],
    },
];
