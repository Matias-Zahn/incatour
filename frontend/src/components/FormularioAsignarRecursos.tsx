import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "./Alerta";
import Boton from "./Boton";
import { formatearFechaSalida } from "../services/guiaService";

// ==========================================
// Tipos del contrato CU-40 (Panel y Asignación)
// ==========================================

import type {
    DatosPanelAsignacion,
    ItemCampingSeleccionado,
    PayloadConfirmarAsignacion,
} from "../services/salidaService";

export type FormularioAsignarRecursosProps = {
    datos?: DatosPanelAsignacion | null;
    cargando?: boolean;
    recargando?: boolean;
    guardando?: boolean;
    errorServidor?: string;
    onRecargarDatos?: () => void;
    onConfirmar?: (payload: PayloadConfirmarAsignacion) => void;
    onCancelar?: () => void;
};

export function FormularioAsignarRecursos({
    datos,
    cargando = false,
    recargando = false,
    guardando = false,
    errorServidor,
    onRecargarDatos,
    onConfirmar,
    onCancelar,
}: FormularioAsignarRecursosProps) {
    const idSeccion = useId();

    // ==========================================
    // Estado interno de la selección
    // ==========================================
    const [personalSeleccionadoIds, setPersonalSeleccionadoIds] = useState<number[]>([]);
    const [transporteSeleccionadoId, setTransporteSeleccionadoId] = useState<number | null>(null);
    const [cantidadesCamping, setCantidadesCamping] = useState<Record<number, number>>({});

    // ==========================================
    // Clasificación de Personal por Rol
    // ==========================================
    const guiasDisponibles = useMemo(() => {
        return (datos?.personalDisponible ?? []).filter((p) => {
            const rol = p.rol?.trim().toLowerCase();
            return rol === "guía" || rol === "guia";
        });
    }, [datos?.personalDisponible]);

    const porteadoresDisponibles = useMemo(() => {
        return (datos?.personalDisponible ?? []).filter((p) => {
            const rol = p.rol?.trim().toLowerCase();
            return rol === "porteador" || rol === "porteadores";
        });
    }, [datos?.personalDisponible]);

    // ==========================================
    // Contadores dinámicos de Personal
    // ==========================================
    const guiasRequeridos = datos?.dotacionRequerida.guias ?? 0;
    const porteadoresRequeridos = datos?.dotacionRequerida.porteadores ?? 0;

    const guiasSeleccionadosIds = useMemo(() => {
        const setGuias = new Set(guiasDisponibles.map((g) => g.idpersonal));
        return personalSeleccionadoIds.filter((id) => setGuias.has(id));
    }, [guiasDisponibles, personalSeleccionadoIds]);

    const porteadoresSeleccionadosIds = useMemo(() => {
        const setPorteadores = new Set(porteadoresDisponibles.map((p) => p.idpersonal));
        return personalSeleccionadoIds.filter((id) => setPorteadores.has(id));
    }, [porteadoresDisponibles, personalSeleccionadoIds]);

    const guiasSeleccionados = guiasSeleccionadosIds.length;
    const porteadoresSeleccionados = porteadoresSeleccionadosIds.length;

    const guiasFaltantes = Math.max(0, guiasRequeridos - guiasSeleccionados);
    const porteadoresFaltantes = Math.max(0, porteadoresRequeridos - porteadoresSeleccionados);

    const guiasAdicionales = Math.max(0, guiasSeleccionados - guiasRequeridos);
    const porteadoresAdicionales = Math.max(0, porteadoresSeleccionados - porteadoresRequeridos);
    const totalPersonalExtra = guiasAdicionales + porteadoresAdicionales;

    const lugaresSobrantesDisponibles = datos?.lugaresSobrantes ?? 0;
    const excedeLugaresSobrantes = totalPersonalExtra > lugaresSobrantesDisponibles;
    const lugaresALiberar = Math.max(0, lugaresSobrantesDisponibles - totalPersonalExtra);

    // ==========================================
    // Validación del formulario
    // ==========================================
    const cumpleGuias = guiasSeleccionados >= guiasRequeridos;
    const cumplePorteadores = porteadoresSeleccionados >= porteadoresRequeridos;
    const cumpleTransporte = transporteSeleccionadoId !== null;
    const cumpleCupoExtra = !excedeLugaresSobrantes;

    const formularioValido =
        cumpleGuias && cumplePorteadores && cumpleTransporte && cumpleCupoExtra;

    // ==========================================
    // Manejadores de eventos de Personal
    // ==========================================
    function alternarSeleccionPersonal(idpersonal: number) {
        setPersonalSeleccionadoIds((prev) => {
            if (prev.includes(idpersonal)) {
                return prev.filter((id) => id !== idpersonal);
            }
            return [...prev, idpersonal];
        });
    }

    // ==========================================
    // Manejadores de eventos de Equipamiento
    // ==========================================
    function cambiarCantidadCamping(idservicio: number, nuevaCantidad: number, maximo: number) {
        const valorEntero = Number.isFinite(nuevaCantidad) ? Math.floor(nuevaCantidad) : 0;
        const acotada = Math.max(0, Math.min(valorEntero, maximo));
        setCantidadesCamping((prev) => ({
            ...prev,
            [idservicio]: acotada,
        }));
    }

    function itemsCampingValidos(): ItemCampingSeleccionado[] {
        return Object.entries(cantidadesCamping)
            .map(([idStr, cant]) => ({
                idservicio: Number(idStr),
                cantidad: Math.floor(cant),
            }))
            .filter((item) => item.cantidad > 0);
    }

    // ==========================================
    // Confirmación final
    // ==========================================
    function manejarConfirmar() {
        if (!datos || !formularioValido || !transporteSeleccionadoId || !onConfirmar) {
            return;
        }

        // Saneamiento estricto: el payload solo puede contener elementos válidos para esta salida
        const personalDisponiblesIds = new Set(
            datos.personalDisponible.map((p) => p.idpersonal),
        );
        const transportesDisponiblesIds = new Set(
            datos.transportesDisponibles.map((t) => t.idservicio),
        );
        const stockMap = new Map(
            datos.stockCamping.map((item) => [item.idservicio, item.cantidadDisponible ?? 0]),
        );

        const personalIdsValidos = personalSeleccionadoIds.filter((id) =>
            personalDisponiblesIds.has(id),
        );

        if (
            personalIdsValidos.length === 0 ||
            !transportesDisponiblesIds.has(transporteSeleccionadoId)
        ) {
            return;
        }

        const itemsCampingSaneados = itemsCampingValidos()
            .map((item) => {
                const stockMax = stockMap.get(item.idservicio) ?? 0;
                const cantAcotada = Math.max(0, Math.min(item.cantidad, stockMax));
                return { idservicio: item.idservicio, cantidad: cantAcotada };
            })
            .filter((item) => item.cantidad > 0 && stockMap.has(item.idservicio));

        const payload: PayloadConfirmarAsignacion = {
            personalIds: personalIdsValidos,
            idtransporte: transporteSeleccionadoId,
            itemsCamping: itemsCampingSaneados,
        };

        onConfirmar(payload);
    }

    // ==========================================
    // Estado de carga o datos pendientes
    // ==========================================
    if (cargando) {
        return (
            <section
                aria-busy="true"
                className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                        <p className="text-sm font-medium text-texto">
                            Consultando dotación definitiva y recursos disponibles ante el backend...
                        </p>
                    </div>
                    {onCancelar ? (
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Cancelar
                        </Boton>
                    ) : null}
                </div>
            </section>
        );
    }

    if (!datos) {
        if (errorServidor) {
            const esErrorAlojamiento = errorServidor.toLowerCase().includes("alojamiento");
            return (
                <section className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4">
                    <header className="border-b border-borde pb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración · CU-40
                        </span>
                        <h2 className="text-xl font-bold text-navegacion">
                            Asignar recursos a la salida
                        </h2>
                    </header>
                    <Alerta
                        tipo={esErrorAlojamiento ? "advertencia" : "error"}
                        titulo="No es posible asignar recursos a esta salida"
                    >
                        <p>{errorServidor}</p>
                        {esErrorAlojamiento ? (
                            <div className="mt-2 pt-1 border-t border-amber-300/60">
                                <Link
                                    to="/gestion/solicitudes"
                                    className="font-bold underline text-xs text-amber-950 hover:text-amber-900"
                                >
                                    Ir a Gestión de Solicitudes para confirmar alojamientos (CU-34) →
                                </Link>
                            </div>
                        ) : null}
                    </Alerta>
                    <div className="flex justify-end gap-2 pt-2">
                        {onRecargarDatos ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                onClick={onRecargarDatos}
                                cargando={recargando}
                                disabled={recargando}
                            >
                                Reintentar consulta
                            </Boton>
                        ) : null}
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Volver al listado
                        </Boton>
                    </div>
                </section>
            );
        }
        return null;
    }

    const { salida, pasajerosConfirmados, bloqueoInicial } = datos;
    const totalNominaPermisos =
        pasajerosConfirmados + guiasSeleccionados + porteadoresSeleccionados;
    const transporteElegido = datos.transportesDisponibles.find(
        (t) => t.idservicio === transporteSeleccionadoId,
    );
    const articulosCampingSeleccionados = itemsCampingValidos();

    return (
        <section
            aria-labelledby={`${idSeccion}-titulo`}
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-8"
        >
            {/* Cabecera del Formulario */}
            <header className="border-b border-borde pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración · CU-40
                        </span>
                        <h2 id={`${idSeccion}-titulo`} className="text-xl font-bold text-navegacion">
                            Asignar recursos a la salida
                        </h2>
                    </div>
                    <span className="inline-flex items-center rounded bg-marca-suave px-2.5 py-1 text-xs font-semibold text-navegacion">
                        Perfil: ADMIN
                    </span>
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                    Definí la dotación definitiva de personal (guías y porteadores), seleccioná el
                    servicio de transporte y el equipamiento de camping requerido antes de confirmar
                    la emisión nominal de permisos.
                </p>
            </header>

            {/* Error al confirmar asignación */}
            {errorServidor ? (
                <Alerta
                    tipo={
                        errorServidor.toLowerCase().includes("alojamiento")
                            ? "advertencia"
                            : "error"
                    }
                    titulo="Error al confirmar la asignación de recursos"
                >
                    <div className="space-y-2">
                        <p>{errorServidor}</p>
                        {errorServidor.toLowerCase().includes("alojamiento") ? (
                            <div className="pt-2 border-t border-amber-300/60">
                                <Link
                                    to="/gestion/solicitudes"
                                    className="font-bold underline text-xs text-amber-950 hover:text-amber-900 inline-flex items-center gap-1"
                                >
                                    Ir a Gestión de Solicitudes para confirmar alojamientos (CU-34) →
                                </Link>
                            </div>
                        ) : null}
                        {onRecargarDatos ? (
                            <div className="pt-2 border-t border-borde/40 flex items-center justify-between gap-2">
                                <span className="text-xs text-texto-suave">
                                    Podés actualizar los datos de disponibilidad de recursos:
                                </span>
                                <Boton
                                    type="button"
                                    variante="secundario"
                                    className="px-2.5 py-1 text-xs"
                                    onClick={onRecargarDatos}
                                    cargando={recargando}
                                    disabled={guardando || recargando}
                                >
                                    Actualizar datos
                                </Boton>
                            </div>
                        ) : null}
                    </div>
                </Alerta>
            ) : null}

            {/* ======================================================== */}
            {/* SECCIÓN 1: Resumen de la salida y dotación requerida */}
            {/* ======================================================== */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navegacion text-xs font-bold text-white shadow-xs">
                        1
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                        Resumen del contingente y dotación requerida
                    </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Salida y fechas */}
                    <div className="rounded-control border border-borde bg-slate-50/70 p-3.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                            Salida a consolidar
                        </span>
                        <p className="mt-1 text-base font-bold text-navegacion">
                            {salida.nroSalida}
                        </p>
                        <p className="text-xs text-texto-suave mt-0.5">
                            {formatearFechaSalida(salida.fechaInicio)} al{" "}
                            {formatearFechaSalida(salida.fechaFin)}
                        </p>
                    </div>

                    {/* Pasajeros confirmados */}
                    <div className="rounded-control border border-borde bg-slate-50/70 p-3.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                            Pasajeros confirmados
                        </span>
                        <p className="mt-1 text-2xl font-extrabold text-navegacion">
                            {pasajerosConfirmados}
                        </p>
                        <p className="text-xs text-texto-suave mt-0.5">
                            Reservas con pago y alojamiento OK
                        </p>
                    </div>

                    {/* Dotación requerida */}
                    <div className="rounded-control border border-borde bg-slate-50/70 p-3.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                            Dotación mínima requerida
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-texto">
                                {guiasRequeridos} {guiasRequeridos === 1 ? "Guía" : "Guías"}
                            </span>
                            <span className="text-xs text-texto-suave">·</span>
                            <span className="text-lg font-bold text-texto">
                                {porteadoresRequeridos}{" "}
                                {porteadoresRequeridos === 1 ? "Porteador" : "Porteadores"}
                            </span>
                        </div>
                        <p className="text-xs text-texto-suave mt-0.5">
                            Calculada según los parámetros del circuito
                        </p>
                    </div>

                    {/* Bloqueo y Lugares sobrantes */}
                    <div className="rounded-control border border-borde bg-slate-50/70 p-3.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                            Bloqueo y cupo remanente
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-navegacion">
                                {lugaresSobrantesDisponibles}
                            </span>
                            <span className="text-xs text-texto-suave">
                                {lugaresSobrantesDisponibles === 1
                                    ? "lugar sobrante"
                                    : "lugares sobrantes"}
                            </span>
                        </div>
                        <p className="text-xs text-texto-suave mt-0.5">
                            Bloqueo inicial: {bloqueoInicial} plazas
                        </p>
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* SECCIÓN 2: Selección de guías y porteadores */}
            {/* ======================================================== */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navegacion text-xs font-bold text-white shadow-xs">
                        2
                    </span>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Selección de Guías y Porteadores
                        </h3>
                        <p className="text-xs text-texto-suave">
                            Seleccioná el personal libre y con habilitación vigente para cubrir la
                            dotación definitiva.
                        </p>
                    </div>
                </div>

                {/* Aviso sobre personal extra y cupo sobrante */}
                {totalPersonalExtra > 0 ? (
                    <div
                        className={`rounded-control border p-3 text-xs ${
                            excedeLugaresSobrantes
                                ? "border-peligro/30 bg-rose-50 text-peligro"
                                : "border-marca/30 bg-marca-suave/40 text-navegacion"
                        }`}
                    >
                        <p className="font-semibold">
                            Personal adicional seleccionado: {totalPersonalExtra}{" "}
                            {totalPersonalExtra === 1 ? "persona" : "personas"}
                            {guiasAdicionales > 0 && ` (${guiasAdicionales} guía/s extra)`}
                            {porteadoresAdicionales > 0 &&
                                ` (${porteadoresAdicionales} porteador/es extra)`}
                        </p>
                        <p className="mt-0.5">
                            {excedeLugaresSobrantes
                                ? `Supera los ${lugaresSobrantesDisponibles} lugares disponibles en el bloqueo. Debés reducir la selección para poder confirmar.`
                                : `Ocupará ${totalPersonalExtra} de los ${lugaresSobrantesDisponibles} lugares sobrantes del bloqueo. Los ${lugaresALiberar} restantes serán liberados ante la autoridad.`}
                        </p>
                    </div>
                ) : null}

                <div className="grid gap-6 md:grid-cols-2">
                    {/* BLOQUE A: GUÍAS DISPONIBLES */}
                    <div className="rounded-tarjeta border border-borde bg-white p-4 shadow-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2.5">
                            <div>
                                <h4 className="font-bold text-sm text-navegacion flex items-center gap-1.5">
                                    <span>Guías disponibles</span>
                                    <span className="text-xs font-normal text-texto-suave">
                                        ({guiasDisponibles.length})
                                    </span>
                                </h4>
                                <span className="text-xs text-texto-suave">
                                    Requeridos:{" "}
                                    <strong className="text-texto">{guiasRequeridos}</strong>
                                </span>
                            </div>

                            {/* Badge del contador de guías */}
                            <div>
                                {guiasFaltantes > 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                                        Faltan {guiasFaltantes}
                                    </span>
                                ) : guiasAdicionales > 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                                        {guiasSeleccionados}/{guiasRequeridos} (+{guiasAdicionales}{" "}
                                        extra)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                                        Cubierto ({guiasSeleccionados}/{guiasRequeridos})
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Listado de Checkboxes de Guías */}
                        {guiasDisponibles.length === 0 ? (
                            <p className="py-4 text-center text-xs text-texto-suave">
                                No se encontraron guías disponibles para las fechas de la salida.
                            </p>
                        ) : (
                            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {guiasDisponibles.map((guia) => {
                                    const seleccionado = personalSeleccionadoIds.includes(
                                        guia.idpersonal,
                                    );
                                    const inputId = `${idSeccion}-guia-${guia.idpersonal}`;

                                    return (
                                        <li key={guia.idpersonal}>
                                            <label
                                                htmlFor={inputId}
                                                className={`flex items-center justify-between rounded-control border p-2.5 text-sm cursor-pointer transition-colors ${
                                                    seleccionado
                                                        ? "border-marca bg-marca-suave/30 text-navegacion font-semibold"
                                                        : "border-borde hover:bg-slate-50 text-texto"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        id={inputId}
                                                        type="checkbox"
                                                        checked={seleccionado}
                                                        disabled={guardando}
                                                        onChange={() =>
                                                            alternarSeleccionPersonal(
                                                                guia.idpersonal,
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-borde text-marca focus:ring-marca cursor-pointer"
                                                    />
                                                    <span>{guia.nombreCompleto}</span>
                                                </div>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                    {guia.rol}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* BLOQUE B: PORTEADORES DISPONIBLES */}
                    <div className="rounded-tarjeta border border-borde bg-white p-4 shadow-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2.5">
                            <div>
                                <h4 className="font-bold text-sm text-navegacion flex items-center gap-1.5">
                                    <span>Porteadores disponibles</span>
                                    <span className="text-xs font-normal text-texto-suave">
                                        ({porteadoresDisponibles.length})
                                    </span>
                                </h4>
                                <span className="text-xs text-texto-suave">
                                    Requeridos:{" "}
                                    <strong className="text-texto">{porteadoresRequeridos}</strong>
                                </span>
                            </div>

                            {/* Badge del contador de porteadores */}
                            <div>
                                {porteadoresFaltantes > 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                                        Faltan {porteadoresFaltantes}
                                    </span>
                                ) : porteadoresAdicionales > 0 ? (
                                    <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                                        {porteadoresSeleccionados}/{porteadoresRequeridos} (+
                                        {porteadoresAdicionales} extra)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                                        Cubierto ({porteadoresSeleccionados}/
                                        {porteadoresRequeridos})
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Listado de Checkboxes de Porteadores */}
                        {porteadoresDisponibles.length === 0 ? (
                            <p className="py-4 text-center text-xs text-texto-suave">
                                No se encontraron porteadores disponibles para las fechas de la
                                salida.
                            </p>
                        ) : (
                            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {porteadoresDisponibles.map((porteador) => {
                                    const seleccionado = personalSeleccionadoIds.includes(
                                        porteador.idpersonal,
                                    );
                                    const inputId = `${idSeccion}-porteador-${porteador.idpersonal}`;

                                    return (
                                        <li key={porteador.idpersonal}>
                                            <label
                                                htmlFor={inputId}
                                                className={`flex items-center justify-between rounded-control border p-2.5 text-sm cursor-pointer transition-colors ${
                                                    seleccionado
                                                        ? "border-marca bg-marca-suave/30 text-navegacion font-semibold"
                                                        : "border-borde hover:bg-slate-50 text-texto"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        id={inputId}
                                                        type="checkbox"
                                                        checked={seleccionado}
                                                        disabled={guardando}
                                                        onChange={() =>
                                                            alternarSeleccionPersonal(
                                                                porteador.idpersonal,
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-borde text-marca focus:ring-marca cursor-pointer"
                                                    />
                                                    <span>{porteador.nombreCompleto}</span>
                                                </div>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                    {porteador.rol}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* SECCIÓN 3: Selección de transporte */}
            {/* ======================================================== */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navegacion text-xs font-bold text-white shadow-xs">
                        3
                    </span>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Selección de transporte
                        </h3>
                        <p className="text-xs text-texto-suave">
                            Elegí un servicio de transporte disponible con capacidad suficiente para
                            los {pasajerosConfirmados} pasajeros confirmados.
                        </p>
                    </div>
                </div>

                {datos.transportesDisponibles.length === 0 ? (
                    <div className="rounded-control border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                        <p className="font-semibold">Sin transportes disponibles</p>
                        <p className="mt-0.5">
                            No hay vehículos con capacidad para {pasajerosConfirmados} pasajeros
                            disponibles en las fechas seleccionadas.
                        </p>
                    </div>
                ) : (
                    <fieldset className="border-0 p-0 m-0">
                        <legend className="sr-only">Selección de servicio de transporte</legend>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {datos.transportesDisponibles.map((transporte) => {
                                const seleccionado =
                                    transporteSeleccionadoId === transporte.idservicio;
                                const inputId = `${idSeccion}-transporte-${transporte.idservicio}`;

                                return (
                                    <label
                                        key={transporte.idservicio}
                                        htmlFor={inputId}
                                        className={`relative flex flex-col justify-between rounded-tarjeta border p-4 cursor-pointer transition-colors ${
                                            seleccionado
                                                ? "border-marca bg-marca-suave/30 shadow-xs"
                                                : "border-borde hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-sm text-navegacion">
                                                    {transporte.nombreServicio}
                                                </p>
                                                <p className="text-xs text-texto-suave mt-0.5">
                                                    Capacidad:{" "}
                                                    <strong className="text-texto">
                                                        {transporte.capacidadVehiculo ?? "—"} asientos
                                                    </strong>
                                                </p>
                                            </div>
                                            <input
                                                id={inputId}
                                                type="radio"
                                                name="transporte-salida"
                                                value={transporte.idservicio}
                                                checked={seleccionado}
                                                disabled={guardando}
                                                onChange={() =>
                                                    setTransporteSeleccionadoId(transporte.idservicio)
                                                }
                                                className="h-4 w-4 text-marca focus:ring-marca cursor-pointer mt-0.5"
                                            />
                                        </div>

                                        <div className="mt-3 pt-2 border-t border-borde/60 flex items-center justify-between text-[11px]">
                                            <span className="text-texto-suave">
                                                Pasajeros: {pasajerosConfirmados}
                                            </span>
                                            {transporte.capacidadVehiculo !== undefined &&
                                            transporte.capacidadVehiculo >= pasajerosConfirmados ? (
                                                <span className="font-semibold text-emerald-700">
                                                    ✓ Capacidad adecuada
                                                </span>
                                            ) : null}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                )}
            </div>

            {/* ======================================================== */}
            {/* SECCIÓN 4: Equipamiento de camping */}
            {/* ======================================================== */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navegacion text-xs font-bold text-white shadow-xs">
                        4
                    </span>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Equipamiento de camping
                        </h3>
                        <p className="text-xs text-texto-suave">
                            Indicá las cantidades requeridas de cada artículo. La cantidad
                            solicitada no puede superar el stock disponible en depósito.
                        </p>
                    </div>
                </div>

                {datos.stockCamping.length === 0 ? (
                    <p className="py-3 text-xs text-texto-suave italic">
                        No hay equipamiento de camping registrado en el sistema.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-control border border-borde">
                        <table className="min-w-full divide-y divide-borde text-left text-xs">
                            <thead className="bg-slate-50 font-semibold text-texto-suave">
                                <tr>
                                    <th className="px-4 py-2.5">Artículo / Servicio</th>
                                    <th className="px-4 py-2.5">Tipo</th>
                                    <th className="px-4 py-2.5 text-center">Stock disponible</th>
                                    <th className="px-4 py-2.5 text-right">Cantidad solicitada</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde bg-white">
                                {datos.stockCamping.map((item) => {
                                    const stock = item.cantidadDisponible ?? 0;
                                    const cantidad = cantidadesCamping[item.idservicio] ?? 0;
                                    const inputId = `${idSeccion}-camping-${item.idservicio}`;

                                    return (
                                        <tr
                                            key={item.idservicio}
                                            className={
                                                cantidad > 0 ? "bg-marca-suave/10" : undefined
                                            }
                                        >
                                            <td className="px-4 py-2.5 font-medium text-texto">
                                                {item.nombreServicio}
                                            </td>
                                            <td className="px-4 py-2.5 text-texto-suave">
                                                {item.tipoEquipamiento ?? "Equipamiento"}
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                        stock > 0
                                                            ? "bg-slate-100 text-slate-700"
                                                            : "bg-rose-100 text-rose-800"
                                                    }`}
                                                >
                                                    {stock} disp.
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="inline-flex items-center gap-1.5 justify-end">
                                                    <button
                                                        type="button"
                                                        disabled={cantidad <= 0 || guardando}
                                                        onClick={() =>
                                                            cambiarCantidadCamping(
                                                                item.idservicio,
                                                                cantidad - 1,
                                                                stock,
                                                            )
                                                        }
                                                        className="flex h-7 w-7 items-center justify-center rounded border border-borde bg-white text-xs font-bold text-texto hover:bg-slate-50 disabled:opacity-40"
                                                        aria-label={`Disminuir ${item.nombreServicio}`}
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        id={inputId}
                                                        type="number"
                                                        min={0}
                                                        max={stock}
                                                        step="1"
                                                        value={cantidad}
                                                        disabled={guardando || stock === 0}
                                                        aria-label={`Cantidad solicitada de ${item.nombreServicio}`}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10);
                                                            cambiarCantidadCamping(
                                                                item.idservicio,
                                                                Number.isNaN(val) ? 0 : val,
                                                                stock,
                                                            );
                                                        }}
                                                        className="h-7 w-16 rounded border border-borde px-2 text-center text-xs font-semibold text-texto focus:border-marca focus:ring-1 focus:ring-marca outline-none disabled:bg-slate-100"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={cantidad >= stock || guardando}
                                                        onClick={() =>
                                                            cambiarCantidadCamping(
                                                                item.idservicio,
                                                                cantidad + 1,
                                                                stock,
                                                            )
                                                        }
                                                        className="flex h-7 w-7 items-center justify-center rounded border border-borde bg-white text-xs font-bold text-texto hover:bg-slate-50 disabled:opacity-40"
                                                        aria-label={`Aumentar ${item.nombreServicio}`}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* SECCIÓN 5: Resumen final de la asignación */}
            {/* ======================================================== */}
            <div className="space-y-4 border-t border-borde pt-5">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navegacion text-xs font-bold text-white shadow-xs">
                        5
                    </span>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Resumen final de la asignación y emisión de permisos
                        </h3>
                        <p className="text-xs text-texto-suave">
                            Verificá los recursos consolidados antes de confirmar la nómina.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Nómina a emitir */}
                    <div className="rounded-control border border-borde bg-slate-50 p-3 text-xs">
                        <span className="font-semibold text-texto-suave uppercase text-[10px]">
                            Nómina total de permisos
                        </span>
                        <p className="mt-1 text-lg font-bold text-navegacion">
                            {totalNominaPermisos} personas
                        </p>
                        <p className="text-[11px] text-texto-suave mt-0.5">
                            {pasajerosConfirmados} pasajeros + {guiasSeleccionados} guías +{" "}
                            {porteadoresSeleccionados} porteadores
                        </p>
                    </div>

                    {/* Transporte seleccionado */}
                    <div className="rounded-control border border-borde bg-slate-50 p-3 text-xs">
                        <span className="font-semibold text-texto-suave uppercase text-[10px]">
                            Transporte seleccionado
                        </span>
                        <p className="mt-1 text-sm font-bold text-texto truncate">
                            {transporteElegido?.nombreServicio ?? "Pendiente de selección"}
                        </p>
                        <p className="text-[11px] text-texto-suave mt-0.5">
                            {transporteElegido
                                ? `Capacidad: ${transporteElegido.capacidadVehiculo ?? "—"} asientos`
                                : "Debe elegirse en el paso 3"}
                        </p>
                    </div>

                    {/* Camping asignado */}
                    <div className="rounded-control border border-borde bg-slate-50 p-3 text-xs">
                        <span className="font-semibold text-texto-suave uppercase text-[10px]">
                            Equipamiento de camping
                        </span>
                        <p className="mt-1 text-sm font-bold text-texto">
                            {articulosCampingSeleccionados.length}{" "}
                            {articulosCampingSeleccionados.length === 1
                                ? "artículo asignado"
                                : "artículos asignados"}
                        </p>
                        <p className="text-[11px] text-texto-suave mt-0.5">
                            Total unidades:{" "}
                            {articulosCampingSeleccionados.reduce(
                                (acc, item) => acc + item.cantidad,
                                0,
                            )}
                        </p>
                    </div>

                    {/* Liberación de sobrantes */}
                    <div className="rounded-control border border-borde bg-slate-50 p-3 text-xs">
                        <span className="font-semibold text-texto-suave uppercase text-[10px]">
                            Lugares a liberar ante la autoridad
                        </span>
                        <p className="mt-1 text-lg font-bold text-emerald-800">
                            {lugaresALiberar} lugares
                        </p>
                        <p className="text-[11px] text-texto-suave mt-0.5">
                            Sobrantes: {lugaresSobrantesDisponibles} · Extra: {totalPersonalExtra}
                        </p>
                    </div>
                </div>

                {/* Avisos si falta alguna condición */}
                {!formularioValido ? (
                    <div className="rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                        <p className="font-bold">Para confirmar la asignación es necesario:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {!cumpleGuias && (
                                <li>
                                    Asignar al menos {guiasRequeridos}{" "}
                                    {guiasRequeridos === 1 ? "guía" : "guías"} (seleccionaste{" "}
                                    {guiasSeleccionados}).
                                </li>
                            )}
                            {!cumplePorteadores && (
                                <li>
                                    Asignar al menos {porteadoresRequeridos}{" "}
                                    {porteadoresRequeridos === 1 ? "porteador" : "porteadores"}{" "}
                                    (seleccionaste {porteadoresSeleccionados}).
                                </li>
                            )}
                            {!cumpleTransporte && (
                                <li>Seleccionar un servicio de transporte disponible.</li>
                            )}
                            {excedeLugaresSobrantes && (
                                <li>
                                    Reducir el personal adicional: seleccionaste{" "}
                                    {totalPersonalExtra} personas extra para un cupo disponible de{" "}
                                    {lugaresSobrantesDisponibles}.
                                </li>
                            )}
                        </ul>
                    </div>
                ) : null}

                {/* Botones de Acción */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                    <p className="text-xs text-texto-suave">
                        Al confirmar, se emitirán los permisos nominales ante la autoridad, se liberarán los sobrantes y la salida quedará cerrada.
                    </p>
                    <div className="flex items-center gap-2">
                        <Boton
                            type="button"
                            variante="secundario"
                            onClick={onCancelar}
                            disabled={guardando}
                        >
                            Cancelar
                        </Boton>
                        <Boton
                            type="button"
                            variante="principal"
                            onClick={manejarConfirmar}
                            disabled={!formularioValido || guardando || !onConfirmar}
                            cargando={guardando}
                        >
                            Confirmar asignación
                        </Boton>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default FormularioAsignarRecursos;
