import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { DatosTemporada } from "../../services/temporadaService";
import { temporadasIniciales, type TemporadaMock } from "../datos/temporadas";

let temporadas: TemporadaMock[] = [...temporadasIniciales];
let proximoId =
    Math.max(0, ...temporadas.map((temporada) => temporada.idtemporada)) + 1;

function respuestaError(mensajeError: string, status: number) {
    return HttpResponse.json(
        { error: mensajeError, mensaje: mensajeError },
        { status },
    );
}

export const manejadoresTemporadas = [
    // CU-06: GET /api/temporadas
    http.get(construirUrl("/temporadas"), async () => {
        await delay(150);
        const activas = temporadas.filter(
            (temporada) => temporada.estado === "ACTIVO",
        );
        return HttpResponse.json({ data: activas });
    }),

    // CU-07: POST /api/temporadas
    http.post(construirUrl("/temporadas"), async ({ request }) => {
        await delay(200);
        const cuerpo = (await request.json()) as Partial<DatosTemporada>;
        const nombre = cuerpo.nombre?.trim() ?? "";
        const fechaInicio = cuerpo.fechaInicio ?? "";
        const fechaFin = cuerpo.fechaFin ?? "";

        if (!nombre) {
            return respuestaError(
                "nombre es requerido y debe ser texto",
                400,
            );
        }
        if (!fechaInicio || !fechaFin) {
            return respuestaError(
                "fechaInicio y fechaFin son requeridas",
                400,
            );
        }
        if (new Date(fechaInicio) >= new Date(fechaFin)) {
            return respuestaError(
                "fechaInicio debe ser anterior a fechaFin",
                400,
            );
        }

        const existe = temporadas.some(
            (item) =>
                item.estado === "ACTIVO" &&
                item.nombre.toLowerCase() === nombre.toLowerCase(),
        );
        if (existe) {
            return respuestaError(
                "Ya existe una temporada activa con ese nombre.",
                400,
            );
        }

        const nueva: TemporadaMock = {
            idtemporada: proximoId++,
            nombre,
            fechaInicio: new Date(fechaInicio).toISOString(),
            fechaFin: new Date(fechaFin).toISOString(),
            estado: "ACTIVO",
            tieneTarifasAsociadas: false,
        };

        temporadas = [...temporadas, nueva];

        return HttpResponse.json(
            {
                mensaje: "Temporada creada exitosamente",
                data: nueva,
            },
            { status: 201 },
        );
    }),

    // CU-08: PUT /api/temporadas/:id
    http.put(construirUrl("/temporadas/:id"), async ({ params, request }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = temporadas.find((item) => item.idtemporada === id);
        if (!actual || actual.estado !== "ACTIVO") {
            return respuestaError(
                "Temporada no encontrada o inactiva.",
                404,
            );
        }

        const cuerpo = (await request.json()) as Partial<DatosTemporada>;
        const nuevoNombre = cuerpo.nombre?.trim() ?? actual.nombre;
        const nuevaInicio = cuerpo.fechaInicio
            ? new Date(cuerpo.fechaInicio).toISOString()
            : actual.fechaInicio;
        const nuevaFin = cuerpo.fechaFin
            ? new Date(cuerpo.fechaFin).toISOString()
            : actual.fechaFin;

        if (
            temporadas.some(
                (item) =>
                    item.idtemporada !== id &&
                    item.estado === "ACTIVO" &&
                    item.nombre.toLowerCase() === nuevoNombre.toLowerCase(),
            )
        ) {
            return respuestaError(
                "Ya existe otra temporada activa con ese nombre.",
                400,
            );
        }

        if (new Date(nuevaInicio) >= new Date(nuevaFin)) {
            return respuestaError(
                "La fecha de inicio debe ser anterior a la fecha de fin.",
                400,
            );
        }

        const actualizada: TemporadaMock = {
            ...actual,
            nombre: nuevoNombre,
            fechaInicio: nuevaInicio,
            fechaFin: nuevaFin,
        };

        temporadas = temporadas.map((item) =>
            item.idtemporada === id ? actualizada : item,
        );

        return HttpResponse.json({
            mensaje: "Temporada modificada exitosamente",
            data: actualizada,
        });
    }),

    // CU-09: PATCH /api/temporadas/:id/baja
    http.patch(construirUrl("/temporadas/:id/baja"), async ({ params }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = temporadas.find((item) => item.idtemporada === id);
        if (!actual || actual.estado !== "ACTIVO") {
            return respuestaError(
                "Temporada no encontrada o ya inactiva.",
                404,
            );
        }

        if (actual.tieneTarifasAsociadas) {
            return respuestaError(
                "No se puede dar de baja porque tiene tarifas de paquetes asociadas.",
                400,
            );
        }

        const dadaDeBaja: TemporadaMock = {
            ...actual,
            estado: "INACTIVO",
        };

        temporadas = temporadas.map((item) =>
            item.idtemporada === id ? dadaDeBaja : item,
        );

        return HttpResponse.json({
            mensaje: "Temporada dada de baja exitosamente",
            data: dadaDeBaja,
        });
    }),
];
