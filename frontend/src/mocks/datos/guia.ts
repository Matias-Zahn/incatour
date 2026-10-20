import type {
    DetalleSalidaGuia,
    SalidaGuiaResumen,
} from "../../services/guiaService";

export const salidasGuiaSemilla: SalidaGuiaResumen[] = [
    {
        idsalida: 1,
        nroSalida: "SAL-2026-001",
        paquete: "Inca Clásico Standard",
        circuito: "Camino del Inca Clásico",
        fechaInicio: "2026-11-15T00:00:00.000Z",
        fechaFin: "2026-11-18T00:00:00.000Z",
        estado: "PUBLICADA",
        pasajeros: 1,
    },
    {
        idsalida: 2,
        nroSalida: "SAL-2026-002",
        paquete: "Inca Clásico Standard",
        circuito: "Camino del Inca Clásico",
        fechaInicio: "2026-12-07T00:00:00.000Z",
        fechaFin: "2026-12-10T00:00:00.000Z",
        estado: "EN_CURSO",
        pasajeros: 12,
    },
];

export const detallesSalidasGuiaSemilla: Record<number, DetalleSalidaGuia> = {
    1: {
        salida: {
            idsalida: 1,
            nroSalida: "SAL-2026-001",
            paquete: "Inca Clásico Standard",
            circuito: "Camino del Inca Clásico",
            duracionDias: 4,
            fechaInicio: "2026-11-15T00:00:00.000Z",
            fechaFin: "2026-11-18T00:00:00.000Z",
            estado: "PUBLICADA",
        },
        itinerario: [
            {
                numeroOrden: 1,
                puntoInicio: "Km 82",
                puntoFin: "Wayllabamba",
                campamentoPrevisto: "Wayllabamba Camp",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
            {
                numeroOrden: 2,
                puntoInicio: "Wayllabamba",
                puntoFin: "Pacaymayo",
                campamentoPrevisto: "Pacaymayo Camp",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
            {
                numeroOrden: 3,
                puntoInicio: "Pacaymayo",
                puntoFin: "Phuyupatamarca",
                campamentoPrevisto: "Phuyupatamarca Camp",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
            {
                numeroOrden: 4,
                puntoInicio: "Phuyupatamarca",
                puntoFin: "Machu Picchu",
                campamentoPrevisto: "Aguas Calientes",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
        ],
        nomina: [
            {
                idpasajero: 1,
                nombreCompleto: "Turista Uno",
                nroPasaporte: "TP-001",
                nacionalidad: "Argentina",
                nroReserva: "RES-0001",
                contacto: { titular: "Juan Pérez", email: "juan@test.com" },
            },
        ],
        personal: [
            {
                idpersonal: 1,
                nombreCompleto: "Carlos Mamani",
                rol: "Guía",
            },
        ],
        servicios: [
            {
                tipo: "TRANSPORTE",
                nombreServicio: "Minibus Sprinter Cusco - Km 82",
            },
        ],
        equipamiento: [
            {
                nombreServicio: "Carpas Alta Montaña",
                tipoEquipamiento: "Carpa 4 Estaciones",
                cantidad: 2,
            },
        ],
    },
    2: {
        salida: {
            idsalida: 2,
            nroSalida: "SAL-2026-002",
            paquete: "Inca Clásico Standard",
            circuito: "Camino del Inca Clásico",
            duracionDias: 4,
            fechaInicio: "2026-12-07T00:00:00.000Z",
            fechaFin: "2026-12-10T00:00:00.000Z",
            estado: "EN_CURSO",
        },
        itinerario: [
            {
                numeroOrden: 1,
                puntoInicio: "Km 82",
                puntoFin: "Wayllabamba",
                campamentoPrevisto: "Wayllabamba Camp",
                estadoTramo: "COMPLETADO",
                fechaHoraLlegada: "2026-12-07T12:00:00.000Z",
            },
            {
                numeroOrden: 2,
                puntoInicio: "Wayllabamba",
                puntoFin: "Pacaymayo",
                campamentoPrevisto: "Pacaymayo Camp",
                estadoTramo: "COMPLETADO",
                fechaHoraLlegada: "2026-12-07T14:35:00.000Z",
            },
            {
                numeroOrden: 3,
                puntoInicio: "Pacaymayo",
                puntoFin: "Phuyupatamarca",
                campamentoPrevisto: "Phuyupatamarca Camp",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
            {
                numeroOrden: 4,
                puntoInicio: "Phuyupatamarca",
                puntoFin: "Machu Picchu",
                campamentoPrevisto: "Aguas Calientes",
                estadoTramo: null,
                fechaHoraLlegada: null,
            },
        ],
        nomina: [
            {
                idpasajero: 1,
                nombreCompleto: "Juan Perez",
                nroPasaporte: "PS1234567",
                nacionalidad: "Argentina",
                nroReserva: "RES-101",
                contacto: { titular: "Juan Perez", email: "juan@test.com" },
            },
            {
                idpasajero: 2,
                nombreCompleto: "Maria Garcia",
                nroPasaporte: "PS9876543",
                nacionalidad: "España",
                nroReserva: "RES-102",
                contacto: { titular: "Maria Garcia", email: "maria@test.com" },
            },
        ],
        personal: [
            {
                idpersonal: 1,
                nombreCompleto: "Carlos Mamani",
                rol: "Guía",
            },
        ],
        servicios: [
            {
                tipo: "TRANSPORTE",
                nombreServicio: "Minibus Sprinter Cusco - Km 82",
            },
        ],
        equipamiento: [
            {
                nombreServicio: "Carpas Alta Montaña",
                tipoEquipamiento: "Carpa (para 3 personas)",
                cantidad: 4,
            },
        ],
    },
};
