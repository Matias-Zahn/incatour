import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { EtapaCircuito } from "../../services/circuitoService";
import {
    esquemaSecuenciaEtapas,
    type DatosEtapa,
} from "../../services/etapaService";
import { exigirRol } from "../autorizacion";
import {
    actualizarEtapasCircuitoMock,
    obtenerCircuitoMock,
} from "./circuitos";

const leerId = (valor: string | readonly string[] | undefined): number | null => {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
};

function serializarEtapa(etapa: {
    idcircuito: number;
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto?: string | null;
}) {
    return {
        idcircuito: etapa.idcircuito,
        numeroOrden: etapa.numeroOrden,
        puntoInicio: etapa.puntoInicio,
        puntoFin: etapa.puntoFin,
        campamentoPrevisto: etapa.campamentoPrevisto || null,
    };
}

export const manejadoresEtapas = [
    // CU-05: GET /api/circuitos/:idcircuito/etapas
    http.get(construirUrl("/circuitos/:idcircuito/etapas"), async ({ params, request }) => {
        await delay(150);
        const denegado = exigirRol(request, "ADMIN");
        if (denegado) return denegado;

        const idcircuito = leerId(params.idcircuito);
        if (!idcircuito) {
            return HttpResponse.json(
                { error: "El ID del circuito no es válido." },
                { status: 400 },
            );
        }

        const circuito = obtenerCircuitoMock(idcircuito);
        if (!circuito) {
            return HttpResponse.json({ error: "El circuito no existe." }, { status: 404 });
        }

        const etapas = (circuito.etapas ?? [])
            .slice()
            .sort((a, b) => a.numeroOrden - b.numeroOrden)
            .map(serializarEtapa);

        return HttpResponse.json({ data: etapas });
    }),

    // CU-05: PUT /api/circuitos/:idcircuito/etapas
    http.put(construirUrl("/circuitos/:idcircuito/etapas"), async ({ params, request }) => {
        await delay(200);
        const denegado = exigirRol(request, "ADMIN");
        if (denegado) return denegado;

        const idcircuito = leerId(params.idcircuito);
        if (!idcircuito) {
            return HttpResponse.json(
                { error: "El ID del circuito no es válido." },
                { status: 400 },
            );
        }

        const circuito = obtenerCircuitoMock(idcircuito);
        if (!circuito || circuito.estado !== "ACTIVO") {
            return HttpResponse.json(
                { error: "El circuito no existe o no está activo." },
                { status: 404 },
            );
        }

        if (circuito.tienePaquetesActivos) {
            return HttpResponse.json(
                {
                    error: "No se pueden modificar las etapas: el circuito ya tiene paquetes comerciales activos.",
                },
                { status: 400 },
            );
        }

        const cuerpo = (await request.json()) as { etapas?: unknown } | unknown[];
        const arregloRecibido = Array.isArray(cuerpo)
            ? (cuerpo as DatosEtapa[])
            : (cuerpo?.etapas as DatosEtapa[] | undefined);

        if (!Array.isArray(arregloRecibido)) {
            return HttpResponse.json(
                { error: "El campo 'etapas' debe ser un arreglo." },
                { status: 400 },
            );
        }

        if (arregloRecibido.length === 0) {
            return HttpResponse.json(
                { error: "La secuencia de etapas no puede estar vacía." },
                { status: 400 },
            );
        }

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

        const nuevasOrdenadas: EtapaCircuito[] = [...validacion.data.etapas]
            .sort((a, b) => a.numeroOrden - b.numeroOrden)
            .map((etapa) => ({
                idcircuito,
                numeroOrden: etapa.numeroOrden,
                puntoInicio: etapa.puntoInicio.trim(),
                puntoFin: etapa.puntoFin.trim(),
                campamentoPrevisto: etapa.campamentoPrevisto?.trim() || null,
            }));

        actualizarEtapasCircuitoMock(idcircuito, nuevasOrdenadas);

        return HttpResponse.json({
            mensaje: "Secuencia de etapas establecida exitosamente",
            data: nuevasOrdenadas.map(serializarEtapa),
        });
    }),
];
