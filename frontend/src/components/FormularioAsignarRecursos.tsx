import { useId } from "react";
import { Link } from "react-router-dom";
import Alerta from "./Alerta";
import Boton from "./Boton";
import {
    etiquetaModalidad,
    formatearFechaUtcCorta,
    formatearRangoFechasUtc,
} from "../services/formato";
import type {
    PanelConfirmacion,
    PayloadConfirmarAsignacion,
} from "../services/salidaService";

export type FormularioAsignarRecursosProps = {
    datos?: PanelConfirmacion | null;
    cargando?: boolean;
    recargando?: boolean;
    guardando?: boolean;
    errorServidor?: string;
    onRecargarDatos?: () => void;
    onConfirmar?: (payload: PayloadConfirmarAsignacion) => void;
    onCancelar?: () => void;
    onAbrirReemplazo?: () => void;
    onAbrirLogistica?: () => void;
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
    onAbrirReemplazo,
    onAbrirLogistica,
}: FormularioAsignarRecursosProps) {
    const idSeccion = useId();

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
    const hayFaltaEquipoOTransporte =
        equipo.some((e) => e.falta > 0) || Boolean(transporte && !transporte.alcanza);

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
                                : puedeConfirmar
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-amber-100 text-amber-900"
                        }`}
                    >
                        {salida.ventaAbierta
                            ? `Venta abierta hasta el ${formatearFechaUtcCorta(salida.ultimoDiaVenta)}`
                            : puedeConfirmar
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

            {!puedeConfirmar && motivoNoConfirmable ? (
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

            {faltantes.length > 0 ? (
                <Alerta tipo="error" titulo="Pendientes que impiden confirmar">
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                        {faltantes.map((item, idx) => (
                            <li key={idx}>{item}</li>
                        ))}
                    </ul>
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
                        {personal.length}
                    </p>
                    <p className="text-texto-suave">
                        Permisos a emitir: {pasajerosConfirmados + personal.length}
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
                    {porteadoresSobrantes === 1 ? "porteador" : "porteadores"} por encima del mínimo requerido para {pasajerosConfirmados} pasajeros. Podés confirmar igual o ajustarlo desde reemplazos.
                </Alerta>
            ) : null}

            {reservasSinAlojamiento.length > 0 ? (
                <Alerta tipo="advertencia" titulo="Alojamientos pendientes de confirmación">
                    <div className="space-y-1.5 text-xs sm:text-sm">
                        <p>
                            Las siguientes reservas todavía tienen el alojamiento pendiente:{" "}
                            <strong>{reservasSinAlojamiento.join(", ")}</strong>.
                        </p>
                        <Link
                            to="/gestion/solicitudes"
                            className="inline-block font-bold underline"
                        >
                            Ir a Solicitudes de alojamiento →
                        </Link>
                    </div>
                </Alerta>
            ) : null}

            {/* Personal */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-navegacion">
                        Personal asignado ({personal.length})
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
            </div>

            {/* Hoteles y Transporte */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-control border border-borde p-4 space-y-2">
                    <h3 className="text-sm font-bold text-navegacion">Hoteles</h3>
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
                                            {etiquetaModalidad(h.modalidadConfirmacion)}
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
                        {transporte && !transporte.alcanza && onAbrirLogistica ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={onAbrirLogistica}
                            >
                                Cambiar en logística
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
                                    <th className="px-3 py-2">Tipo</th>
                                    <th className="px-3 py-2 text-right">Necesita</th>
                                    <th className="px-3 py-2 text-right">Ocupado</th>
                                    <th className="px-3 py-2 text-right">Falta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde bg-white">
                                {equipo.map((item) => (
                                    <tr key={item.idservicio}>
                                        <td className="px-3 py-2 font-semibold text-texto">
                                            {item.nombreServicio}
                                        </td>
                                        <td className="px-3 py-2 text-texto-suave">
                                            {item.tipoEquipamiento}
                                        </td>
                                        <td className="px-3 py-2 text-right">{item.necesita}</td>
                                        <td className="px-3 py-2 text-right">{item.ocupado}</td>
                                        <td
                                            className={`px-3 py-2 text-right font-bold ${
                                                item.falta > 0
                                                    ? "text-peligro"
                                                    : "text-emerald-700"
                                            }`}
                                        >
                                            {item.falta > 0 ? `Faltan ${item.falta}` : "OK"}
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
                    disabled={!puedeConfirmar || guardando}
                    onClick={() => onConfirmar?.({})}
                >
                    Confirmar salida
                </Boton>
            </div>
        </section>
    );
}

export default FormularioAsignarRecursos;
