import { useNavigate } from "react-router-dom";
import { formatearEstadoSalida, formatearFechaHora, type DetalleSalidaGuia } from "../../services/guiaService";
import { IconoMapa, IconoMontana } from "./IconosGuia";

type VistaRecorridosProps = {
    detalleSalida: DetalleSalidaGuia | null;
};

export function VistaRecorridos({ detalleSalida }: VistaRecorridosProps) {
    const navegar = useNavigate();
    const itinerario = detalleSalida?.itinerario ?? [];

    return (
        <section aria-label="Recorridos y orientación en terreno" className="space-y-6">
            <header className="border-b border-borde/60 pb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                    Orientación en terreno
                </p>
                <h1 className="mt-1 text-2xl font-bold text-navegacion md:text-3xl">
                    Recorrido de la salida
                </h1>
                <p className="text-sm text-texto-suave">
                    Tramos, campamentos previstos y estado de cada etapa.
                </p>
            </header>

            {/* Banner visual con gradiente andino */}
            <article className="overflow-hidden rounded-tarjeta bg-gradient-to-r from-[#07395d] to-[#148ba8] p-7 text-white shadow-tarjeta">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        {detalleSalida ? (
                            <span className="inline-block rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-200">
                                Ruta activa: {detalleSalida.salida.circuito}
                            </span>
                        ) : null}
                        <h2 className="text-2xl font-bold text-white">
                            Itinerario de Montaña
                        </h2>
                        <p className="max-w-xl text-xs leading-relaxed text-cyan-100">
                            Si te quedás sin señal, registra igual los avances y los incidentes: quedan guardados
                            en tu dispositivo y se envían solos al recuperarla.
                        </p>
                    </div>

                    <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-200 backdrop-blur-xs">
                        <IconoMontana tamano={48} />
                    </div>
                </div>
            </article>

            {/* Tramos y waypoints del recorrido */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <h3 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                        Tramos del Itinerario
                    </h3>
                    <div className="mt-5 space-y-4">
                        {itinerario.length > 0 ? (
                            itinerario.map((etapa) => (
                                <div
                                    key={etapa.numeroOrden}
                                    className="flex items-start gap-4 rounded-xl border border-borde bg-[#f9fcfc] p-4 text-xs"
                                >
                                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1b9fc7] font-bold text-white">
                                        {etapa.numeroOrden}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-bold text-texto text-sm">
                                                {etapa.puntoInicio} → {etapa.puntoFin}
                                            </p>
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                    etapa.estadoTramo === "COMPLETADO"
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : etapa.estadoTramo === "DEMORADO"
                                                          ? "bg-amber-100 text-amber-800"
                                                          : "bg-slate-200 text-slate-700"
                                                }`}
                                            >
                                                {etapa.estadoTramo ? formatearEstadoSalida(etapa.estadoTramo) : "Pendiente"}
                                            </span>
                                        </div>
                                        {etapa.campamentoPrevisto ? (
                                            <p className="mt-1 text-xs text-texto-suave">
                                                🏕 Campamento previsto: <b>{etapa.campamentoPrevisto}</b>
                                            </p>
                                        ) : null}
                                        {etapa.fechaHoraLlegada ? (
                                            <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                                                Llegada registrada: {formatearFechaHora(etapa.fechaHoraLlegada)}
                                            </p>
                                        ) : null}

                                        {etapa.estadoTramo !== "COMPLETADO" ? (
                                            <div className="mt-3 flex items-center justify-between border-t border-borde/50 pt-2.5">
                                                <span className="text-[11px] text-texto-suave">
                                                    {etapa.estadoTramo === "DEMORADO"
                                                        ? "Tramo informado con demora"
                                                        : "Tramo pendiente de registrar"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => navegar("/guia/novedades")}
                                                    className="inline-flex items-center gap-1.5 rounded-control bg-[#1b9fc7] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#148ba8]"
                                                >
                                                    Registrar avance en este tramo →
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-texto-suave">
                                No hay tramos configurados para esta salida.
                            </p>
                        )}
                    </div>
                </article>

                {/* Recomendación */}
                <article className="space-y-4">
                    <div className="rounded-tarjeta border border-cyan-200 bg-cyan-50/70 p-5 shadow-xs">
                        <div className="flex items-center gap-2 text-cyan-900 font-bold text-xs">
                            <IconoMapa tamano={18} />
                            <span>Recomendación Operativa</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-cyan-950">
                            Mantén el grupo compacto en los tramos difíciles. Ante mal de montaña o traumatismo, utiliza la pantalla de <b>Incidentes</b> para reportar el suceso al equipo de administración.
                        </p>
                    </div>
                </article>
            </div>
        </section>
    );
}
