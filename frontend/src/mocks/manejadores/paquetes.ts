import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import {
    DIAS_CIERRE_VENTA_DEFECTO,
    parsearDiasDisponibles,
    type CalendarioSalidasPaquete,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type ItemDesgloseCosto,
    type Paquete,
    type SimularCostoPayload,
} from "../../services/paqueteService";
import { circuitosIniciales } from "../datos/circuitos";
import { paquetesIniciales, type PaqueteMock } from "../datos/paquetes";
import { temporadasIniciales } from "../datos/temporadas";
import { obtenerServiciosMock } from "./servicios";

let paquetes: PaqueteMock[] = [...paquetesIniciales];
let proximoId =
    Math.max(0, ...paquetes.map((paquete) => paquete.idpaquete)) + 1;

export function obtenerPaquetesMock(): PaqueteMock[] {
    return paquetes;
}

const redondear2 = (n: number) => Math.round(n * 100) / 100;

function respuestaError(mensajeError: string, status: number) {
    return HttpResponse.json(
        { error: mensajeError, mensaje: mensajeError },
        { status },
    );
}

function fechaMinimaIso(diasCierre: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + diasCierre + 1);
    return d.toISOString().slice(0, 10);
}

function calcularCalendarioSalidas(paquete: PaqueteMock): CalendarioSalidasPaquete {
    const diasPaquete = parsearDiasDisponibles(paquete.diasDisponibles);
    const tren = paquete.servicios?.find((s) => s.tipo === "TREN")?.servicio?.tren;
    const diasHabilitados = tren?.diasOperacion
        ? diasPaquete.filter((d) => parsearDiasDisponibles(tren.diasOperacion).includes(d))
        : diasPaquete;
    return {
        diasHabilitados,
        fechaMinima: fechaMinimaIso(paquete.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO),
    };
}

function armarServiciosPaquete(
    idpaquete: number,
    idtransporte: number | undefined,
    idtren: number | null | undefined,
    equipo: { idservicio: number; cantidad: number; cadaPasajeros: number | null }[] | undefined,
): NonNullable<Paquete["servicios"]> {
    const lista: NonNullable<Paquete["servicios"]> = [];
    if (idtransporte) {
        const s = obtenerServiciosMock().find((item) => item.idservicio === idtransporte);
        lista.push({
            idpaquete,
            idservicio: idtransporte,
            tipo: "TRANSPORTE",
            cantidad: null,
            cadaPasajeros: null,
            servicio: {
                idservicio: idtransporte,
                nombreServicio: s?.nombreServicio ?? `Transporte #${idtransporte}`,
                localidad: s?.localidad ?? "Cusco",
                costoBase: s?.costoBase ?? 0,
            },
        });
    }
    if (idtren) {
        const s = obtenerServiciosMock().find((item) => item.idservicio === idtren);
        lista.push({
            idpaquete,
            idservicio: idtren,
            tipo: "TREN",
            cantidad: null,
            cadaPasajeros: null,
            servicio: {
                idservicio: idtren,
                nombreServicio: s?.nombreServicio ?? `Tren #${idtren}`,
                localidad: s?.localidad ?? "Cusco",
                costoBase: s?.costoBase ?? 0,
                tren: {
                    horarioSalida: s?.horarioSalida ?? "06:10",
                    horarioLlegada: s?.horarioLlegada ?? "07:45",
                    diasOperacion: s?.diasOperacion ?? "L-M-X-J-V-S-D",
                },
            },
        });
    }
    for (const eq of equipo ?? []) {
        const s = obtenerServiciosMock().find((item) => item.idservicio === eq.idservicio);
        lista.push({
            idpaquete,
            idservicio: eq.idservicio,
            tipo: "EQUIPAMIENTO",
            cantidad: eq.cantidad,
            cadaPasajeros: eq.cadaPasajeros,
            servicio: {
                idservicio: eq.idservicio,
                nombreServicio: s?.nombreServicio ?? `Equipo #${eq.idservicio}`,
                localidad: s?.localidad ?? "Cusco",
                costoBase: s?.costoBase ?? 0,
                equipamiento: {
                    tipoEquipamiento: s?.tipoEquipamiento ?? "Equipamiento",
                },
            },
        });
    }
    return lista;
}

