import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import { ErrorApi } from "../../services/clienteApi";
import {
    agregarHistorialLocalAvance,
    eliminarAvanceOffline,
    esquemaAvance,
    fechaLocalHoy,
    estilosEstadoSalida,
    formatearEstadoSalida,
    guardarAvanceOffline,
    guardarBorradorAvance,
    limpiarBorradorAvance,
    obtenerAvancesOffline,
    obtenerBorradorAvance,
    obtenerHistorialLocalAvances,
    useRegistrarAvance,
    type AvanceOffline,
    type DatosAvanceForm,
    type DetalleSalidaGuia,
    type EstadoTramo,
    type RegistroHistorialAvance,
    type SalidaGuiaResumen,
} from "../../services/guiaService";
import {
    IconoCerrar,
    IconoMontana,
    IconoSincronizar,
    IconoWifiOff,
} from "./IconosGuia";

type VistaAvancesProps = {
    salidaActual: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
    cargando?: boolean;
};

/** Reconstruye el historial combinando avances confirmados del servidor y pendientes offline (FE-08) */
function construirListaHistorial(
    detalle: DetalleSalidaGuia | null,
    idSalida: number,
    avancesPendientesLocales: AvanceOffline[] = [],
): RegistroHistorialAvance[] {
    if (idSalida <= 0) return [];

    // Avances confirmados registrados en el servidor
    const delServidor: RegistroHistorialAvance[] = (detalle?.itinerario ?? [])
        .filter((e) => e.estadoTramo !== null && e.estadoTramo !== undefined)
        .map((e) => ({
            id: `serv_${e.numeroOrden}`,
            etapa: `Etapa ${e.numeroOrden}: ${e.puntoInicio} → ${e.puntoFin}`,
            estadoTramo: (e.estadoTramo as EstadoTramo) ?? "COMPLETADO",
            fechaHora: e.fechaHoraLlegada
                ? new Date(e.fechaHoraLlegada).toLocaleString("es-ES")
                : "Completado previamente",
            offline: false,
        }));

    // Avances en localStorage (con prioridad a pendientes offline)
    const locales = obtenerHistorialLocalAvances(idSalida);

    const mapa = new Map<string, RegistroHistorialAvance>();

    // 1. Añadir pendientes offline primero (tienen prioridad visual por ser cambios locales no confirmados aún)
    for (const item of avancesPendientesLocales) {
        mapa.set(item.etapaNombre, {
            id: item.idLocal,
            etapa: item.etapaNombre,
            estadoTramo: item.estadoTramo,
            fechaHora: `${item.fechaHoraLlegada.slice(0, 10)} (Offline)`,
            offline: true,
        });
    }

    // 2. Añadir del servidor (del más reciente al más antiguo, si no hay uno offline pendiente para esa etapa)
    for (const item of [...delServidor].reverse()) {
        if (!mapa.has(item.etapa)) {
            mapa.set(item.etapa, item);
        }
    }

    // 3. Fallback: si no hay en servidor ni offline pendientes, pero hay historial local
    if (mapa.size === 0 && locales.length > 0) {
        return locales;
    }

    return Array.from(mapa.values());
}

