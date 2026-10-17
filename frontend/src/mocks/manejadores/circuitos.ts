import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type {
    DatosCircuito,
    DatosEtapaCircuito,
} from "../../services/circuitoService";
import { circuitosIniciales, type CircuitoMock } from "../datos/circuitos";

let circuitos: CircuitoMock[] = [...circuitosIniciales];
let proximoId =
    Math.max(0, ...circuitos.map((circuito) => circuito.idcircuito)) + 1;

function respuestaError(mensajeError: string, status: number) {
    return HttpResponse.json(
        { error: mensajeError, mensaje: mensajeError },
        { status },
    );
}

export const manejadoresCircuitos = [
    // CU-01: GET /api/circuitos
    http.get(construirUrl("/circuitos"), async () => {
        await delay(200);
        const activos = circuitos.filter(
            (circuito) => circuito.estado === "ACTIVO",
        );
        return HttpResponse.json({ data: activos });
    }),

    // CU-02: POST /api/circuitos
    http.post(construirUrl("/circuitos"), async ({ request }) => {
        await delay(200);
        const cuerpo = (await request.json()) as Partial<DatosCircuito>;
        const nombreCircuito = cuerpo.nombreCircuito?.trim() ?? "";
        const dificultad = cuerpo.dificultad?.trim() ?? "";
        const duracionDias = Number(cuerpo.duracionDias);
        const minimoGuias = Number(cuerpo.minimoGuias);

        if (!nombreCircuito) {
            return respuestaError("nombreCircuito es requerido", 400);
        }
        if (!Number.isInteger(duracionDias) || duracionDias <= 0) {
            return respuestaError(
                "duracionDias debe ser un número mayor a 0",
                400,
            );
        }
        if (!dificultad) {
            return respuestaError("dificultad es requerido", 400);
        }
        if (!Number.isInteger(minimoGuias) || minimoGuias <= 0) {
            return respuestaError(
                "minimoGuias debe ser un número mayor a 0",
                400,
            );
        }

        const existeNombre = circuitos.some(
            (circuito) =>
                circuito.estado === "ACTIVO" &&
                circuito.nombreCircuito.toLowerCase() ===
                    nombreCircuito.toLowerCase(),
        );
        if (existeNombre) {
            return respuestaError(
                `Ya existe un circuito activo con el nombre "${nombreCircuito}".`,
                400,
            );
        }

        const nuevoCircuito: CircuitoMock = {
            idcircuito: proximoId++,
            nombreCircuito,
            duracionDias,
            dificultad,
            minimoGuias,
            parametrosPorteadores: cuerpo.parametrosPorteadores?.trim() || null,
            estado: "ACTIVO",
            etapas: [],
            tienePaquetesActivos: false,
        };

        circuitos = [...circuitos, nuevoCircuito];

        return HttpResponse.json(
            {
                mensaje: "Circuito creado exitosamente",
                data: nuevoCircuito,
            },
            { status: 201 },
        );
    }),

    // CU-03: PUT /api/circuitos/:id
    http.put(construirUrl("/circuitos/:id"), async ({ params, request }) => {
        await delay(200);
        const id = Number(params.id);
        if (Number.isNaN(id)) {
            return respuestaError("El ID proporcionado no es válido.", 400);
        }

        const indice = circuitos.findIndex(
            (circuito) => circuito.idcircuito === id,
        );
        if (indice === -1) {
            return respuestaError(
                `No se encontró el circuito con ID ${id}.`,
                404,
            );
        }

        const actual = circuitos[indice];
        if (actual.estado !== "ACTIVO") {
            return respuestaError(
                "No se puede modificar un circuito que no está activo.",
                400,
            );
        }

        const cuerpo = (await request.json()) as Partial<DatosCircuito>;
        const nuevoNombre =
            cuerpo.nombreCircuito !== undefined
                ? cuerpo.nombreCircuito.trim()
                : actual.nombreCircuito;

        if (
            cuerpo.nombreCircuito !== undefined &&
            circuitos.some(
                (circuito) =>
                    circuito.idcircuito !== id &&
                    circuito.estado === "ACTIVO" &&
                    circuito.nombreCircuito.toLowerCase() ===
                        nuevoNombre.toLowerCase(),
            )
        ) {
            return respuestaError(
                `Ya existe un circuito activo con el nombre "${nuevoNombre}".`,
                400,
            );
        }

        const actualizado: CircuitoMock = {
            ...actual,
            nombreCircuito: nuevoNombre,
            duracionDias:
                cuerpo.duracionDias !== undefined
                    ? Number(cuerpo.duracionDias)
                    : actual.duracionDias,
            dificultad:
                cuerpo.dificultad !== undefined
                    ? cuerpo.dificultad.trim()
                    : actual.dificultad,
            minimoGuias:
                cuerpo.minimoGuias !== undefined
                    ? Number(cuerpo.minimoGuias)
                    : actual.minimoGuias,
            parametrosPorteadores:
                cuerpo.parametrosPorteadores !== undefined
                    ? cuerpo.parametrosPorteadores.trim() || null
                    : actual.parametrosPorteadores,
        };

        circuitos = circuitos.map((circuito) =>
            circuito.idcircuito === id ? actualizado : circuito,
        );

        return HttpResponse.json({
            mensaje: "Circuito modificado exitosamente",
            data: actualizado,
        });
    }),

    // CU-04: PATCH /api/circuitos/:id/baja
    http.patch(construirUrl("/circuitos/:id/baja"), async ({ params }) => {
        await delay(200);
        const id = Number(params.id);
        if (Number.isNaN(id)) {
            return respuestaError("El ID proporcionado no es válido.", 400);
        }

        const circuito = circuitos.find((item) => item.idcircuito === id);
        if (!circuito) {
            return respuestaError(
                `No se encontró el circuito con ID ${id}.`,
                404,
            );
        }

        if (circuito.estado !== "ACTIVO") {
            return respuestaError(
                "El circuito ya se encuentra dado de baja.",
                400,
            );
        }

        if (circuito.tienePaquetesActivos) {
            return respuestaError(
                "No se puede dar de baja el circuito porque tiene paquetes activos asociados.",
                400,
            );
        }

        const dadoDeBaja: CircuitoMock = {
            ...circuito,
            estado: "INACTIVO",
        };

        circuitos = circuitos.map((item) =>
            item.idcircuito === id ? dadoDeBaja : item,
        );

        return HttpResponse.json({
            mensaje: "Circuito dado de baja exitosamente",
            data: dadoDeBaja,
        });
    }),

    // CU-05: GET /api/circuitos/:idcircuito/etapas
    http.get(
        construirUrl("/circuitos/:idcircuito/etapas"),
        async ({ params }) => {
            await delay(150);
            const idCircuito = Number(params.idcircuito);
            const circuito = circuitos.find(
                (item) => item.idcircuito === idCircuito,
            );
            if (!circuito) {
                return respuestaError("El circuito no existe.", 404);
            }
            return HttpResponse.json({ data: circuito.etapas ?? [] });
        },
    ),

    // CU-05: PUT /api/circuitos/:idcircuito/etapas
    http.put(
        construirUrl("/circuitos/:idcircuito/etapas"),
        async ({ params, request }) => {
            await delay(200);
            const idCircuito = Number(params.idcircuito);
            const circuito = circuitos.find(
                (item) => item.idcircuito === idCircuito,
            );
            if (!circuito || circuito.estado !== "ACTIVO") {
                return respuestaError(
                    "El circuito no existe o no está activo.",
                    404,
                );
            }
            if (circuito.tienePaquetesActivos) {
                return respuestaError(
                    "No se pueden modificar las etapas: el circuito ya tiene paquetes comerciales activos.",
                    400,
                );
            }

            const cuerpo = (await request.json()) as {
                etapas?: DatosEtapaCircuito[];
            };
            const lista = cuerpo.etapas;
            if (!Array.isArray(lista) || lista.length === 0) {
                return respuestaError(
                    "La secuencia de etapas no puede estar vacía.",
                    400,
                );
            }

            const ordenadas = [...lista].sort(
                (a, b) => a.numeroOrden - b.numeroOrden,
            );
            for (let i = 0; i < ordenadas.length; i++) {
                if (ordenadas[i].numeroOrden !== i + 1) {
                    return respuestaError(
                        `La correlatividad temporal falló. Se esperaba la etapa ${
                            i + 1
                        } pero se encontró la ${ordenadas[i].numeroOrden}.`,
                        400,
                    );
                }
                if (
                    i < ordenadas.length - 1 &&
                    ordenadas[i].puntoFin !== ordenadas[i + 1].puntoInicio
                ) {
                    return respuestaError(
                        `Discontinuidad espacial: El fin de la etapa ${
                            ordenadas[i].numeroOrden
                        } ('${ordenadas[i].puntoFin}') no coincide con el inicio de la etapa ${
                            ordenadas[i + 1].numeroOrden
                        } ('${ordenadas[i + 1].puntoInicio}').`,
                        400,
                    );
                }
            }

            const nuevasEtapas = ordenadas.map((etapa) => ({
                idcircuito: idCircuito,
                numeroOrden: etapa.numeroOrden,
                puntoInicio: etapa.puntoInicio,
                puntoFin: etapa.puntoFin,
                campamentoPrevisto: etapa.campamentoPrevisto ?? null,
            }));

            circuitos = circuitos.map((item) =>
                item.idcircuito === idCircuito
                    ? { ...item, etapas: nuevasEtapas }
                    : item,
            );

            return HttpResponse.json({
                mensaje: "Secuencia de etapas establecida exitosamente",
                data: nuevasEtapas,
            });
        },
    ),
];
