import type { Circuito, Etapa } from "../../services/etapaService";

export const circuitosSemilla: Circuito[] = [
    {
        id: 1,
        idcircuito: 1,
        nombreCircuito: "Camino Inca Clásico",
        duracionDias: 4,
        dificultad: "MEDIA",
        minimoGuias: 1,
        parametrosPorteadores: "1 porteador cada 2 pasajeros",
        estado: "ACTIVO",
    },
    {
        id: 2,
        idcircuito: 2,
        nombreCircuito: "Salkantay Trek a Machu Picchu",
        duracionDias: 5,
        dificultad: "ALTA",
        minimoGuias: 2,
        parametrosPorteadores: "1 porteador cada 3 pasajeros",
        estado: "ACTIVO",
    },
    {
        id: 3,
        idcircuito: 3,
        nombreCircuito: "Valle Sagrado y Maras Moray",
        duracionDias: 2,
        dificultad: "BAJA",
        minimoGuias: 1,
        parametrosPorteadores: null,
        estado: "ACTIVO",
    },
    {
        id: 4,
        idcircuito: 4,
        nombreCircuito: "Choquequirao Expedición Histórica",
        duracionDias: 4,
        dificultad: "ALTA",
        minimoGuias: 2,
        parametrosPorteadores: "1 porteador cada 2 pasajeros",
        estado: "INACTIVO",
    },
];

/**
 * IDs de circuitos que ya tienen paquetes comerciales en estado ACTIVO,
 * para simular la regla `validarCircuitoSinReservasActivas` (CU-05) en MSW.
 */
export const circuitosConPaquetesActivos = new Set<number>([3]);

export const etapasSemilla: Etapa[] = [
    {
        id: 1,
        idcircuito: 1,
        numeroOrden: 1,
        puntoInicio: "Km 82 (Piscacucho)",
        puntoFin: "Wayllabamba",
        campamentoPrevisto: "Campamento Wayllabamba",
    },
    {
        id: 2,
        idcircuito: 1,
        numeroOrden: 2,
        puntoInicio: "Wayllabamba",
        puntoFin: "Pacaymayo",
        campamentoPrevisto: "Campamento Pacaymayo",
    },
    {
        id: 3,
        idcircuito: 1,
        numeroOrden: 3,
        puntoInicio: "Pacaymayo",
        puntoFin: "Wiñay Wayna",
        campamentoPrevisto: "Campamento Wiñay Wayna",
    },
    {
        id: 4,
        idcircuito: 1,
        numeroOrden: 4,
        puntoInicio: "Wiñay Wayna",
        puntoFin: "Machu Picchu",
        campamentoPrevisto: "",
    },
    {
        id: 1,
        idcircuito: 2,
        numeroOrden: 1,
        puntoInicio: "Mollepata",
        puntoFin: "Soraypampa",
        campamentoPrevisto: "Campamento Soraypampa",
    },
    {
        id: 2,
        idcircuito: 2,
        numeroOrden: 2,
        puntoInicio: "Soraypampa",
        puntoFin: "Chaullay",
        campamentoPrevisto: "Campamento Chaullay",
    },
    {
        id: 3,
        idcircuito: 2,
        numeroOrden: 3,
        puntoInicio: "Chaullay",
        puntoFin: "Aguas Calientes",
        campamentoPrevisto: "Hotel Aguas Calientes",
    },
    {
        id: 1,
        idcircuito: 3,
        numeroOrden: 1,
        puntoInicio: "Cusco",
        puntoFin: "Urubamba",
        campamentoPrevisto: "Hotel Valle Sagrado",
    },
    {
        id: 2,
        idcircuito: 3,
        numeroOrden: 2,
        puntoInicio: "Urubamba",
        puntoFin: "Ollantaytambo",
        campamentoPrevisto: "",
    },
    {
        id: 1,
        idcircuito: 4,
        numeroOrden: 1,
        puntoInicio: "Capuliyoc",
        puntoFin: "Chiquisca",
        campamentoPrevisto: "Campamento Chiquisca",
    },
    {
        id: 2,
        idcircuito: 4,
        numeroOrden: 2,
        puntoInicio: "Chiquisca",
        puntoFin: "Choquequirao",
        campamentoPrevisto: "Campamento Choquequirao",
    },
];