export function VistaAvances({
    salidaActual,
    detalleSalida,
    cargando = false,
}: VistaAvancesProps) {
    const idsalida = salidaActual?.idsalida ?? 0;
    const registrarAvanceMutation = useRegistrarAvance();

    const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
    const [mensajeFeedback, setMensajeFeedback] = useState<{
        tipo: "exito" | "error" | "advertencia" | "informacion";
        texto: string;
    } | null>(null);

    // Carga perezosa de estado inicial evitando cascading renders
    const [avancesPendientes, setAvancesPendientes] = useState<AvanceOffline[]>(() =>
        idsalida > 0 ? obtenerAvancesOffline(idsalida) : [],
    );

    // Historial reactivo calculado directamente desde el detalle del servidor y pendientes offline (FE-08)
    const historialAvances = useMemo(
        () => construirListaHistorial(detalleSalida, idsalida, avancesPendientes),
        [detalleSalida, idsalida, avancesPendientes],
    );

    const [sincronizando, setSincronizando] = useState(false);

    // Cargar valores iniciales / borrador guardado
    const fechaHoy = fechaLocalHoy();
    const horaActual = new Date().toTimeString().slice(0, 5);

    const borrador = idsalida > 0 ? obtenerBorradorAvance(idsalida) : null;

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors },
    } = useForm<DatosAvanceForm>({
        resolver: zodResolver(esquemaAvance),
        defaultValues: {
            numeroOrden: borrador?.numeroOrden ?? undefined,
            estadoTramo: borrador?.estadoTramo ?? "COMPLETADO",
            fechaLlegada: borrador?.fechaLlegada ?? fechaHoy,
            horaLlegada: borrador?.horaLlegada ?? horaActual,
        },
    });

    const valoresFormulario = useWatch({ control });

    // Guardado automático del borrador en localStorage
    useEffect(() => {
        if (
            idsalida > 0 &&
            valoresFormulario &&
            (valoresFormulario.numeroOrden || valoresFormulario.estadoTramo)
        ) {
            guardarBorradorAvance(idsalida, valoresFormulario);
        }
    }, [valoresFormulario, idsalida]);

    const etapasDisponibles = detalleSalida?.itinerario ?? [];

    const sincronizarPendientes = useCallback(async () => {
        if (idsalida <= 0) return;
        const pendientes = obtenerAvancesOffline(idsalida);
        if (pendientes.length === 0) return;

        setSincronizando(true);
        let exitoCount = 0;
        const rechazados: string[] = [];

        for (const item of pendientes) {
            try {
                await registrarAvanceMutation.mutateAsync({
                    idsalida,
                    payload: {
                        numeroOrden: item.numeroOrden,
                        estadoTramo: item.estadoTramo,
                        fechaHoraLlegada: item.fechaHoraLlegada,
                    },
                });
                eliminarAvanceOffline(idsalida, item.idLocal);
                exitoCount += 1;
            } catch (error) {
                // 4xx = rechazo definitivo del back: se descarta para no trabar la cola.
                // 401/408/429 y errores de red o 5xx se reintentan en el próximo intento.
                if (
                    error instanceof ErrorApi &&
                    error.estado >= 400 &&
                    error.estado < 500 &&
                    ![401, 408, 429].includes(error.estado)
                ) {
                    eliminarAvanceOffline(idsalida, item.idLocal);
                    rechazados.push(`${item.etapaNombre}: ${error.message}`);
                    continue;
                }
                console.error("Error sincronizando avance", error);
                break;
            }
        }

        const restantes = obtenerAvancesOffline(idsalida);
        setAvancesPendientes(restantes);
        setSincronizando(false);

        if (rechazados.length > 0) {
            setMensajeFeedback({
                tipo: "error",
                texto: `El servidor rechazó ${rechazados.length} avance(s) pendiente(s) y se descartaron: ${rechazados.join(" | ")}`,
            });
        } else if (exitoCount > 0) {
            setMensajeFeedback({
                tipo: "exito",
                texto: `Se sincronizaron exitosamente ${exitoCount} avance(s) pendiente(s) con el servidor.`,
            });
        }
    }, [idsalida, registrarAvanceMutation]);

    // Sincronización automática cuando el navegador vuelve a tener conexión
    useEffect(() => {
        if (idsalida <= 0) return;
        function manejarOnline() {
            const pendientes = obtenerAvancesOffline(idsalida);
            if (pendientes.length > 0) {
                void sincronizarPendientes();
            }
        }
        window.addEventListener("online", manejarOnline);
        return () => window.removeEventListener("online", manejarOnline);
    }, [idsalida, sincronizarPendientes]);

    // Siguiente etapa sugerida: primera etapa que NO esté completada
    // Un tramo DEMORADO no avanza la etapa en el backend y debe seguir proponiéndose hasta completarse (FE-09)
    const etapasConPendientes = etapasDisponibles.map((etapa) => {
        const pendiente = avancesPendientes.find(
            (p) => p.numeroOrden === etapa.numeroOrden,
        );
        if (pendiente) {
            return {
                ...etapa,
                estadoTramo: pendiente.estadoTramo,
            };
        }
        return etapa;
    });

    const siguienteEtapa = etapasConPendientes.find(
        (e) => e.estadoTramo !== "COMPLETADO",
    );

    useEffect(() => {
        if (siguienteEtapa) {
            setValue("numeroOrden", siguienteEtapa.numeroOrden);
        }
    }, [siguienteEtapa, setValue]);

    if (!salidaActual || idsalida <= 0) {
        return (
            <section aria-label="Registrar avances y novedades (CU-49)" className="space-y-6">
                <header className="border-b border-borde/60 pb-4">
                    <h1 className="text-2xl font-bold text-navegacion md:text-3xl">
                        Registrar avances y novedades del recorrido
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Mantén actualizada la información de la salida y el itinerario
                    </p>
                </header>
                <div className="rounded-tarjeta border border-borde bg-white p-8 text-center text-sm text-texto-suave shadow-tarjeta">
                    {cargando
                        ? "Cargando información de la salida..."
                        : "No tienes una salida asignada seleccionada para registrar avances."}
                </div>
            </section>
        );
    }

    async function enviarAvance(datos: DatosAvanceForm) {
        setMensajeFeedback(null);

        // Construir ISO Date Time
        const fechaHoraCombinada = `${datos.fechaLlegada}T${datos.horaLlegada}:00`;
        const fechaHoraIso = new Date(fechaHoraCombinada).toISOString();

        const etapaActual = etapasDisponibles.find(
            (e) => e.numeroOrden === Number(datos.numeroOrden),
        );
        const etapaNombre = etapaActual
            ? `Etapa ${etapaActual.numeroOrden}: ${etapaActual.puntoInicio} → ${etapaActual.puntoFin}`
            : `Etapa ${datos.numeroOrden}`;

        // Modo Offline explícito o sin conectividad
        const estaOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

        if (!estaOnline) {
            const guardado = guardarAvanceOffline(idsalida, {
                idsalida,
                numeroOrden: Number(datos.numeroOrden),
                etapaNombre,
                estadoTramo: datos.estadoTramo,
                fechaHoraLlegada: fechaHoraIso,
                fechaHoraReporte: new Date().toISOString(),
            });

            const nuevoRegistro: RegistroHistorialAvance = {
                id: guardado.idLocal,
                etapa: etapaNombre,
                estadoTramo: datos.estadoTramo,
                fechaHora: `${datos.fechaLlegada} ${datos.horaLlegada} (Offline)`,
                offline: true,
            };

            agregarHistorialLocalAvance(idsalida, nuevoRegistro);
            setAvancesPendientes(obtenerAvancesOffline(idsalida));
            limpiarBorradorAvance(idsalida);

            setMensajeFeedback({
                tipo: "advertencia",
                texto: "Sin conexión: el avance se guardó localmente en tu dispositivo y se enviará al servidor cuando recuperes señal.",
            });

            // Si fue DEMORADO se mantiene la misma etapa; si fue COMPLETADO se propone la siguiente pendiente
            const siguienteNumeroOffline =
                datos.estadoTramo === "DEMORADO"
                    ? Number(datos.numeroOrden)
                    : (etapasConPendientes.find(
                          (e) =>
                              e.numeroOrden > Number(datos.numeroOrden) &&
                              e.estadoTramo !== "COMPLETADO",
                      )?.numeroOrden ?? undefined);

            reset({
                numeroOrden: siguienteNumeroOffline,
                estadoTramo: "COMPLETADO",
                fechaLlegada: fechaLocalHoy(),
                horaLlegada: new Date().toTimeString().slice(0, 5),
            });
            return;
        }

        // Intento de envío normal a la API
        try {
            const respuesta = await registrarAvanceMutation.mutateAsync({
                idsalida,
                payload: {
                    numeroOrden: Number(datos.numeroOrden),
                    estadoTramo: datos.estadoTramo,
                    fechaHoraLlegada: fechaHoraIso,
                },
            });

            const idAvanceGenerado = String(
                respuesta.data?.avance?.idavance ?? datos.numeroOrden,
            );

            const nuevoRegistro: RegistroHistorialAvance = {
                id: `reg_${idAvanceGenerado}`,
                etapa: etapaNombre,
                estadoTramo: datos.estadoTramo,
                fechaHora: `${datos.fechaLlegada} ${datos.horaLlegada}`,
                offline: false,
            };

            agregarHistorialLocalAvance(idsalida, nuevoRegistro);
            limpiarBorradorAvance(idsalida);

            setMensajeFeedback({
                tipo: "exito",
                texto: "Avance registrado exitosamente en el historial del recorrido.",
            });

            // Resetear para próxima etapa (si fue DEMORADO, se mantiene la misma etapa; si fue COMPLETADO, la siguiente etapa pendiente)
            const siguienteNumero =
                datos.estadoTramo === "DEMORADO"
                    ? Number(datos.numeroOrden)
                    : (etapasConPendientes.find(
                          (e) =>
                              e.numeroOrden > Number(datos.numeroOrden) &&
                              e.estadoTramo !== "COMPLETADO",
                      )?.numeroOrden ?? undefined);

            reset({
                numeroOrden: siguienteNumero,
                estadoTramo: "COMPLETADO",
                fechaLlegada: fechaLocalHoy(),
                horaLlegada: new Date().toTimeString().slice(0, 5),
            });
        } catch (error: unknown) {
            const mensajeError =
                error instanceof Error
                    ? error.message
                    : typeof error === "string"
                      ? error
                      : "Ocurrió un error inesperado.";
            const esErrorConexion =
                mensajeError.includes("Failed to fetch") ||
                mensajeError.includes("NetworkError") ||
                !navigator.onLine;

            if (esErrorConexion) {
                const guardado = guardarAvanceOffline(idsalida, {
                    idsalida,
                    numeroOrden: Number(datos.numeroOrden),
                    etapaNombre,
                    estadoTramo: datos.estadoTramo,
                    fechaHoraLlegada: fechaHoraIso,
                    fechaHoraReporte: new Date().toISOString(),
                });

                const nuevoRegistro: RegistroHistorialAvance = {
                    id: guardado.idLocal,
                    etapa: etapaNombre,
                    estadoTramo: datos.estadoTramo,
                    fechaHora: `${datos.fechaLlegada} ${datos.horaLlegada} (Offline)`,
                    offline: true,
                };

                agregarHistorialLocalAvance(idsalida, nuevoRegistro);
                setAvancesPendientes(obtenerAvancesOffline(idsalida));
                limpiarBorradorAvance(idsalida);

                setMensajeFeedback({
                    tipo: "advertencia",
                    texto: "Falla de señal detectada: el avance fue guardado localmente de manera segura en tu dispositivo para ser sincronizado luego.",
                });

                const siguienteNumeroOffline =
                    datos.estadoTramo === "DEMORADO"
                        ? Number(datos.numeroOrden)
                        : (etapasConPendientes.find(
                              (e) =>
                                  e.numeroOrden > Number(datos.numeroOrden) &&
                                  e.estadoTramo !== "COMPLETADO",
                          )?.numeroOrden ?? undefined);

                reset({
                    numeroOrden: siguienteNumeroOffline,
                    estadoTramo: "COMPLETADO",
                    fechaLlegada: fechaLocalHoy(),
                    horaLlegada: new Date().toTimeString().slice(0, 5),
                });
            } else {
                setMensajeFeedback({
                    tipo: "error",
                    texto: mensajeError || "No se pudo registrar el avance.",
                });
            }
        }
    }

    return (
        <section aria-label="Registrar avances y novedades (CU-49)" className="space-y-6">
            <header className="border-b border-borde/60 pb-4">
                <h1 className="text-2xl font-bold text-navegacion md:text-3xl">
                    Registrar avances y novedades del recorrido
                </h1>
                <p className="text-sm text-texto-suave">
                    Mantén actualizada la información de la salida y el itinerario
                </p>
            </header>

            {/* Banner de Salida Actual */}
            <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-l-4 border-l-[#16d6dc] border-y border-r border-borde bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr_auto]">
                <div className="grid size-12 place-items-center rounded-xl bg-[#1b9fc7] text-white">
                    <IconoMontana tamano={24} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-navegacion">
                        {salidaActual.circuito}
                    </h2>
                    <p className="text-xs text-texto-suave">
                        {salidaActual.nroSalida} · {salidaActual.paquete}
                    </p>
                </div>
                <div>
                    <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${estilosEstadoSalida(
                            salidaActual.estado,
                        )}`}
                    >
                        {formatearEstadoSalida(salidaActual.estado)}
                    </span>
                </div>
            </article>

            {/* Alerta de avances pendientes de sincronización (Modo Offline) */}
            {avancesPendientes.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">
                    <div className="flex items-center gap-2">
                        <IconoWifiOff tamano={18} />
                        <span>
                            <b>{avancesPendientes.length}</b> avance(s) guardado(s) localmente pendientes de señal.
                        </span>
                    </div>
                    <Boton
                        variante="secundario"
                        className="text-xs"
                        onClick={sincronizarPendientes}
                        cargando={sincronizando}
                    >
                        <span className="flex items-center gap-1.5">
                            <IconoSincronizar tamano={14} />
                            Sincronizar ahora
                        </span>
                    </Boton>
                </div>
            ) : null}

            {/* Formulario + Historial */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                {/* Columna Izquierda: Formulario */}
                <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <h2 className="border-b border-borde/70 pb-3 text-base font-bold text-navegacion">
                        Registrar avance o novedad
                    </h2>

                    <form onSubmit={handleSubmit(enviarAvance)} noValidate className="mt-5 space-y-4">
                        {mensajeFeedback ? (
                            <Alerta tipo={mensajeFeedback.tipo}>
                                {mensajeFeedback.texto}
                            </Alerta>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Etapa */}
                            <label className="col-span-full grid gap-1.5 text-xs font-bold text-texto">
                                <span>Etapa (el tramo del circuito) *</span>
                                <select
                                    {...register("numeroOrden", { valueAsNumber: true })}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value="">Selecciona una etapa</option>
                                    {etapasDisponibles.map((etapa) => {
                                        const estaCompletada = etapa.estadoTramo === "COMPLETADO";
                                        const esSugerida = etapa.numeroOrden === siguienteEtapa?.numeroOrden;
                                        return (
                                            <option
                                                key={etapa.numeroOrden}
                                                value={etapa.numeroOrden}
                                                disabled={estaCompletada}
                                            >
                                                Etapa {etapa.numeroOrden}: {etapa.puntoInicio} → {etapa.puntoFin}
                                                {etapa.estadoTramo ? ` (${formatearEstadoSalida(etapa.estadoTramo)})` : ""}
                                                {esSugerida && !estaCompletada ? " — Sugerida" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                                {errors.numeroOrden ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.numeroOrden.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Fecha de llegada */}
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Fecha de llegada *</span>
                                <input
                                    type="date"
                                    {...register("fechaLlegada")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.fechaLlegada ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.fechaLlegada.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Hora de llegada */}
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Hora de llegada *</span>
                                <input
                                    type="time"
                                    {...register("horaLlegada")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.horaLlegada ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.horaLlegada.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Estado del tramo */}
                            <label className="col-span-full grid gap-1.5 text-xs font-bold text-texto">
                                <span>Estado del Tramo *</span>
                                <select
                                    {...register("estadoTramo")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value="COMPLETADO">Completado</option>
                                    <option value="DEMORADO">Atrasado / Demorado</option>
                                </select>
                                {errors.estadoTramo ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.estadoTramo.message}
                                    </span>
                                ) : null}
                            </label>
                        </div>

                        <div className="rounded-xl bg-[#edf7f8] p-3 text-[11px] leading-relaxed text-[#426170]">
                            <b>Nota:</b> La fecha y hora ingresada debe corresponder al momento de la llegada real al final de la etapa seleccionada. La información queda preservada en este dispositivo en caso de no contar con conexión a internet.
                        </div>

                        <div className="flex justify-end pt-2">
                            <Boton
                                type="submit"
                                variante="principal"
                                cargando={registrarAvanceMutation.isPending}
                            >
                                Registrar Avance
                            </Boton>
                        </div>
                    </form>
                </article>

                {/* Columna Derecha: Historial de avances */}
                <aside className="flex flex-col justify-between rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <div>
                        <div className="flex items-start justify-between border-b border-borde/70 pb-3">
                            <div>
                                <h2 className="text-base font-bold text-navegacion">
                                    Historial de avances
                                </h2>
                                <p className="text-xs text-texto-suave">
                                    Últimos registros del recorrido
                                </p>
                            </div>
                            {historialAvances.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setModalHistorialAbierto(true)}
                                    className="text-xs font-bold text-marca hover:underline"
                                >
                                    Ver todo
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-4 divide-y divide-borde/50">
                            {historialAvances.slice(0, 4).map((item) => (
                                <div key={item.id} className="py-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-texto">{item.etapa}</p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                item.estadoTramo === "COMPLETADO"
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-amber-100 text-amber-800"
                                            }`}
                                        >
                                            {formatearEstadoSalida(item.estadoTramo)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-texto-suave">
                                        <span>{item.fechaHora}</span>
                                        {item.offline ? (
                                            <span className="font-semibold text-amber-700">
                                                (Pendiente de envío)
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}

                            {historialAvances.length === 0 ? (
                                <p className="py-6 text-center text-xs text-texto-suave">
                                    No hay avances registrados en esta salida
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-6 border-t border-borde/50 pt-3 text-center text-[11px] text-texto-suave">
                        {avancesPendientes.length > 0 ? (
                            <span className="text-amber-800 font-semibold">
                                Hay {avancesPendientes.length} avance(s) pendiente(s) de señal
                            </span>
                        ) : (
                            <span>Todos los avances están sincronizados</span>
                        )}
                    </div>
                </aside>
            </div>

            {/* Modal Historial Completo de Avances */}
            {modalHistorialAbierto ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setModalHistorialAbierto(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Historial de avances y novedades"
                        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-tarjeta bg-white p-6 shadow-tarjeta"
                    >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    {salidaActual.circuito}
                                </p>
                                <h2 className="text-lg font-bold text-navegacion">
                                    Historial de avances y novedades
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalHistorialAbierto(false)}
                                className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
                            >
                                <IconoCerrar tamano={20} />
                            </button>
                        </div>

                        <div className="mt-4 divide-y divide-borde/50">
                            {historialAvances.map((item) => (
                                <div key={item.id} className="py-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-texto">{item.etapa}</p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                item.estadoTramo === "COMPLETADO"
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-amber-100 text-amber-800"
                                            }`}
                                        >
                                            {formatearEstadoSalida(item.estadoTramo)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-texto-suave">
                                        <span>{item.fechaHora}</span>
                                        {item.offline ? (
                                            <span className="font-semibold text-amber-700">
                                                (Pendiente de sincronizar)
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                            {historialAvances.length === 0 ? (
                                <p className="py-6 text-center text-xs text-texto-suave">
                                    No hay avances registrados en esta salida
                                </p>
                            ) : null}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Boton
                                variante="principal"
                                onClick={() => setModalHistorialAbierto(false)}
                            >
                                Cerrar
                            </Boton>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
