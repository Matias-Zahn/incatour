import type { Proveedor } from "../../services/proveedorService";

export const proveedoresSemilla: Proveedor[] = [
    {
        idproveedor: 1,
        tipoProveedor: "ALOJAMIENTO",
        razonSocial: "Hoteles del Cusco",
        localidad: "Cusco",
        datosContacto: "reservas@hoteles-cusco.pe",
        canalComunicacion: "Correo electrónico",
        estado: "ACTIVO",
    },
    {
        idproveedor: 2,
        tipoProveedor: "TRANSPORTE",
        razonSocial: "Transportes Urubamba",
        localidad: "Urubamba",
        datosContacto: "+51 984 555 111",
        canalComunicacion: "WhatsApp",
        estado: "ACTIVO",
    },
    {
        idproveedor: 3,
        tipoProveedor: "EQUIPAMIENTO",
        razonSocial: "Andes Outdoor",
        localidad: "Cusco",
        datosContacto: "ventas@andes-outdoor.pe",
        canalComunicacion: "Correo electrónico",
        estado: "ACTIVO",
    },
];

/** Proveedores con solicitudes de alojamiento pendientes (bloquean la baja, CU-17). */
export const proveedoresConSolicitudesPendientes = new Set<number>([1]);

/** Proveedores con servicios asignados a salidas activas o en curso (bloquean la baja, CU-17). */
export const proveedoresConSalidasActivas = new Set<number>([2]);
