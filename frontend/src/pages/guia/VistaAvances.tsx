import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import { ErrorApi } from "../../services/clienteApi";
import {
    agregarHistorialLocalAvance,
    esquemaAvance,
    fechaLocalHoy,
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaHora,
    guardarAvanceOffline,
    guardarBorradorAvance,
    limpiarBorradorAvance,
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
import { siguienteOrdenAviso, type SincronizacionAvances } from "./useSincronizacionAvances";

type VistaAvancesProps = {
    salidaActual: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
    sincronizacion: SincronizacionAvances;
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
                ? formatearFechaHora(e.fechaHoraLlegada)
                : "Completado previamente",
            offline: false,
        }));

    // Pendientes offline (aún sin confirmar), uno por avance, del más reciente al más antiguo
    const pendientes: RegistroHistorialAvance[] = [...avancesPendientesLocales]
        .reverse()
        .map((item) => ({
            id: item.idLocal,
            etapa: item.etapaNombre,
            estadoTramo: item.estadoTramo,
            // FE-41: en hora local, como los del servidor (el ISO está en UTC)
            fechaHora: `${formatearFechaHora(item.fechaHoraLlegada)} (Offline)`,
            offline: true,
        }));
    const idsPendientes = new Set(pendientes.map((p) => p.id));

    // Historial local (más reciente primero): trae TODOS los avances enviados desde este dispositivo,
    // incluidos los DEMORADO que el itinerario del servidor ya no muestra. Un offline que ya no está
    // en la cola se sincronizó, y los pendientes ya van arriba.
    const locales = obtenerHistorialLocalAvances(idSalida)
        .filter((l) => !idsPendientes.has(l.id))
        .map((l) => ({ ...l, offline: false }));

    // El servidor solo informa el último estado de cada etapa: se omite si ya está en el historial local
    const clave = (r: RegistroHistorialAvance) => `${r.etapa}|${r.estadoTramo}`;
    const clavesLocales = new Set(locales.map(clave));
    const soloServidor = [...delServidor]
        .reverse()
        .filter((r) => !clavesLocales.has(clave(r)));

    return [...pendientes, ...locales, ...soloServidor];
}

