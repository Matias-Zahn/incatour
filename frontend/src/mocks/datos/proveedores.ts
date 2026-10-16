import type { Proveedor } from "../../services/proveedorService";

export const proveedoresSemilla: Proveedor[] = [
    {
        id: 1,
        idproveedor: 1,
        tipoProveedor: "ALOJAMIENTO",
        razonSocial: "Hoteles del Cusco",
        localidad: "Cusco",
        datosContacto: "reservas@hoteles-cusco.pe",
        canalComunicacion: "Correo electrónico",
        estado: "ACTIVO",
        cantidadServicios: 2,
    },
    {
        id: 2,
        idproveedor: 2,
        tipoProveedor: "TRANSPORTE",
        razonSocial: "Transportes Urubamba",
        localidad: "Urubamba",
        datosContacto: "+51 984 555 111",
        canalComunicacion: "WhatsApp",
        estado: "ACTIVO",
        cantidadServicios: 1,
    },
];
