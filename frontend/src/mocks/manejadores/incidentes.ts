import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { IncidenteAdmin } from "../../services/guiaService";
import { exigirRol } from "../autorizacion";

const haceHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const incidentes: IncidenteAdmin[] = [
    {
        idincidente: 2,
        idsalida: 1,
        tipoIncidente: "Lesión de pasajero",
        descripcion: "Un pasajero sufrió una torcedura de tobillo en el descenso del paso; se evacuó con el apoyo del porteador.",
        nivelGravedad: "CRITICO",
        fechaHoraOcurrencia: haceHoras(3),
        fechaHoraReporte: haceHoras(2),
        salida: { nroSalida: "SAL-2026-001" },
        pasajeros: [{ pasajero: { nombreCompleto: "María Fernanda López" } }],
    },
    {
        idincidente: 1,
        idsalida: 2,
        tipoIncidente: "Demora en el tramo",
        descripcion: "Lluvia intensa retrasó la llegada al campamento una hora.",
        nivelGravedad: "BAJO",
        fechaHoraOcurrencia: haceHoras(30),
        fechaHoraReporte: haceHoras(29),
        salida: { nroSalida: "SAL-2026-002" },
        pasajeros: [],
    },
];

export const manejadoresIncidentes = [
    // GET /api/incidentes (CU-50, solo ADMIN)
    http.get(construirUrl("/incidentes"), async ({ request }) => {
        await delay();
        const falloAuth = exigirRol(request, "ADMIN");
        if (falloAuth) return falloAuth;
        return HttpResponse.json({ data: incidentes });
    }),
];