export function VistaAvances({
    salidaActual,
    detalleSalida,
    sincronizacion,
    cargando = false,
}: VistaAvancesProps) {
    const idsalida = salidaActual?.idsalida ?? 0;
    const registrarAvanceMutation = useRegistrarAvance();

    const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
    const [mensajeFeedback, setMensajeFeedback] = useState<{
        tipo: "exito" | "error" | "advertencia" | "informacion";
        texto: string;
        orden: number;
    } | null>(null);

    // FE-38: se muestra el aviso más reciente, sea de esta vista o de la sincronización
    const aviso =
        mensajeFeedback && sincronizacion.mensaje
            ? mensajeFeedback.orden > sincronizacion.mensaje.orden
                ? mensajeFeedback
                : sincronizacion.mensaje
            : (mensajeFeedback ?? sincronizacion.mensaje);

    // FE-38: la cola y su sincronización viven en el portal (useSincronizacionAvances)
    const avancesPendientes = sincronizacion.pendientes;

    // Historial reactivo calculado directamente desde el detalle del servidor y pendientes offline (FE-08)
    const historialAvances = useMemo(
        () => construirListaHistorial(detalleSalida, idsalida, avancesPendientes),
        [detalleSalida, idsalida, avancesPendientes],
    );


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
        formState: { errors, dirtyFields },
    } = useForm<DatosAvanceForm>({
        resolver: zodResolver(esquemaAvance),
        // FE-37: la fecha y la hora de llegada nunca salen del borrador, siempre son las actuales
        defaultValues: {
            numeroOrden: borrador?.numeroOrden ?? undefined,
            estadoTramo: borrador?.estadoTramo ?? "COMPLETADO",
            fechaLlegada: fechaHoy,
            horaLlegada: horaActual,
        },
    });

    const valoresFormulario = useWatch({ control });

    // Guardado automático del borrador en localStorage, solo si el guía tocó el formulario (FE-37).
    // dirtyFields y no isDirty: la etapa sugerida con setValue también marca isDirty
    const tocado = Object.keys(dirtyFields).length > 0;
    useEffect(() => {
        if (idsalida > 0 && tocado) {
            guardarBorradorAvance(idsalida, {
                numeroOrden: valoresFormulario.numeroOrden,
                estadoTramo: valoresFormulario.estadoTramo,
            });
        }
    }, [valoresFormulario, idsalida, tocado]);

    const etapasDisponibles = detalleSalida?.itinerario ?? [];

    // Siguiente etapa sugerida: primera etapa que NO esté completada
    // Un tramo DEMORADO no avanza la etapa en el backend y debe seguir proponiéndose hasta completarse (FE-09)
    const etapasConPendientes = etapasDisponibles.map((etapa) => {
        // La cola está en orden de llegada: vale el pendiente más reciente de la etapa
        const pendiente = [...avancesPendientes]
            .reverse()
            .find((p) => p.numeroOrden === etapa.numeroOrden);
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

    // Solo se aplica cuando cambia el NÚMERO sugerido: no pisa la etapa elegida a mano en cada render.
    // La primera sugerencia respeta el borrador guardado, salvo que esa etapa ya esté completada (FE-37).
    const sugerida = siguienteEtapa?.numeroOrden;
    const borradorCompletado =
        etapasConPendientes.find((e) => e.numeroOrden === borrador?.numeroOrden)?.estadoTramo === "COMPLETADO";
    // FE-37: con todas las etapas completadas no queda ninguna para proponer: se descarta el borrador
    // y no queda elegida una etapa ya completada (0 marca que ya se limpió)
    const todasCompletadas = etapasConPendientes.length > 0 && sugerida === undefined;
    const ultimaSugerida = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (todasCompletadas && ultimaSugerida.current !== 0) {
            ultimaSugerida.current = 0;
            limpiarBorradorAvance(idsalida);
            setValue("numeroOrden", undefined as unknown as number);
            return;
        }
        if (sugerida === undefined || ultimaSugerida.current === sugerida) return;
        const esPrimera = ultimaSugerida.current === undefined;
        ultimaSugerida.current = sugerida;
        if (esPrimera && borradorCompletado) limpiarBorradorAvance(idsalida);
        // La primera vez se fija el borrador (si hay): al cargar el formulario las etapas todavía no estaban
        const usarBorrador = esPrimera && borrador?.numeroOrden && !borradorCompletado;
        setValue("numeroOrden", usarBorrador ? borrador.numeroOrden! : sugerida);
    }, [sugerida, todasCompletadas, borrador?.numeroOrden, borradorCompletado, idsalida, setValue]);

    if (!salidaActual || idsalida <= 0) {
        return (
            <section aria-label="Registrar avances y novedades" className="space-y-6">
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
        sincronizacion.limpiarMensaje();

        // Sin señal el back no puede avisar del salto: se aceptaba y se descartaba al sincronizar
        if (sugerida !== undefined && Number(datos.numeroOrden) > sugerida) {
            setMensajeFeedback({
                orden: siguienteOrdenAviso(),
                tipo: "error",
                texto: `Antes hay que informar la etapa ${sugerida}.`,
            });
            return;
        }

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
                fechaHora: `${formatearFechaHora(fechaHoraIso)} (Offline)`,
                offline: true,
            };

            agregarHistorialLocalAvance(idsalida, nuevoRegistro);
            sincronizacion.refrescar();
            limpiarBorradorAvance(idsalida);

            setMensajeFeedback({
                orden: siguienteOrdenAviso(),
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

        // Intento de envío normal a la API. FE-38: primero sale lo que estaba en cola, para respetar el orden de etapas
        if (avancesPendientes.length > 0) await sincronizacion.sincronizar();
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
                fechaHora: formatearFechaHora(fechaHoraIso),
                offline: false,
            };

            agregarHistorialLocalAvance(idsalida, nuevoRegistro);
            limpiarBorradorAvance(idsalida);

            setMensajeFeedback({
                orden: siguienteOrdenAviso(),
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
            // FE-39: todo error que no es una respuesta del servidor es de red ("Load failed" en Safari, etc.)
            const esErrorConexion = !(error instanceof ErrorApi) || !navigator.onLine;

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
                    fechaHora: `${formatearFechaHora(fechaHoraIso)} (Offline)`,
                    offline: true,
                };

                agregarHistorialLocalAvance(idsalida, nuevoRegistro);
                sincronizacion.refrescar();
                limpiarBorradorAvance(idsalida);

                setMensajeFeedback({
                    orden: siguienteOrdenAviso(),
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
                    orden: siguienteOrdenAviso(),
                    tipo: "error",
                    texto: mensajeError || "No se pudo registrar el avance.",
                });
            }
        }
    }

    return (
        <section aria-label="Registrar avances y novedades" className="space-y-6">
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
                        onClick={sincronizacion.sincronizar}
                        cargando={sincronizacion.sincronizando}
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
                        {aviso ? (
                            <Alerta tipo={aviso.tipo}>
                                {aviso.texto}
                            </Alerta>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Etapa */}
                            <label className="col-span-full grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Etapa (el tramo del circuito) *</span>
                                <select
                                    {...register("numeroOrden", { valueAsNumber: true })}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value="">Selecciona una etapa</option>
                                    {etapasConPendientes.map((etapa) => {
                                        const estaCompletada = etapa.estadoTramo === "COMPLETADO";
                                        const esSugerida = etapa.numeroOrden === siguienteEtapa?.numeroOrden;
                                        return (
                                            <option
                                                key={etapa.numeroOrden}
                                                value={etapa.numeroOrden}
                                                disabled={estaCompletada || etapa.numeroOrden > (sugerida ?? 0)}
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
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Fecha de llegada *</span>
                                <input
                                    type="date"
                                    {...register("fechaLlegada")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.fechaLlegada ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.fechaLlegada.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Hora de llegada */}
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Hora de llegada *</span>
                                <input
                                    type="time"
                                    {...register("horaLlegada")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.horaLlegada ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.horaLlegada.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Estado del tramo */}
                            <label className="col-span-full grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Estado del Tramo *</span>
                                <select
                                    {...register("estadoTramo")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
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