export const manejadoresPaquetes = [
    // B5: POST /api/paquetes/costos/simular
    http.post(construirUrl("/paquetes/costos/simular"), async ({ request }) => {
        await delay(120);
        const body = (await request.json()) as Partial<SimularCostoPayload>;
        const pasajeros = body.pasajeros ?? 0;
        if (!Number.isInteger(pasajeros) || pasajeros < 1 || pasajeros > 100) {
            return respuestaError(
                "pasajeros es requerido y debe ser un número entero entre 1 y 100.",
                400,
            );
        }
        const nochesPrevias = body.nochesPrevias ?? 0;
        const nochesPosteriores = body.nochesPosteriores ?? 0;
        const noches = nochesPrevias + nochesPosteriores;

        const desglose: ItemDesgloseCosto[] = [];
        const avisos: string[] = [];

        if (noches > 0) {
            if (body.tipoGarantia === "POR_ESTABLECIMIENTO") {
                const hotel = obtenerServiciosMock().find(
                    (s) => s.idservicio === body.idservicioGarantizado && s.tipo === "ALOJAMIENTO",
                );
                if (hotel) {
                    desglose.push({
                        tipo: "ALOJAMIENTO",
                        idservicio: hotel.idservicio,
                        nombreServicio: hotel.nombreServicio,
                        costoBase: hotel.costoBase,
                        calculo: `${hotel.costoBase} × ${noches} ${noches === 1 ? "noche" : "noches"}`,
                        porPasajero: redondear2(hotel.costoBase * noches),
                    });
                } else {
                    avisos.push("Elegí un hotel garantizado para incluir el alojamiento en el costo.");
                }
            } else {
                const localidad = (body.localidadGarantizada ?? "").trim().toLowerCase();
                const categoria = (body.categoriaGarantizada ?? "").trim().toLowerCase();
                const habitacion = (body.tipoHabitacionGarantizada ?? "").trim().toLowerCase();
                const candidatos = obtenerServiciosMock()
                    .filter(
                        (s) =>
                            s.tipo === "ALOJAMIENTO" &&
                            s.estado === "ACTIVO" &&
                            s.localidad.toLowerCase() === localidad &&
                            (s.categoria ?? "").toLowerCase() === categoria &&
                            (s.tipoHabitacion ?? "").toLowerCase() === habitacion,
                    )
                    .sort((a, b) => a.costoBase - b.costoBase);
                const masCaro = candidatos[0];
                if (masCaro) {
                    desglose.push({
                        tipo: "ALOJAMIENTO",
                        idservicio: masCaro.idservicio,
                        nombreServicio: `${masCaro.nombreServicio} (más económico de la categoría)`,
                        costoBase: masCaro.costoBase,
                        calculo: `${masCaro.costoBase} × ${noches} ${noches === 1 ? "noche" : "noches"}`,
                        porPasajero: redondear2(masCaro.costoBase * noches),
                    });
                } else {
                    avisos.push(
                        `Ningún hotel de ${body.localidadGarantizada ?? "-"} cumple ${body.categoriaGarantizada ?? "-"} · ${body.tipoHabitacionGarantizada ?? "-"}: el costo no incluye el hotel`,
                    );
                }
            }
        }

        if (body.idtransporte) {
            const t = obtenerServiciosMock().find(
                (s) => s.idservicio === body.idtransporte && s.tipo === "TRANSPORTE",
            );
            if (!t) {
                return respuestaError(
                    `El servicio con ID ${body.idtransporte} no es un transporte.`,
                    400,
                );
            }
            desglose.push({
                tipo: "TRANSPORTE",
                idservicio: t.idservicio,
                nombreServicio: t.nombreServicio,
                costoBase: t.costoBase,
                calculo: `${t.costoBase} ÷ ${pasajeros} ${pasajeros === 1 ? "pasajero" : "pasajeros"}`,
                porPasajero: redondear2(t.costoBase / pasajeros),
            });
        }

        if (body.idtren) {
            const tr = obtenerServiciosMock().find(
                (s) => s.idservicio === body.idtren && s.tipo === "TREN",
            );
            if (!tr) {
                return respuestaError(
                    `El servicio con ID ${body.idtren} no es un tren.`,
                    400,
                );
            }
            desglose.push({
                tipo: "TREN",
                idservicio: tr.idservicio,
                nombreServicio: tr.nombreServicio,
                costoBase: tr.costoBase,
                calculo: `${tr.costoBase} por pasajero`,
                porPasajero: redondear2(tr.costoBase),
            });
        }

        for (const item of body.equipo ?? []) {
            const eq = obtenerServiciosMock().find(
                (s) => s.idservicio === item.idservicio && s.tipo === "EQUIPAMIENTO",
            );
            if (!eq) {
                return respuestaError(
                    `El servicio con ID ${item.idservicio} no es un equipamiento.`,
                    400,
                );
            }
            desglose.push({
                tipo: "EQUIPAMIENTO",
                idservicio: eq.idservicio,
                nombreServicio: eq.nombreServicio,
                costoBase: eq.costoBase,
                calculo: item.cadaPasajeros
                    ? `${eq.costoBase} × ${item.cantidad} ÷ ${item.cadaPasajeros}`
                    : `${eq.costoBase} × ${item.cantidad} por salida ÷ ${pasajeros} pasajeros`,
                porPasajero: redondear2((eq.costoBase * item.cantidad) / (item.cadaPasajeros ?? pasajeros)),
            });
        }

        const costoPorPasajero = redondear2(
            desglose.reduce((acum, item) => acum + item.porPasajero, 0),
        );

        return HttpResponse.json({
            data: {
                costoPorPasajero,
                moneda: "USD",
                desglose,
                avisos,
            },
        });
    }),

    // CU-10: GET /api/paquetes
    http.get(construirUrl("/paquetes"), async ({ request }) => {
        await delay(150);
        const estado = new URL(request.url).searchParams.get("estado");
        const filtrados = paquetes
            .filter((p) => !estado || estado === "TODOS" || p.estado === estado)
            .map((p) => ({
                ...p,
                diasCierreVenta: p.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO,
                faltaTransporte:
                    p.faltaTransporte ?? !(p.servicios?.some((s) => s.tipo === "TRANSPORTE")),
            }));
        return HttpResponse.json({ data: filtrados });
    }),

    // GET /api/paquetes/:id
    http.get(construirUrl("/paquetes/:id"), async ({ params }) => {
        await delay(150);
        const id = Number(params.id);
        const paquete = paquetes.find((item) => item.idpaquete === id);
        if (!paquete) {
            return respuestaError("Paquete no encontrado o inactivo.", 404);
        }
        return HttpResponse.json({
            data: {
                ...paquete,
                diasCierreVenta: paquete.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO,
                faltaTransporte:
                    paquete.faltaTransporte ??
                    !(paquete.servicios?.some((s) => s.tipo === "TRANSPORTE")),
                calendarioSalidas: calcularCalendarioSalidas(paquete),
            },
        });
    }),

    // CU-11: POST /api/paquetes
    http.post(construirUrl("/paquetes"), async ({ request }) => {
        await delay(200);
        const cuerpo = (await request.json()) as Partial<DatosCrearPaquete> & {
            serviciosIncluidos?: unknown;
        };

        if (cuerpo.serviciosIncluidos !== undefined) {
            return respuestaError(
                "serviciosIncluidos ya no se usa: mandá idtransporte, idtren y equipo.",
                400,
            );
        }
        if (!cuerpo.nombrePaquete?.trim()) {
            return respuestaError("nombrePaquete es requerido.", 400);
        }
        if (!cuerpo.idcircuito) {
            return respuestaError("idcircuito es requerido.", 400);
        }
        if (!cuerpo.localidadGarantizada?.trim()) {
            return respuestaError("localidadGarantizada (Sale desde) es obligatoria.", 400);
        }
        if (!cuerpo.idtransporte || !Number.isInteger(cuerpo.idtransporte)) {
            return respuestaError(
                "idtransporte es requerido y debe ser un número entero mayor a 0.",
                400,
            );
        }
        if (
            !Array.isArray(cuerpo.matrizPrecios) ||
            cuerpo.matrizPrecios.length === 0
        ) {
            return respuestaError(
                "La matriz de precios es obligatoria y debe contener al menos una tarifa.",
                400,
            );
        }

        const id = proximoId++;
        const nroPaquete = `PKG-${String(id).padStart(4, "0")}`;
        const circuito = circuitosIniciales.find(
            (c) => c.idcircuito === cuerpo.idcircuito,
        );
        const hotelGarantizado = cuerpo.idservicioGarantizado
            ? obtenerServiciosMock().find((s) => s.idservicio === cuerpo.idservicioGarantizado)
            : undefined;
        if (
            cuerpo.tipoGarantia === "POR_ESTABLECIMIENTO" &&
            hotelGarantizado &&
            hotelGarantizado.localidad.toLowerCase() !==
                cuerpo.localidadGarantizada.trim().toLowerCase()
        ) {
            return respuestaError(
                `El hotel garantizado está en ${hotelGarantizado.localidad} y el paquete sale desde ${cuerpo.localidadGarantizada.trim()}.`,
                400,
            );
        }

        const nuevo: PaqueteMock = {
            idpaquete: id,
            idcircuito: cuerpo.idcircuito,
            nroPaquete,
            nombrePaquete: cuerpo.nombrePaquete.trim(),
            condiciones: cuerpo.condiciones?.trim() || null,
            estado: "ACTIVO",
            tipoGarantia: cuerpo.tipoGarantia ?? "POR_CATEGORIA",
            localidadGarantizada: cuerpo.localidadGarantizada.trim(),
            categoriaGarantizada: cuerpo.categoriaGarantizada ?? null,
            tipoHabitacionGarantizada: cuerpo.tipoHabitacionGarantizada ?? null,
            nochesPrevias: cuerpo.nochesPrevias ?? 0,
            nochesPosteriores: cuerpo.nochesPosteriores ?? 0,
            diasMinimosReintegro: cuerpo.diasMinimosReintegro ?? null,
            diasDisponibles: cuerpo.diasDisponibles ?? null,
            diasCierreVenta: cuerpo.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO,
            faltaTransporte: false,
            tieneSalidasActivas: false,
            circuito,
            servicios: armarServiciosPaquete(
                id,
                cuerpo.idtransporte,
                cuerpo.idtren,
                cuerpo.equipo,
            ),
            ...(hotelGarantizado
                ? {
                      garantiasEstablecimiento: [
                          {
                              idpaquete: id,
                              idservicio: hotelGarantizado.idservicio,
                              servicio: {
                                  idservicio: hotelGarantizado.idservicio,
                                  nombreServicio: hotelGarantizado.nombreServicio,
                                  localidad: hotelGarantizado.localidad,
                                  alojamiento: {
                                      categoria: hotelGarantizado.categoria ?? "",
                                      tipoHabitacion: hotelGarantizado.tipoHabitacion ?? "",
                                      modalidadConfirmacion:
                                          hotelGarantizado.modalidadConfirmacion ?? "BLOQUEO_PLAZAS",
                                  },
                              },
                          },
                      ],
                  }
                : {}),
            tarifas: cuerpo.matrizPrecios.map((t) => ({
                idpaquete: id,
                idtemporada: t.idtemporada,
                monto: t.monto,
                moneda: t.moneda,
                temporada: temporadasIniciales.find(
                    (temp) => temp.idtemporada === t.idtemporada,
                ),
            })),
        };

        paquetes = [...paquetes, nuevo];

        return HttpResponse.json(
            {
                mensaje: "Paquete turístico creado y publicado exitosamente",
                data: {
                    ...nuevo,
                    calendarioSalidas: calcularCalendarioSalidas(nuevo),
                },
            },
            { status: 201 },
        );
    }),

    // CU-12: PUT /api/paquetes/:id
    http.put(construirUrl("/paquetes/:id"), async ({ params, request }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = paquetes.find(
            (item) => item.idpaquete === id && item.estado === "ACTIVO",
        );
        if (!actual) {
            return respuestaError("Paquete no encontrado o inactivo.", 404);
        }

        const cuerpo = (await request.json()) as DatosModificarPaquete & {
            serviciosIncluidos?: unknown;
        };
        if (cuerpo.serviciosIncluidos !== undefined) {
            return respuestaError(
                "serviciosIncluidos ya no se usa: mandá idtransporte, idtren y equipo.",
                400,
            );
        }

        const transporteActual = actual.servicios?.find((s) => s.tipo === "TRANSPORTE")?.idservicio;
        const trenActual = actual.servicios?.find((s) => s.tipo === "TREN")?.idservicio ?? null;
        const equipoActual = (actual.servicios ?? [])
            .filter((s) => s.tipo === "EQUIPAMIENTO")
            .map((s) => ({
                idservicio: s.idservicio,
                cantidad: s.cantidad ?? 1,
                cadaPasajeros: s.cadaPasajeros ?? 1,
            }));

        const idtransporteFinal =
            cuerpo.idtransporte !== undefined ? cuerpo.idtransporte : transporteActual;
        const idtrenFinal = cuerpo.idtren !== undefined ? cuerpo.idtren : trenActual;
        const equipoFinal = cuerpo.equipo !== undefined ? cuerpo.equipo : equipoActual;

        const actualizado: PaqueteMock = {
            ...actual,
            nombrePaquete: cuerpo.nombrePaquete?.trim() ?? actual.nombrePaquete,
            localidadGarantizada:
                cuerpo.localidadGarantizada?.trim() ?? actual.localidadGarantizada,
            tipoGarantia: cuerpo.tipoGarantia ?? actual.tipoGarantia,
            categoriaGarantizada:
                cuerpo.categoriaGarantizada !== undefined
                    ? cuerpo.categoriaGarantizada
                    : actual.categoriaGarantizada,
            tipoHabitacionGarantizada:
                cuerpo.tipoHabitacionGarantizada !== undefined
                    ? cuerpo.tipoHabitacionGarantizada
                    : actual.tipoHabitacionGarantizada,
            condiciones:
                cuerpo.condiciones !== undefined
                    ? cuerpo.condiciones.trim() || null
                    : actual.condiciones,
            nochesPrevias:
                cuerpo.nochesPrevias !== undefined
                    ? cuerpo.nochesPrevias
                    : actual.nochesPrevias,
            nochesPosteriores:
                cuerpo.nochesPosteriores !== undefined
                    ? cuerpo.nochesPosteriores
                    : actual.nochesPosteriores,
            diasMinimosReintegro:
                cuerpo.diasMinimosReintegro !== undefined
                    ? cuerpo.diasMinimosReintegro
                    : actual.diasMinimosReintegro,
            diasDisponibles:
                cuerpo.diasDisponibles !== undefined
                    ? cuerpo.diasDisponibles.trim() || null
                    : actual.diasDisponibles,
            diasCierreVenta:
                cuerpo.diasCierreVenta !== undefined
                    ? cuerpo.diasCierreVenta
                    : actual.diasCierreVenta,
            servicios: armarServiciosPaquete(id, idtransporteFinal, idtrenFinal, equipoFinal),
            faltaTransporte: !idtransporteFinal,
            tarifas: cuerpo.matrizPrecios
                ? cuerpo.matrizPrecios.map((t) => ({
                      idpaquete: id,
                      idtemporada: t.idtemporada,
                      monto: t.monto,
                      moneda: t.moneda,
                      temporada: temporadasIniciales.find(
                          (temp) => temp.idtemporada === t.idtemporada,
                      ),
                  }))
                : actual.tarifas,
        };

        paquetes = paquetes.map((item) =>
            item.idpaquete === id ? actualizado : item,
        );

        return HttpResponse.json({
            mensaje: "Paquete turístico modificado exitosamente",
            data: {
                ...actualizado,
                calendarioSalidas: calcularCalendarioSalidas(actualizado),
            },
        });
    }),

    // CU-13: PATCH /api/paquetes/:id/baja
    http.patch(construirUrl("/paquetes/:id/baja"), async ({ params }) => {
        await delay(200);
        const id = Number(params.id);
        const actual = paquetes.find(
            (item) => item.idpaquete === id && item.estado === "ACTIVO",
        );
        if (!actual) {
            return respuestaError("Paquete no encontrado o ya inactivo.", 404);
        }
        if (actual.tieneSalidasActivas) {
            return respuestaError(
                "No se puede dar de baja porque tiene salidas activas (abiertas, cerradas o en curso).",
                400,
            );
        }

        const dadoDeBaja: PaqueteMock = {
            ...actual,
            estado: "INACTIVO",
        };

        paquetes = paquetes.map((item) =>
            item.idpaquete === id ? dadoDeBaja : item,
        );

        return HttpResponse.json({
            mensaje: "Paquete turístico dado de baja exitosamente",
            data: dadoDeBaja,
        });
    }),

    // POST / PUT /api/paquetes/:id/carrusel y /api/paquetes/:id/imagen
    http.post(
        construirUrl("/paquetes/:id/carrusel"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const formData = await request.formData();
            const archivos = [
                ...formData.getAll("imagenes"),
                ...formData.getAll("imagen"),
            ].filter((item): item is File => item instanceof File);

            if (archivos.length === 0) {
                return respuestaError(
                    "Debe adjuntar al menos una imagen en el campo 'imagenes'.",
                    400,
                );
            }
            const urls = archivos.slice(0, 5).map((archivo, idx) => {
                const ext =
                    archivo.name.split(".").pop()?.toLowerCase() || "jpg";
                const nombre =
                    idx === 0 ? `principal.${ext}` : `foto_${idx + 1}.${ext}`;
                return `/imagenes/paquetes/${id}/${nombre}`;
            });
            return HttpResponse.json({
                mensaje: `Carrusel subido exitosamente con ${urls.length} imagen(es).`,
                data: {
                    idpaquete: id,
                    totalImagenes: urls.length,
                    principal: urls[0],
                    carrusel: urls,
                },
            });
        },
    ),

    http.put(
        construirUrl("/paquetes/:id/carrusel"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const formData = await request.formData();
            const archivos = [
                ...formData.getAll("imagenes"),
                ...formData.getAll("imagen"),
            ].filter((item): item is File => item instanceof File);

            if (archivos.length === 0) {
                return respuestaError(
                    "Debe adjuntar al menos una imagen en el campo 'imagenes'.",
                    400,
                );
            }
            const urls = archivos.slice(0, 5).map((archivo, idx) => {
                const ext =
                    archivo.name.split(".").pop()?.toLowerCase() || "jpg";
                const nombre =
                    idx === 0 ? `principal.${ext}` : `foto_${idx + 1}.${ext}`;
                return `/imagenes/paquetes/${id}/${nombre}`;
            });
            return HttpResponse.json({
                mensaje: `Carrusel subido exitosamente con ${urls.length} imagen(es).`,
                data: {
                    idpaquete: id,
                    totalImagenes: urls.length,
                    principal: urls[0],
                    carrusel: urls,
                },
            });
        },
    ),

    http.put(
        construirUrl("/paquetes/:id/carrusel/:nombreFoto"),
        async ({ params, request }) => {
            await delay(200);
            const id = Number(params.id);
            const nombreFoto = String(params.nombreFoto || "principal");
            const formData = await request.formData();
            const archivo = formData.get("imagen");
            if (!(archivo instanceof File)) {
                return respuestaError(
                    "Debe adjuntar el nuevo archivo de imagen en el campo 'imagen'.",
                    400,
                );
            }
            const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
            const url = `/imagenes/paquetes/${id}/${nombreFoto}.${ext}`;
            return HttpResponse.json({
                mensaje: `La foto '${nombreFoto}' fue reemplazada exitosamente.`,
                data: {
                    idpaquete: id,
                    fotoModificada: nombreFoto,
                    url,
                },
            });
        },
    ),

    http.delete(
        construirUrl("/paquetes/:id/carrusel/:nombreFoto"),
        async ({ params }) => {
            await delay(200);
            const id = Number(params.id);
            const nombreFoto = String(params.nombreFoto || "foto_2");
            return HttpResponse.json({
                mensaje: `La foto '${nombreFoto}' fue eliminada exitosamente.`,
                data: {
                    idpaquete: id,
                    fotoEliminada: nombreFoto,
                },
            });
        },
    ),
];
