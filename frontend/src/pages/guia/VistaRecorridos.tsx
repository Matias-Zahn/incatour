import type { DetalleSalidaGuia } from "../../services/guiaService";
import { IconoMapa, IconoMontana } from "./IconosGuia";

type VistaRecorridosProps = {
    detalleSalida: DetalleSalidaGuia | null;
};

export function VistaRecorridos({ detalleSalida }: VistaRecorridosProps) {
    const itinerario = detalleSalida?.itinerario ?? [];

    return (
        <section aria-label="Recorridos y orientación en terreno" className="space-y-6">
            <header className="border-b border-borde/60 pb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                    Orientación en terreno
                </p>
                <h1 className="mt-1 text-2xl font-bold text-navegacion md:text-3xl">
                    Recorridos y Cartografía Operativa
                </h1>
                <p className="text-sm text-texto-suave">
                    Visualiza información clave de las rutas hacia Machu Picchu, puntos de encuentro y tramos operativos.
                </p>
            </header>

            {/* Banner visual con gradiente andino */}
            <article className="overflow-hidden rounded-tarjeta bg-gradient-to-r from-[#07395d] to-[#148ba8] p-7 text-white shadow-tarjeta">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <span className="inline-block rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-200">
                            Ruta activa: {detalleSalida?.salida.circuito ?? "Camino del Inca Clásico"}
                        </span>
                        <h2 className="text-2xl font-bold text-white">
                            Itinerario de Montaña
                        </h2>
                        <p className="max-w-xl text-xs leading-relaxed text-cyan-100">
                            Supervisa los puntos de control, altimetría estimada y campamentos previstos.
                            Recuerda que en los tramos de altura entre Pacaymayo y Phuyupatamarca la cobertura
                            celular es nula: registra los avances para que queden guardados en tu dispositivo
                            y se sincronicen automáticamente al retomar señal.
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
                                                {etapa.estadoTramo ?? "Pendiente"}
                                            </span>
                                        </div>
                                        {etapa.campamentoPrevisto ? (
                                            <p className="mt-1 text-xs text-texto-suave">
                                                🏕 Campamento previsto: <b>{etapa.campamentoPrevisto}</b>
                                            </p>
                                        ) : null}
                                        {etapa.fechaHoraLlegada ? (
                                            <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                                                Llegada registrada: {new Date(etapa.fechaHoraLlegada).toLocaleString("es-ES")}
                                            </p>
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

                {/* Protocolo de seguridad y radiofrecuencia */}
                <article className="space-y-4">
                    <div className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                        <h3 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                            Puntos de Control & Rescate
                        </h3>
                        <ul className="mt-3 space-y-2.5 text-xs text-texto">
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-marca">•</span>
                                <span><b>Km 82 (Piscacucho):</b> Registro oficial del SERNANP y control de pasaportes.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-marca">•</span>
                                <span><b>Wayllabamba:</b> Último poblado con suministro y primeros auxilios básicos.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-marca">•</span>
                                <span><b>Paso Warmiwañusqa (4.215 msnm):</b> Punto crítico de aclimatación.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-marca">•</span>
                                <span><b>Wiñay Wayna:</b> Puesto de guardaparques con radio UHF de emergencia.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="rounded-tarjeta border border-cyan-200 bg-cyan-50/70 p-5 shadow-xs">
                        <div className="flex items-center gap-2 text-cyan-900 font-bold text-xs">
                            <IconoMapa tamano={18} />
                            <span>Recomendación Operativa</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-cyan-950">
                            Mantén el grupo compacto en las bajadas con escalinatas incas de piedra mojada. Ante mal de montaña o traumatismo, utiliza la pantalla de <b>Incidentes (CU-50)</b> para reportar el suceso al equipo de administración.
                        </p>
                    </div>
                </article>
            </div>
        </section>
    );
}
