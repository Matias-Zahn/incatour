import type { Servicio } from "../../services/servicioService";

export const serviciosSemilla: Servicio[] = [
    {
        id: 1,
        idservicio: 1,
        idproveedor: 1,
        tipo: "ALOJAMIENTO",
        nombreServicio: "Hotel Valle Sagrado",
        descripcion: "Habitación doble con desayuno.",
        costoBase: 85,
        localidad: "Cusco",
        estado: "ACTIVO",
        categoria: "3 Estrellas",
        tipoHabitacion: "Doble",
        capacidadDisponible: 20,
        modalidadConfirmacion: "BLOQUEO_PLAZAS",
    },
    {
        id: 2,
        idservicio: 2,
        idproveedor: 2,
        tipo: "TRANSPORTE",
        nombreServicio: "Van turística",
        descripcion: "Traslado privado.",
        costoBase: 480,
        localidad: "Cusco",
        estado: "ACTIVO",
        capacidadVehiculo: 24,
        pesoEquipajeIncluido: 15,
        costoPorKgExcedente: 2.5,
    },
    {
        id: 3,
        idservicio: 3,
        idproveedor: 3,
        tipo: "EQUIPAMIENTO",
        nombreServicio: "Carpa 4 estaciones",
        descripcion: "Carpa de alta montaña para 2 personas.",
        costoBase: 80,
        localidad: "Cusco",
        estado: "ACTIVO",
        tipoEquipamiento: "Carpa",
        cantidadDisponible: 12,
        cantidadComprometida: 4,
        inventarioTotal: 16,
    },
    {
        id: 4,
        idservicio: 4,
        idproveedor: 4,
        tipo: "TREN",
        nombreServicio: "IncaRail Expedition",
        descripcion: "Tren panorámico de regreso a Ollantaytambo.",
        costoBase: 85,
        localidad: "Cusco",
        estado: "ACTIVO",
        horarioSalida: "06:10",
        horarioLlegada: "07:45",
        diasOperacion: "L-M-X-J-V",
    },
    {
        id: 5,
        idservicio: 5,
        idproveedor: 1,
        tipo: "ALOJAMIENTO",
        nombreServicio: "Hotel Sol Andino",
        descripcion: "Hotel boutique céntrico a confirmación.",
        costoBase: 110,
        localidad: "Cusco",
        estado: "ACTIVO",
        categoria: "3 Estrellas",
        tipoHabitacion: "Doble",
        modalidadConfirmacion: "A_SOLICITUD",
    },
    {
        id: 6,
        idservicio: 6,
        idproveedor: 2,
        tipo: "TRANSPORTE",
        nombreServicio: "Bus turístico Cusco (40 asientos)",
        descripcion: "Micro de gran porte para contingentes completos con personal.",
        costoBase: 720,
        localidad: "Cusco",
        estado: "ACTIVO",
        capacidadVehiculo: 40,
    },
];

/** Servicios con solicitudes de alojamiento pendientes (bloquean la baja, CU-21). */
export const serviciosConSolicitudesPendientes = new Set<number>();

/** Servicios asignados a salidas activas o en curso (bloquean la baja, CU-21, y activan versionado en CU-20). */
export const serviciosEnSalidasActivas = new Set<number>([2]);

/** Alojamientos garantizados por paquetes activos (restringen edición en CU-20 y bloquean la baja en CU-21). */
export const serviciosGarantizadosPorPaquetesActivos = new Set<number>([1]);
