import { Link } from "react-router-dom";
import Modal from "./Modal";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaHora,
} from "../services/guiaService";
import { formatearMonto, formatearRangoFechasUtc } from "../services/formato";
import {
    diasFinalizadaAntes,
    dotacionDeSalida,
    nombresGuiasDeSalida,
    type Salida,
} from "../services/salidaService";

export type AlertaSalidaVisual = {
    clave: string;
    etiqueta: string;
    mensaje?: string;
    severidad: "critica" | "advertencia" | "info";
    enlace?: { to: string; texto: string };
};

type AccionDetalle = {
    id: string;
    etiqueta: string;
    variante?: "principal" | "secundario" | "peligro";
    onClick: () => void;
};

type ModalDetalleSalidaProps = {
    salida: Salida;
    alertas: AlertaSalidaVisual[];
    acciones: AccionDetalle[];
    onCerrar: () => void;
};

function ModalDetalleSalida({
    salida,
    alertas,
    acciones,
    onCerrar,
}: ModalDetalleSalidaProps) {
    const confirmados = salida.pasajerosConfirmados ?? 0;
    const maximo = salida.tamanoMaximo || 1;
    const porcentaje = Math.min(100, Math.round((confirmados / maximo) * 100));

    const dotacion = dotacionDeSalida(salida);
    const totalPersonal = salida.cantidadPersonal ?? dotacion.total;
    const guias =
        Array.isArray(salida.guias) && salida.guias.length > 0
            ? salida.guias
            : nombresGuiasDeSalida(salida);

    const informada = salida.etapaInformada ?? salida.ultimaEtapaAlcanzada;
    const esperada = salida.etapaEsperada;
    const etapas = salida.paquete?.circuito?.etapas ?? [];
    const llegoA = etapas.find((e) => e.numeroOrden === informada);
    const tramoHoy = etapas.find((e) => e.numeroOrden === esperada);

    const diasAntes = diasFinalizadaAntes(salida);

    const horasPrimerAvance =
        salida.fechaHoraInicioReal && salida.primerAvance
            ? Math.max(
                  0,
                  Math.round(
                      (new Date(salida.primerAvance).getTime() -
                          new Date(salida.fechaHoraInicioReal).getTime()) /
                          36e5,
                  ),
              )
            : null;

    return (
        <Modal
            onCerrar={onCerrar}
            etiqueta={`Detalle de la salida ${salida.nroSalida}`}
            tamano="lg"
        >
            {/* CABECERA */}
            <div className="flex items-start justify-between gap-4 border-b border-borde/80 bg-white px-6 py-5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-navegacion px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                            {salida.nroSalida}
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(salida.estado)}`}
                        >
                            {formatearEstadoSalida(salida.estado)}
                        </span>
                        {salida.idbloqueo ? (
                            <span className="rounded-full bg-fondo px-2.5 py-0.5 font-mono text-[11px] font-medium text-texto-suave ring-1 ring-borde/70">
                                Bloqueo {salida.idbloqueo}
                            </span>
                        ) : null}
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-navegacion">
                        {salida.paquete?.nombrePaquete ?? "Paquete sin nombre"}
                    </h2>
                    <p className="mt-0.5 text-xs text-texto-suave">
                        {formatearRangoFechasUtc(salida.fechaInicio, salida.fechaFin)}
                        {salida.paquete?.nroPaquete
                            ? ` · ${salida.paquete.nroPaquete}`
                            : ""}
                    </p>
                    {salida.precioPorPasajero ? (
                        <p className="mt-1 text-sm text-texto">
                            Precio congelado:{" "}
                            <strong className="text-navegacion">
                                {formatearMonto(salida.precioPorPasajero.monto, salida.precioPorPasajero.moneda)} / pasajero
                            </strong>{" "}
                            <span className="text-texto-suave">({salida.precioPorPasajero.temporada})</span>
                            {" · "}Vendido:{" "}
                            <strong className="text-navegacion">
                                {formatearMonto(salida.totalVendido ?? 0, salida.precioPorPasajero.moneda)}
                            </strong>
                        </p>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar detalle"
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-borde bg-white text-sm font-semibold text-texto-suave transition hover:bg-fondo hover:text-navegacion"
                >
                    ✕
                </button>
            </div>

            {/* CUERPO */}
            <div className="space-y-5 p-6">
                {/* 3 TARJETAS DE RESUMEN */}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-borde/80 bg-fondo/50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Ocupación
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-navegacion">
                            {confirmados}{" "}
                            <span className="text-sm font-normal text-texto-suave">
                                / {salida.tamanoMaximo} pax
                            </span>
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-borde/60">
                            <div
                                className={`h-full rounded-full ${
                                    porcentaje >= 100
                                        ? "bg-rose-500"
                                        : porcentaje >= 60
                                          ? "bg-emerald-500"
                                          : porcentaje > 0
                                            ? "bg-amber-500"
                                            : "bg-slate-300"
                                }`}
                                style={{ width: `${porcentaje}%` }}
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-texto-suave">
                            {salida.estado === "PUBLICADA"
                                ? `${porcentaje}% · ${salida.stockLocal} ${salida.stockLocal === 1 ? "libre" : "libres"}`
                                : `${porcentaje}% · Venta cerrada`}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-borde/80 bg-fondo/50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Dotación asignada
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-navegacion">
                            {totalPersonal}{" "}
                            <span className="text-sm font-normal text-texto-suave">
                                {totalPersonal === 1 ? "persona" : "personas"}
                            </span>
                        </p>
                        <p className="mt-1.5 text-xs text-texto-suave">
                            {dotacion.total > 0
                                ? `${dotacion.guias} ${dotacion.guias === 1 ? "guía" : "guías"} · ${dotacion.porteadores} ${dotacion.porteadores === 1 ? "porteador" : "porteadores"}`
                                : "Sin personal asignado todavía"}
                        </p>
                        {guias.length > 0 ? (
                            <p className="mt-1 text-xs font-medium text-navegacion">
                                {guias.join(", ")}
                            </p>
                        ) : null}
                    </div>

                    <div className="rounded-2xl border border-borde/80 bg-fondo/50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Seguimiento real
                        </p>
                        {salida.estado === "EN_CURSO" ? (
                            <div className="mt-1 space-y-1 text-xs">
                                <p className="text-base font-bold text-navegacion">
                                    {informada !== null
                                        ? `Etapa ${informada}${etapas.length > 0 ? ` de ${etapas.length}` : ""}`
                                        : "Iniciada"}
                                </p>
                                <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        salida.etapaDesfasada
                                            ? "bg-amber-100 text-amber-900"
                                            : "bg-emerald-100 text-emerald-800"
                                    }`}
                                >
                                    {salida.etapaDesfasada
                                        ? `Desfasada (esperada: etapa ${esperada})`
                                        : "Al día"}
                                </span>
                            </div>
                        ) : salida.fechaHoraInicioReal || salida.fechaHoraFinReal ? (
                            <div className="mt-1 space-y-1 text-xs text-texto">
                                {salida.fechaHoraInicioReal ? (
                                    <p>
                                        Inició:{" "}
                                        <strong>
                                            {formatearFechaHora(salida.fechaHoraInicioReal)}
                                        </strong>
                                    </p>
                                ) : null}
                                {salida.fechaHoraFinReal ? (
                                    <p>
                                        Finalizó:{" "}
                                        <strong>
                                            {formatearFechaHora(salida.fechaHoraFinReal)}
                                        </strong>
                                    </p>
                                ) : null}
                                {diasAntes > 0 ? (
                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                        Finalizó {diasAntes}{" "}
                                        {diasAntes === 1 ? "día" : "días"} antes
                                    </span>
                                ) : null}
                            </div>
                        ) : (
                            <p className="mt-1.5 text-xs text-texto-suave">
                                Aún sin inicio registrado en campo.
                            </p>
                        )}
                        {horasPrimerAvance !== null ? (
                            <p className="mt-1 text-[11px] text-texto-suave">
                                1er avance a las {horasPrimerAvance} h
                            </p>
                        ) : null}
                    </div>
                </div>

                {/* TRAMO ACTUAL SI ESTÁ EN CURSO */}
                {salida.estado === "EN_CURSO" && (llegoA || tramoHoy) ? (
                    <div className="rounded-2xl border border-borde/80 bg-white p-4 text-xs">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                            Ubicación del recorrido
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {llegoA ? (
                                <div className="rounded-xl bg-fondo/60 px-3 py-2">
                                    <span className="text-texto-suave">
                                        Último punto informado:
                                    </span>{" "}
                                    <strong className="text-navegacion">
                                        {llegoA.puntoFin}
                                    </strong>
                                </div>
                            ) : null}
                            {tramoHoy ? (
                                <div className="rounded-xl bg-fondo/60 px-3 py-2">
                                    <span className="text-texto-suave">
                                        Tramo previsto hoy:
                                    </span>{" "}
                                    <strong className="text-navegacion">
                                        {tramoHoy.puntoInicio} → {tramoHoy.puntoFin}
                                    </strong>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* ALERTAS Y PENDIENTES */}
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                            Alertas y controles operativos
                        </p>
                        {alertas.length === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-exito">
                                ✓ Sin pendientes
                            </span>
                        ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                {alertas.length}{" "}
                                {alertas.length === 1 ? "aviso" : "avisos"}
                            </span>
                        )}
                    </div>

                    {alertas.length === 0 ? (
                        <p className="rounded-xl border border-borde/70 bg-fondo/40 px-4 py-3 text-xs text-texto-suave">
                            Esta salida no registra alertas operativas, permisos faltantes ni solicitudes pendientes.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {alertas.map((alerta) => (
                                <li
                                    key={alerta.clave}
                                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                                        alerta.severidad === "critica"
                                            ? "border-rose-200 bg-rose-50/70 text-rose-950"
                                            : alerta.severidad === "advertencia"
                                              ? "border-amber-200 bg-amber-50/70 text-amber-950"
                                              : "border-sky-200 bg-sky-50/70 text-sky-950"
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold">{alerta.etiqueta}</p>
                                        {alerta.mensaje &&
                                        alerta.mensaje !== alerta.etiqueta ? (
                                            <p className="mt-0.5 opacity-85">
                                                {alerta.mensaje}
                                            </p>
                                        ) : null}
                                    </div>
                                    {alerta.enlace ? (
                                        <Link
                                            to={alerta.enlace.to}
                                            onClick={onCerrar}
                                            className="shrink-0 font-bold underline"
                                        >
                                            {alerta.enlace.texto} →
                                        </Link>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* PIE CON ACCIONES RÁPIDAS */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde/80 bg-fondo/40 px-6 py-4">
                <button
                    type="button"
                    onClick={onCerrar}
                    className="cursor-pointer rounded-xl border border-borde bg-white px-4 py-2 text-xs font-semibold text-navegacion transition hover:bg-fondo"
                >
                    Cerrar
                </button>

                {acciones.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {acciones.map((acc) => (
                            <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                    onCerrar();
                                    acc.onClick();
                                }}
                                className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                    acc.variante === "principal"
                                        ? "bg-gradient-to-r from-navegacion to-marca-oscura text-white shadow-xs hover:brightness-110"
                                        : acc.variante === "peligro"
                                          ? "border border-rose-200 bg-rose-50 text-peligro hover:bg-rose-100"
                                          : "border border-borde bg-white text-navegacion hover:bg-fondo"
                                }`}
                            >
                                {acc.etiqueta}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}

export default ModalDetalleSalida;
