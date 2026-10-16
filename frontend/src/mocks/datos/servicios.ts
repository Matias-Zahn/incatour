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
        categoria: "3 estrellas",
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
        costoBase: 120,
        localidad: "Urubamba",
        estado: "ACTIVO",
        capacidadVehiculo: 16,
        pesoEquipajeIncluido: 15,
        costoPorKgExcedente: 4,
    },
];
