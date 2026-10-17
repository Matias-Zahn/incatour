import { http, HttpResponse, delay } from "msw";
import { solicitudesIniciales, hotelesCompatiblesMock } from "../datos/solicitudes";
import type {
  SolicitudPendiente,
  ResolverSolicitudPayload,
} from "../../services/solicitudService";

const solicitudes: SolicitudPendiente[] = structuredClone(solicitudesIniciales);
const serviciosRechazadosPorReserva = new Map<number, Set<number>>();
let proximoId = 2;

export const manejadoresSolicitudes = [
  // CU-33: GET /api/solicitudes
  http.get("*/api/solicitudes", async () => {
    await delay(150);
    const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");
    return HttpResponse.json({
      mensaje: "Solicitudes pendientes recuperadas con éxito",
      cantidad: pendientes.length,
      data: pendientes,
    });
  }),

  // CU-34 Fase 1: GET /api/solicitudes/:id/opciones
  http.get("*/api/solicitudes/:id/opciones", async ({ params }) => {
    await delay(150);
    const id = Number(params.id);
    const sol = solicitudes.find((s) => s.idsolicitud === id);
    if (!sol) {
      return HttpResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    if (sol.estado !== "PENDIENTE") {
      return HttpResponse.json({ error: "La solicitud no está PENDIENTE" }, { status: 400 });
    }

    const paquete = sol.reserva.salida.paquete;
    const rechazados = serviciosRechazadosPorReserva.get(sol.idreserva) ?? new Set<number>();

    const compatibles = hotelesCompatiblesMock.filter(
      (s) =>
        s.localidad === paquete.localidadGarantizada &&
        s.categoria === paquete.categoriaGarantizada &&
        s.tipoHabitacion === paquete.tipoHabitacionGarantizada &&
        !rechazados.has(s.idservicio),
    );

    if (compatibles.length === 0) {
      return HttpResponse.json(
        { error: "La salida no podrá consolidarse. Gestione un proveedor por fuera del sistema." },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      solicitudId: sol.idsolicitud,
      reserva: sol.reserva.nroReserva,
      cliente: sol.reserva.cliente.nroCliente,
      criteriosGarantizados: {
        localidad: paquete.localidadGarantizada ?? "Cusco",
        categoria: paquete.categoriaGarantizada ?? "3 Estrellas",
        tipoHabitacion: paquete.tipoHabitacionGarantizada ?? "Doble",
      },
      opcionesContacto: compatibles.map((s) => ({
        servicioId: s.idservicio,
        hotel: s.nombreServicio,
        proveedor: s.proveedor,
        canalContacto: "Por fuera del sistema",
      })),
    });
  }),

  // CU-34 Fase 2: POST /api/solicitudes/:id/resolver
  http.post("*/api/solicitudes/:id/resolver", async ({ params, request }) => {
    await delay(200);
    const id = Number(params.id);
    const body = (await request.json()) as ResolverSolicitudPayload;
    const sol = solicitudes.find((s) => s.idsolicitud === id);

    if (!sol || sol.estado !== "PENDIENTE") {
      return HttpResponse.json({ error: "Solicitud inválida o ya resuelta" }, { status: 400 });
    }

    if (body.resolucion === "RECHAZADA") {
      if (!body.motivo?.trim()) {
        return HttpResponse.json(
          { error: "El motivo es obligatorio cuando la solicitud es RECHAZADA" },
          { status: 400 },
        );
      }
      sol.estado = "RECHAZADA";
      const setRechazados = serviciosRechazadosPorReserva.get(sol.idreserva) ?? new Set<number>();
      setRechazados.add(body.servicioId);
      serviciosRechazadosPorReserva.set(sol.idreserva, setRechazados);

      const nuevoId = proximoId++;
      const nuevaSol: SolicitudPendiente = {
        ...structuredClone(sol),
        id: nuevoId,
        idsolicitud: nuevoId,
        idservicio: body.servicioId,
        nroSolicitud: `${sol.nroSolicitud}-R`,
        estado: "PENDIENTE",
      };
      solicitudes.push(nuevaSol);

      return HttpResponse.json({
        mensaje: "Rechazo registrado. Se generó una solicitud nueva en estado Pendiente.",
        nuevaSolicitudId: nuevaSol.idsolicitud,
      });
    }

    sol.estado = "CONFIRMADA";
    sol.idservicio = body.servicioId;

    const pendientesEnSalida = solicitudes.filter(
      (s) => s.estado === "PENDIENTE" && s.reserva.salida.idsalida === sol.reserva.salida.idsalida,
    ).length;

    return HttpResponse.json({
      mensaje: "Solicitud Confirmada exitosamente.",
      solicitudesPendientesRestantesEnSalida: pendientesEnSalida,
    });
  }),
];
