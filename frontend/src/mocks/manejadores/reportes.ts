import { http, HttpResponse, delay } from "msw";
import { construirUrl } from "../../services/clienteApi";

const paquete = { id: "Camino Inca Clásico", paquete: "Camino Inca Clásico", reservas: 12, canceladas: 1, pasajeros: 26, facturado: 20280, reintegrado: 1560, neto: 18720 };

const datos = {
    ventas: {
        resumen: { reservas: 12, canceladas: 1, pasajeros: 26, facturado: 20280, reintegrado: 1560, neto: 18720 },
        porPaquete: [paquete],
        porMes: [{ ...paquete, id: "2026-06", mes: "2026-06" }],
    },
    ocupacion: {
        resumen: { salidas: 1, canceladas: 0, lugares: 16, ocupados: 12, ocupacion: 75 },
        porPaquete: [{ id: "Camino Inca Clásico", paquete: "Camino Inca Clásico", salidas: 1, capacidad: 16, ocupados: 12, ocupacion: 75 }],
        salidas: [{ id: 1, nroSalida: "SAL-2026-001", paquete: "Camino Inca Clásico", fechaInicio: "2026-06-10T00:00:00.000Z", estado: "FINALIZADA", capacidad: 16, ocupados: 12, ocupacion: 75 }],
    },
    cancelaciones: {
        resumen: { cancelaciones: 1, sinReintegro: 0, abonado: 1560, reintegrado: 1560, retenido: 0 },
        porOrigen: [{ id: "Cliente", nombre: "Cliente", cantidad: 1 }],
        porMotivo: [{ id: "Cambio de planes", nombre: "Cambio de planes", cantidad: 1 }],
        cancelaciones: [{ id: 1, nroReserva: "RES-1", paquete: "Camino Inca Clásico", nroSalida: "SAL-2026-001", fecha: "2026-05-02T15:00:00.000Z", origen: "Cliente", motivo: "Cambio de planes", abonado: 1560, reintegrado: 1560, retenido: 0 }],
    },
    solicitudes: {
        resumen: { solicitudes: 2, pendientes: 0, confirmadas: 1, rechazadas: 1, canceladas: 0, reintentos: 1, tasaAceptacion: 50 },
        porHotel: [{ id: "1", hotel: "Hotel Imperial Cusco", proveedor: "Hotel Imperial Cusco S.A.C.", contactos: 2, aceptadas: 1, rechazadas: 1, tasaAceptacion: 50 }],
        motivosRechazo: [{ id: "Cupo tomado por un grupo", nombre: "Cupo tomado por un grupo", cantidad: 1 }],
        solicitudes: [{
            id: 1, nroSolicitud: "SOL-RES-1", estado: "RECHAZADA", plazas: 2, fechaPedido: "2026-04-02T14:00:00.000Z", paquete: "Camino Inca Premium", nroSalida: "SAL-2026-002",
            gestiones: [{ hotel: "Hotel Imperial Cusco", resultado: "Rechazada", motivoRechazo: "Cupo tomado por un grupo", fechaRespuesta: "2026-04-03T12:00:00.000Z" }],
        }],
    },
    calidad: {
        resumen: { resenias: 1, valoracionPromedio: 5, incidentes: 1, puntajeProveedores: 4, puntajePersonal: 4.5 },
        reseniasPorPaquete: [{ id: "Camino Inca Clásico", nombre: "Camino Inca Clásico", cantidad: 1, promedio: 5 }],
        incidentesPorTipo: [{ id: "SALUD", nombre: "SALUD", cantidad: 1 }],
        incidentesPorGravedad: [{ id: "BAJO", nombre: "BAJO", cantidad: 1 }],
        proveedores: [{ id: "Trans Andes", nombre: "Trans Andes", cantidad: 1, promedio: 4 }],
        personal: [{ id: "Carlos Mendoza (Guía)", nombre: "Carlos Mendoza (Guía)", cantidad: 1, promedio: 4.5 }],
    },
};

export const manejadoresReportes = [
    http.get(construirUrl("/reportes/:tipo"), async ({ params }) => {
        await delay(150);
        return HttpResponse.json({ data: datos[params.tipo as keyof typeof datos] });
    }),
];
