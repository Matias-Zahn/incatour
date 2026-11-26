import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "./Alerta";
import Boton from "./Boton";
import {
    etiquetaModalidad,
    formatearFechaUtcCorta,
    formatearRangoFechasUtc,
} from "../services/formato";
import {
    useOpcionesSalida,
    type DetalleConflictoConfirmacion,
    type PanelConfirmacion,
    type PayloadConfirmarAsignacion,
} from "../services/salidaService";

export type FormularioAsignarRecursosProps = {
    datos?: PanelConfirmacion | null;
    idpaquete?: number;
    tamanoMaximo?: number;
    cargando?: boolean;
    recargando?: boolean;
    guardando?: boolean;
    errorServidor?: string;
    detalleErrorConfirmacion?: DetalleConflictoConfirmacion | null;
    onRecargarDatos?: () => void;
    onConfirmar?: (payload: PayloadConfirmarAsignacion) => void;
    onCancelar?: () => void;
    onAbrirReemplazo?: () => void;
    onAbrirLogistica?: () => void;
};

export function FormularioAsignarRecursos({
    datos,
    idpaquete,
    tamanoMaximo,
    cargando = false,
    recargando = false,
    guardando = false,
    errorServidor,
    detalleErrorConfirmacion = null,
    onRecargarDatos,
    onConfirmar,
    onCancelar,
    onAbrirReemplazo,
    onAbrirLogistica,
}: FormularioAsignarRecursosProps) {
    const idSeccion = useId();
    const [personalElegidoIds, setPersonalElegidoIds] = useState<number[]>([]);
    // null: se usa la sugerencia del sistema (los porteadores con más salidas en el mes)
    const [porteadoresALiberar, setPorteadoresALiberar] = useState<number[] | null>(null);

    // §14: salidas creadas antes de la etapa 3 llegan sin personal asignado;
    // se puede elegir acá usando las opciones de CU-36 (5.1) y enviarlo en { personalIds }.
    const salidaSinPersonal = Boolean(datos && datos.personal.length === 0);
    const paramsOpcionesPersonal = useMemo(() => {
        if (!salidaSinPersonal || !datos || !idpaquete || !tamanoMaximo) return null;
        return {
            idpaquete,
            fechaInicio: datos.salida.fechaInicio.slice(0, 10),
            tamanoMaximo,
        };
    }, [salidaSinPersonal, datos, idpaquete, tamanoMaximo]);

    const {
        data: opcionesPersonal,
        isPending: cargandoOpcionesPersonal,
        error: errorOpcionesPersonal,
    } = useOpcionesSalida(paramsOpcionesPersonal, { enabled: Boolean(paramsOpcionesPersonal) });

    const guiasDisponibles = useMemo(
        () => opcionesPersonal?.personal.guias ?? [],
        [opcionesPersonal?.personal.guias],
    );
    const porteadoresDisponibles = useMemo(
        () => opcionesPersonal?.personal.porteadores ?? [],
        [opcionesPersonal?.personal.porteadores],
    );

    const guiasElegidosCount = useMemo(() => {
        const ids = new Set(guiasDisponibles.map((g) => g.idpersonal));
        return personalElegidoIds.filter((id) => ids.has(id)).length;
    }, [guiasDisponibles, personalElegidoIds]);

    const porteadoresElegidosCount = useMemo(() => {
        const ids = new Set(porteadoresDisponibles.map((p) => p.idpersonal));
        return personalElegidoIds.filter((id) => ids.has(id)).length;
    }, [porteadoresDisponibles, personalElegidoIds]);

    function alternarPersonalLegacy(idpersonal: number) {
        setPersonalElegidoIds((prev) =>
            prev.includes(idpersonal)
                ? prev.filter((id) => id !== idpersonal)
                : [...prev, idpersonal],
        );
    }

    if (cargando) {
        return (
            <section aria-busy="true" className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                        <p className="text-sm font-medium text-texto">
                            Cargando el estado y los recursos de la salida...
                        </p>
                    </div>
                    {onCancelar ? (
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Cerrar
                        </Boton>
                    ) : null}
                </div>
            </section>
        );
    }

    if (!datos) {
        if (errorServidor) {
            return (
                <section className="p-6 space-y-4">
                    <header className="border-b border-borde pb-3">
                        <h2 className="text-xl font-bold text-navegacion">
                            Confirmar salida
                        </h2>
                    </header>
                    <Alerta tipo="error" titulo="No se pudo cargar el panel de confirmación">
                        <p>{errorServidor}</p>
                    </Alerta>
                    <div className="flex justify-end gap-2">
                        {onRecargarDatos ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                onClick={onRecargarDatos}
                                cargando={recargando}
                                disabled={recargando}
                            >
                                Reintentar
                            </Boton>
                        ) : null}
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Cerrar
                        </Boton>
                    </div>
                </section>
            );
        }
        return null;
    }

    const {
        salida,
        puedeConfirmar,
        motivoNoConfirmable,
        pasajerosConfirmados,
        dotacionRequerida,
        personal,
        porteadoresSobrantes,
        hoteles,
        transporte,
        equipo,
        reservasSinAlojamiento,
        faltantes,
        bloqueoInicial,
        lugaresSobrantes,
    } = datos;

    const hayPersonalNoApto = personal.some((p) => !p.apto);
    const equipoConFalta = equipo.filter((e) => e.falta > 0);
    const transporteInsuficiente = Boolean(transporte && !transporte.alcanza); // sin transporte asignado no hay nada que cambiar
    const hayFaltaEquipoOTransporte =
        equipoConFalta.length > 0 || transporteInsuficiente;
    const hayPendientesDeResolucion =
        faltantes.length > 0 || reservasSinAlojamiento.length > 0;

    // §14: si la salida no tiene personal y solo falta asignarlo (no hay otros faltantes ni venta abierta),
    // habilitamos confirmar cuando la dotación seleccionada cubre lo requerido para los vendidos.
    const faltantesSinPersonal = faltantes.filter(
        (f) => !f.toLowerCase().startsWith("sin personal asignado"),
    );
    const cumpleDotacionLegacy =
        salidaSinPersonal &&
        guiasElegidosCount >= dotacionRequerida.guias &&
        porteadoresElegidosCount >= dotacionRequerida.porteadores &&
        personalElegidoIds.length > 0;
    const puedeConfirmarConPersonalLegacy =
        salidaSinPersonal &&
        salida.estado === "PUBLICADA" &&
        !salida.ventaAbierta &&
        pasajerosConfirmados > 0 &&
        reservasSinAlojamiento.length === 0 &&
        faltantesSinPersonal.length === 0 &&
        cumpleDotacionLegacy;

    const porteadoresElegidos = porteadoresALiberar ?? datos.porteadoresSugeridosALiberar ?? [];
    const faltaElegirPorteadores = porteadoresSobrantes > 0 && porteadoresElegidos.length !== porteadoresSobrantes;
    const habilitarConfirmacion = (puedeConfirmar || puedeConfirmarConPersonalLegacy) && !faltaElegirPorteadores;

    function alternarPorteadorALiberar(idpersonal: number) {
        setPorteadoresALiberar(
            porteadoresElegidos.includes(idpersonal)
                ? porteadoresElegidos.filter((id) => id !== idpersonal)
                : [...porteadoresElegidos, idpersonal],
        );
    }

    function manejarConfirmarClick() {
        if (!habilitarConfirmacion || guardando) return;
        if (salidaSinPersonal && personalElegidoIds.length > 0) {
            onConfirmar?.({ personalIds: personalElegidoIds });
            return;
        }
        onConfirmar?.(porteadoresSobrantes > 0 ? { porteadoresALiberar: porteadoresElegidos } : {});
    }

    return (
        <section
            aria-labelledby={`${idSeccion}-titulo`}
            className="p-6 space-y-6"
        >
            <header className="border-b border-borde pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Revisión previa al inicio
                        </span>
                        <h2 id={`${idSeccion}-titulo`} className="text-xl font-bold text-navegacion">
                            Confirmar salida {salida.nroSalida}
                        </h2>
                    </div>
                    <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                            salida.ventaAbierta
                                ? "bg-sky-100 text-sky-900"
                                : habilitarConfirmacion
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-amber-100 text-amber-900"
                        }`}
                    >
                        {salida.ventaAbierta
                            ? `Venta abierta hasta el ${formatearFechaUtcCorta(salida.ultimoDiaVenta)}`
                            : habilitarConfirmacion
                              ? "Lista para confirmar"
                              : "Venta cerrada · con pendientes"}
                    </span>
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                    Revisá que el personal, los hoteles, el transporte y el equipamiento estén en orden antes de emitir los permisos nominales y liberar lugares sobrantes.
                </p>
            </header>

            {errorServidor ? (
                <Alerta tipo="error" titulo="No se pudo confirmar la salida">
                    <div className="space-y-2">
                        <p>{errorServidor}</p>
                        {detalleErrorConfirmacion &&
                        detalleErrorConfirmacion.reservasSinAlojamiento.length > 0 ? (
                            <p className="text-xs">
                                Reservas con alojamiento pendiente:{" "}
                                <strong>
                                    {detalleErrorConfirmacion.reservasSinAlojamiento.join(", ")}
                                </strong>
                            </p>
                        ) : null}
                        {detalleErrorConfirmacion &&
                        detalleErrorConfirmacion.faltantes.length > 0 ? (
                            <ul className="list-disc pl-5 text-xs space-y-0.5">
                                {detalleErrorConfirmacion.faltantes.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        ) : null}
                        {onRecargarDatos ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={onRecargarDatos}
                                cargando={recargando}
                            >
                                Actualizar estado
                            </Boton>
                        ) : null}
                    </div>
                </Alerta>
            ) : null}

            {!habilitarConfirmacion && motivoNoConfirmable ? (
                <Alerta
                    tipo={salida.ventaAbierta ? "informacion" : "advertencia"}
                    titulo={
                        salida.ventaAbierta
                            ? "La venta todavía está abierta"
                            : "Todavía no se puede confirmar esta salida"
                    }
                >
                    <p>{motivoNoConfirmable}</p>
                </Alerta>
            ) : null}

            {hayPendientesDeResolucion ? (
                <Alerta tipo="error" titulo="Pendientes que impiden confirmar">
                    <div className="space-y-3">
                        {faltantes.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                                {faltantes.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        ) : null}

                        {reservasSinAlojamiento.length > 0 ? (
                            <p className="text-xs sm:text-sm">
                                Reservas con alojamiento pendiente de confirmación:{" "}
                                <strong>{reservasSinAlojamiento.join(", ")}</strong>.
                            </p>
                        ) : null}

                        {/* Accesos directos para resolver cada pendiente en su pantalla correspondiente */}
                        <div className="space-y-2 border-t border-rose-200/80 pt-2.5">
                            {equipoConFalta.map((item) => {
                                const rutaProveedor = item.idproveedor
                                    ? `/gestion/proveedores/${item.idproveedor}/servicios`
                                    : "/gestion/proveedores";
                                const textoProveedor = item.nombreProveedor
                                    ? `Ir a ${item.nombreProveedor}`
                                    : "Ver en proveedores";

                                return (
                                    <div
                                        key={item.idservicio}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-rose-200 bg-white/90 px-3 py-2 text-xs text-texto"
                                    >
                                        <div className="min-w-0">
                                            <span className="font-bold text-navegacion">
                                                {item.nombreServicio}
                                            </span>
                                            <span className="ml-1.5 font-semibold text-peligro">
                                                (faltan {item.falta})
                                            </span>
                                        </div>
                                        <Link
                                            to={rutaProveedor}
                                            className="inline-flex items-center gap-1 rounded-control border border-marca/45 bg-marca/10 px-2.5 py-1 text-xs font-semibold text-marca-oscura transition hover:bg-marca/20"
                                        >
                                            <span>{textoProveedor}</span>
                                            <span aria-hidden="true">→</span>
                                        </Link>
                                    </div>
                                );
                            })}

                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {reservasSinAlojamiento.length > 0 ? (
                                    <Link
                                        to={`/gestion/solicitudes?salida=${salida.nroSalida}`}
                                        className="inline-flex items-center gap-1.5 rounded-control border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-navegacion shadow-2xs transition hover:border-marca hover:bg-marca-suave/40"
                                    >
                                        <span>
                                            Resolver solicitudes de hotel ({reservasSinAlojamiento.length})
                                        </span>
                                        <span aria-hidden="true">→</span>
                                    </Link>
                                ) : null}

                                {(equipoConFalta.length > 0 || transporteInsuficiente) &&
                                onAbrirLogistica ? (
                                    <Boton
                                        type="button"
                                        variante="secundario"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={guardando}
                                        onClick={onAbrirLogistica}
                                    >
                                        {transporteInsuficiente && equipoConFalta.length === 0
                                            ? "Cambiar transporte en logística"
                                            : "Modificar logística"}
                                    </Boton>
                                ) : null}

                                {hayPersonalNoApto && onAbrirReemplazo ? (
                                    <Boton
                                        type="button"
                                        variante="secundario"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={guardando}
                                        onClick={onAbrirReemplazo}
                                    >
                                        Reemplazar personal
                                    </Boton>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {/* Resumen numérico */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-control border border-borde bg-slate-50/70 p-3">
                    <span className="font-semibold uppercase tracking-wide text-texto-suave">
                        Fechas
                    </span>
                    <p className="mt-1 text-sm font-bold text-navegacion">
                        {formatearRangoFechasUtc(salida.fechaInicio, salida.fechaFin)}
                    </p>
                    <p className="text-texto-suave">
                        Cierre venta: {formatearFechaUtcCorta(salida.ultimoDiaVenta)}
                    </p>
                </div>
                <div className="rounded-control border border-borde bg-slate-50/70 p-3">
                    <span className="font-semibold uppercase tracking-wide text-texto-suave">
                        Pasajeros confirmados
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-navegacion">
                        {pasajerosConfirmados}
                    </p>
                    <p className="text-texto-suave">
                        Dotación mínima: {dotacionRequerida.guias} guía(s) · {dotacionRequerida.porteadores} porteador(es)
                    </p>
                </div>
                <div className="rounded-control border border-borde bg-slate-50/70 p-3">
                    <span className="font-semibold uppercase tracking-wide text-texto-suave">
                        Personal asignado
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-navegacion">
                        {salidaSinPersonal ? personalElegidoIds.length : personal.length}
                    </p>
                    <p className="text-texto-suave">
                        Permisos a emitir:{" "}
                        {pasajerosConfirmados +
                            (salidaSinPersonal ? personalElegidoIds.length : personal.length) -
                            (porteadoresSobrantes > 0 ? porteadoresElegidos.length : 0)}
                    </p>
                </div>
                <div className="rounded-control border border-borde bg-slate-50/70 p-3">
                    <span className="font-semibold uppercase tracking-wide text-texto-suave">
                        Lugares sobrantes
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-navegacion">
                        {lugaresSobrantes}
                    </p>
                    <p className="text-texto-suave">
                        Bloqueo inicial: {bloqueoInicial} · se liberan al confirmar
                    </p>
                </div>
            </div>

            {porteadoresSobrantes > 0 ? (
                <Alerta tipo="informacion" titulo="Porteadores sobrantes para la venta final">
                    Tenés {porteadoresSobrantes}{" "}
                    {porteadoresSobrantes === 1 ? "porteador" : "porteadores"} por encima del mínimo requerido para {pasajerosConfirmados} pasajeros. Elegí {porteadoresSobrantes === 1 ? "cuál se libera" : `cuáles ${porteadoresSobrantes} se liberan`}: al confirmar no se emite su permiso y quedan libres para otras salidas. Viene marcado quien tiene más salidas en el mes.
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {personal
                            .filter((p) => p.rol === "Porteador")
                            .map((p) => (
                                <label key={p.idpersonal} className="inline-flex items-center gap-1.5 text-sm text-texto">
                                    <input
                                        type="checkbox"
                                        checked={porteadoresElegidos.includes(p.idpersonal)}
                                        onChange={() => alternarPorteadorALiberar(p.idpersonal)}
                                        disabled={
                                            !porteadoresElegidos.includes(p.idpersonal) &&
                                            porteadoresElegidos.length >= porteadoresSobrantes
                                        }
                                    />
                                    {p.nombreCompleto}
                                </label>
                            ))}
                    </div>
                    {faltaElegirPorteadores ? (
                        <p className="mt-1 text-xs font-semibold text-advertencia">
                            Marcá {porteadoresSobrantes} para poder confirmar ({porteadoresElegidos.length} elegidos).
                        </p>
                    ) : null}
                </Alerta>
            ) : null}

            {/* Personal */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-navegacion">
                        {salidaSinPersonal
                            ? "Elegir personal para esta salida"
                            : `Personal asignado (${personal.length})`}
                    </h3>
                    {hayPersonalNoApto && onAbrirReemplazo ? (
                        <Boton
                            type="button"
                            variante="secundario"
                            className="px-3 py-1 text-xs"
                            onClick={onAbrirReemplazo}
                        >
                            Reemplazar personal
                        </Boton>
                    ) : null}
                </div>

                {salidaSinPersonal ? (
                    <div className="space-y-3 rounded-control border border-amber-200 bg-amber-50/40 p-4">
                        <p className="text-xs text-texto-suave">
                            Esta salida fue creada sin personal asignado. Elegí al menos{" "}
                            <strong>{dotacionRequerida.guias} guía(s)</strong> y{" "}
                            <strong>{dotacionRequerida.porteadores} porteador(es)</strong> para asignarlos al confirmar.
                        </p>
                        {cargandoOpcionesPersonal ? (
                            <p className="text-xs text-texto-suave">
                                Cargando personal libre para esas fechas...
                            </p>
                        ) : errorOpcionesPersonal ? (
                            <Alerta tipo="error" titulo="No se pudo consultar el personal libre">
                                {errorOpcionesPersonal.message}
                            </Alerta>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-control border border-borde bg-white p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span>Guías libres</span>
                                        <span
                                            className={
                                                guiasElegidosCount >= dotacionRequerida.guias
                                                    ? "text-emerald-700"
                                                    : "text-amber-800"
                                            }
                                        >
                                            {guiasElegidosCount} / {dotacionRequerida.guias}
                                        </span>
                                    </div>
                                    <ul className="space-y-1 max-h-44 overflow-y-auto">
                                        {guiasDisponibles.map((g) => {
                                            const marcado = personalElegidoIds.includes(g.idpersonal);
                                            return (
                                                <li key={g.idpersonal}>
                                                    <label className="flex items-center justify-between rounded border border-borde px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={marcado}
                                                                onChange={() =>
                                                                    alternarPersonalLegacy(g.idpersonal)
                                                                }
                                                            />
                                                            {g.nombreCompleto}
                                                        </span>
                                                        <span className="text-texto-suave">
                                                            {g.salidasEnElMes} este mes
                                                        </span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                                <div className="rounded-control border border-borde bg-white p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span>Porteadores libres</span>
                                        <span
                                            className={
                                                porteadoresElegidosCount >=
                                                dotacionRequerida.porteadores
                                                    ? "text-emerald-700"
                                                    : "text-amber-800"
                                            }
                                        >
                                            {porteadoresElegidosCount} /{" "}
                                            {dotacionRequerida.porteadores}
                                        </span>
                                    </div>
                                    <ul className="space-y-1 max-h-44 overflow-y-auto">
                                        {porteadoresDisponibles.map((p) => {
                                            const marcado = personalElegidoIds.includes(p.idpersonal);
                                            return (
                                                <li key={p.idpersonal}>
                                                    <label className="flex items-center justify-between rounded border border-borde px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={marcado}
                                                                onChange={() =>
                                                                    alternarPersonalLegacy(p.idpersonal)
                                                                }
                                                            />
                                                            {p.nombreCompleto}
                                                        </span>
                                                        <span className="text-texto-suave">
                                                            {p.salidasEnElMes} este mes
                                                        </span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {personal.map((p) => (
                            <div
                                key={p.idpersonal}
                                className={`flex items-start justify-between gap-2 rounded-control border p-3 text-xs ${
                                    p.apto
                                        ? "border-borde bg-white"
                                        : "border-rose-300 bg-rose-50"
                                }`}
                            >
                                <div>
                                    <p className="font-bold text-sm text-navegacion">
                                        {p.nombreCompleto}
                                    </p>
                                    <p className="text-texto-suave">{p.rol}</p>
                                    {!p.apto && p.motivo ? (
                                        <p className="mt-1 font-semibold text-peligro">
                                            {p.motivo}
                                        </p>
                                    ) : null}
                                </div>
                                <span
                                    className={`rounded-full px-2 py-0.5 font-semibold ${
                                        p.apto
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-rose-200 text-rose-900"
                                    }`}
                                >
                                    {p.apto ? "Apto" : "No apto"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hoteles y Transporte */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-control border border-borde p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-navegacion">Hoteles</h3>
                        {reservasSinAlojamiento.length > 0 ? (
                            <Link
                                to={`/gestion/solicitudes?salida=${salida.nroSalida}`}
                                className="text-xs font-semibold text-marca hover:underline"
                            >
                                Ir a solicitudes ({reservasSinAlojamiento.length}) →
                            </Link>
                        ) : null}
                    </div>
                    {hoteles.length === 0 ? (
                        <p className="text-xs text-texto-suave">Sin noches de hotel.</p>
                    ) : (
                        <ul className="space-y-2 text-xs">
                            {hoteles.map((h) => (
                                <li
                                    key={h.idservicio}
                                    className="flex items-center justify-between gap-2 border-b border-borde/50 pb-1.5 last:border-b-0 last:pb-0"
                                >
                                    <div>
                                        <p className="font-semibold text-texto">
                                            {h.nombreServicio}
                                        </p>
                                        <p className="text-texto-suave">
                                            {h.modalidadConfirmacion
                                                ? etiquetaModalidad(h.modalidadConfirmacion)
                                                : "—"}
                                        </p>
                                    </div>
                                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-navegacion">
                                        {h.pasajeros} pax
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-control border border-borde p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-navegacion">Transporte</h3>
                        {(!transporte || !transporte.alcanza) && onAbrirLogistica ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={onAbrirLogistica}
                            >
                                {transporte ? "Cambiar en logística" : "Asignar en logística"}
                            </Boton>
                        ) : null}
                    </div>
                    {transporte ? (
                        <div className="text-xs space-y-1">
                            <p className="font-semibold text-sm text-texto">
                                {transporte.nombreServicio}
                            </p>
                            <p className="text-texto-suave">
                                Capacidad: <strong>{transporte.capacidadVehiculo} asientos</strong>
                            </p>
                            <span
                                className={`inline-block rounded-full px-2 py-0.5 font-semibold ${
                                    transporte.alcanza
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-rose-100 text-rose-900"
                                }`}
                            >
                                {transporte.alcanza
                                    ? "Capacidad suficiente"
                                    : "Capacidad insuficiente"}
                            </span>
                        </div>
                    ) : (
                        <p className="text-xs text-peligro">Sin transporte asignado.</p>
                    )}
                </div>
            </div>

            {/* Equipamiento */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-navegacion">Equipamiento</h3>
                    {hayFaltaEquipoOTransporte && onAbrirLogistica ? (
                        <Boton
                            type="button"
                            variante="secundario"
                            className="px-3 py-1 text-xs"
                            onClick={onAbrirLogistica}
                        >
                            Ajustar en logística
                        </Boton>
                    ) : null}
                </div>
                {equipo.length === 0 ? (
                    <p className="text-xs text-texto-suave">Sin equipamiento asignado.</p>
                ) : (
                    <div className="overflow-x-auto rounded-control border border-borde">
                        <table className="min-w-full divide-y divide-borde text-left text-xs">
                            <thead className="bg-slate-50 font-semibold text-texto-suave">
                                <tr>
                                    <th className="px-3 py-2">Artículo</th>
                                    <th className="px-3 py-2">Regla</th>
                                    <th className="px-3 py-2 text-right">
                                        Necesita para {pasajerosConfirmados}{" "}
                                        {pasajerosConfirmados === 1 ? "pasajero" : "pasajeros"}
                                    </th>
                                    <th className="px-3 py-2 text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde bg-white">
                                {equipo.map((item) => (
                                    <tr key={item.idservicio}>
                                        <td className="px-3 py-2 font-semibold text-texto">
                                            {item.nombreServicio}
                                        </td>
                                        <td className="px-3 py-2 text-texto-suave">
                                            {item.cadaPasajeros
                                                ? `${item.cantidad} cada ${item.cadaPasajeros} pax`
                                                : `${item.cantidad} por salida`}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {item.necesita}
                                            {/* Solo se separan si se cambió a mano en logística */}
                                            {item.ocupado !== item.necesita ? (
                                                <span className="block text-[11px] text-texto-suave">
                                                    reservados {item.ocupado}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td
                                            className={`px-3 py-2 text-right font-bold ${
                                                item.falta > 0
                                                    ? "text-peligro"
                                                    : "text-emerald-700"
                                            }`}
                                        >
                                            {item.falta > 0 ? (
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <span>
                                                        Faltan {item.falta}
                                                        {item.fechaFalta
                                                            ? ` (stock el ${formatearFechaUtcCorta(item.fechaFalta)})`
                                                            : ""}
                                                    </span>
                                                    <Link
                                                        to={
                                                            item.idproveedor
                                                                ? `/gestion/proveedores/${item.idproveedor}/servicios`
                                                                : "/gestion/proveedores"
                                                        }
                                                        className="rounded border border-marca/40 bg-marca/10 px-2 py-0.5 text-[11px] font-semibold text-marca-oscura transition hover:bg-marca/20"
                                                    >
                                                        Ver proveedor →
                                                    </Link>
                                                </div>
                                            ) : (
                                                "OK"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-borde pt-4">
                {onRecargarDatos ? (
                    <Boton
                        type="button"
                        variante="fantasma"
                        className="text-xs"
                        onClick={onRecargarDatos}
                        cargando={recargando}
                        disabled={guardando || recargando}
                    >
                        Actualizar panel
                    </Boton>
                ) : null}
                <Boton
                    type="button"
                    variante="secundario"
                    onClick={onCancelar}
                    disabled={guardando}
                >
                    Cerrar
                </Boton>
                <Boton
                    type="button"
                    variante="principal"
                    cargando={guardando}
                    disabled={!habilitarConfirmacion || guardando}
                    onClick={manejarConfirmarClick}
                >
                    Confirmar salida
                </Boton>
            </div>
        </section>
    );
}

export default FormularioAsignarRecursos;
