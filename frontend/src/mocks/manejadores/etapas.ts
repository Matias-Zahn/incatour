import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import {
    esquemaSecuenciaEtapas,
    type Circuito,
    type DatosEtapa,
    type Etapa,
} from "../../services/etapaService";
import { circuitosSemilla, etapasSemilla } from "../datos/etapas";

const circuitos: Circuito[] = [...circuitosSemilla];
let etapas: Etapa[] = [...etapasSemilla];

function serializarEtapa(etapa: Etapa) {
    return {
        idcircuito: etapa.idcircuito,
        numeroOrden: etapa.numeroOrden,
        puntoInicio: etapa.puntoInicio,
        puntoFin: etapa.puntoFin,
        campamentoPrevisto: etapa.campamentoPrevisto || null,
    };
}

export const manejadoresEtapas = [
    http.get(construirUrl("/circuitos"), async () => {
        await delay();
        return HttpResponse.json({
            data: circuitos,
        });
    }),

    http.get(construirUrl("/circuitos/:idcircuito/etapas"), async ({ params }) => {
        await delay();
        const idcircuito = Number(params.idcircuito);
        if (!Number.isInteger(idcircuito) || idcircuito <= 0) {
            return HttpResponse.json(
                { error: "El ID del circuito no es válido." },
                { status: 400 },
            );
        }

        const circuito = circuitos.find((item) => item.idcircuito === idcircuito);
        if (!circuito) {
            return HttpResponse.json({ error: "El circuito no existe." }, { status: 404 });
        }

        const etapasDelCircuito = etapas
            .filter((etapa) => etapa.idcircuito === idcircuito)
            .sort((a, b) => a.numeroOrden - b.numeroOrden)
            .map(serializarEtapa);

        return HttpResponse.json({ data: etapasDelCircuito });
    }),

    http.put(construirUrl("/circuitos/:idcircuito/etapas"), async ({ params, request }) => {
        await delay();
        const idcircuito = Number(params.idcircuito);
        if (!Number.isInteger(idcircuito) || idcircuito <= 0) {
            return HttpResponse.json(
                { error: "El ID del circuito no es válido." },
                { status: 400 },
            );
        }

        const circuito = circuitos.find((item) => item.idcircuito === idcircuito);
        if (!circuito || circuito.estado !== "ACTIVO") {
            return HttpResponse.json(
                { error: "El circuito no existe o no está activo." },
                { status: 404 },
            );
        }

        const cuerpo = (await request.json()) as { etapas?: DatosEtapa[] } | DatosEtapa[];
        const arregloRecibido = Array.isArray(cuerpo) ? cuerpo : cuerpo.etapas;

        const validacion = esquemaSecuenciaEtapas.safeParse({ etapas: arregloRecibido });
        if (!validacion.success) {
            return HttpResponse.json(
                {
                    error:
                        validacion.error.issues[0]?.message ??
                        "Error de validación en la secuencia de etapas.",
                },
                { status: 400 },
            );
        }

        const nuevasOrdenadas: Etapa[] = [...validacion.data.etapas]
            .sort((a, b) => a.numeroOrden - b.numeroOrden)
            .map((etapa) => ({
                id: etapa.numeroOrden,
                idcircuito,
                numeroOrden: etapa.numeroOrden,
                puntoInicio: etapa.puntoInicio.trim(),
                puntoFin: etapa.puntoFin.trim(),
                campamentoPrevisto: etapa.campamentoPrevisto?.trim() ?? "",
            }));

        etapas = [
            ...etapas.filter((etapa) => etapa.idcircuito !== idcircuito),
            ...nuevasOrdenadas,
        ];

        return HttpResponse.json({
            mensaje: "Secuencia de etapas establecida exitosamente",
            data: nuevasOrdenadas.map(serializarEtapa),
        });
    }),
];
