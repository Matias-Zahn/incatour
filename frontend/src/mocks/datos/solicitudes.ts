import type { SolicitudPendiente } from "../../services/solicitudService";
import { salidasMockIniciales } from "./salidas";

const salidaSal001 = salidasMockIniciales.find((s) => s.nroSalida === "SAL-2026-001");

export const hotelesCompatiblesMock = [
  {
    idservicio: 1,
    nombreServicio: "Hotel Montaña",
    localidad: "Cusco",
    categoria: "3 Estrellas",
    tipoHabitacion: "Doble",
    proveedor: "Andes Travel",
  },
  {
    idservicio: 2,
    nombreServicio: "Hotel Valle Sagrado",
    localidad: "Cusco",
    categoria: "3 Estrellas",
    tipoHabitacion: "Doble",
    proveedor: "Andes Travel",
  },
];

export const solicitudesIniciales: SolicitudPendiente[] = [
  {
    id: 1,
    idsolicitud: 1,
    idreserva: 1,
    idservicio: 1,
    nroSolicitud: "SOL-0001",
    estado: "PENDIENTE",
    cantidadPlazas: 1,
    reserva: {
      idreserva: 1,
      nroReserva: "RES-0001",
      cantidadPasajeros: 1,
      precioCongelado: 1500,
      estado: "CONFIRMADA",
      cliente: {
        idcliente: 1,
        nroCliente: "CLI-001",
      },
      salida: {
        idsalida: 1,
        nroSalida: "SAL-2026-001",
        fechaInicio: salidaSal001?.fechaInicio ?? "2026-11-15T00:00:00.000Z",
        fechaFin: salidaSal001?.fechaFin ?? "2026-11-18T00:00:00.000Z",
        estado: "PUBLICADA",
        paquete: {
          idpaquete: 1,
          nroPaquete: "PAQ-INC-01",
          nombrePaquete: "Inca Clásico Standard",
          tipoGarantia: "Por Categoría",
          categoriaGarantizada: "3 Estrellas",
          localidadGarantizada: "Cusco",
          tipoHabitacionGarantizada: "Doble",
        },
      },
    },
  },
];
