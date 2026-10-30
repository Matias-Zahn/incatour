import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaHora,
    formatearFechaSalida,
    type DetalleSalidaGuia,
    type SalidaGuiaResumen,
} from "../../services/guiaService";
import { IconoCalendario, IconoMontana } from "./IconosGuia";

type VistaInicioProps = {
    salidaActual: SalidaGuiaResumen | null;
    proximaSalida: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
    nombreGuia?: string;
    cargando: boolean;
};

export function VistaInicio({
    salidaActual,
    proximaSalida,
    detalleSalida,
    nombreGuia,
    cargando,
}: VistaInicioProps) {
    const etapasTotales = detalleSalida?.itinerario?.length ?? 0;
    const etapasCompletadas =
        detalleSalida?.itinerario?.filter(
            (e) => e.estadoTramo === "COMPLETADO",
        ).length ?? 0;
    const porcentajeProgreso =
        etapasTotales > 0
            ? Math.round((etapasCompletadas / etapasTotales) * 100)
            : 0;

    const pasajerosResumen = detalleSalida?.nomina?.slice(0, 5) ?? [];

    const novedadesReales = (detalleSalida?.itinerario ?? [])
        .filter((e) => e.estadoTramo !== null)
        .map((e) => ({
            id: `etapa_${e.numeroOrden}`,
            titulo: `Etapa ${e.numeroOrden}: ${formatearEstadoSalida(e.estadoTramo)}`,
            subtitulo: `${e.puntoInicio} → ${e.puntoFin}${
                e.fechaHoraLlegada
                    ? ` · Llegada: ${formatearFechaHora(e.fechaHoraLlegada)}`
                    : ""
            }`,
            demorado: e.estadoTramo === "DEMORADO",
        }));

    const proximoTramo = detalleSalida?.itinerario?.find((e) => e.estadoTramo !== "COMPLETADO");
    const sinSalidas = !cargando && !salidaActual && !proximaSalida;

    return (
        <section aria-label="Inicio del Portal del Guía" className="space-y-6">
            <header className="border-b border-borde/60 pb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                    Portal del guía
                </p>
                <h1 className="mt-1 text-2xl font-bold text-navegacion md:text-3xl">
                    {nombreGuia ? `Hola, ${nombreGuia}` : "Hola"}
                </h1>
                <p className="text-sm text-texto-suave">
                    Resumen operativo y próximas actividades
                </p>
            </header>

            {cargando ? (
                <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-sm text-texto-suave shadow-tarjeta">
                    Cargando información operativa...
                </div>
            ) : sinSalidas ? (
                <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-sm text-texto-suave shadow-tarjeta">
                    Todavía no tenés salidas asignadas. Cuando el administrador te asigne una, vas a ver acá el recorrido, los pasajeros y las novedades.
                </div>
            ) : salidaActual ? (
                <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-l-4 border-l-[#16d6dc] border-y border-r border-borde bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr_auto]">
                    <div className="grid size-12 place-items-center rounded-xl bg-[#1b9fc7] text-white">
                        <IconoMontana tamano={24} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-navegacion">
                            Salida actual: {salidaActual.nroSalida}
                        </h2>
                        <p className="text-xs text-texto-suave">
                            {salidaActual.circuito} · {salidaActual.paquete}
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

                    <div className="col-span-full flex flex-wrap items-center justify-between gap-4 border-t border-borde/50 pt-3 md:col-span-full">
                        <div className="flex gap-6 text-xs">
                            <div>
                                <span className="block font-semibold text-texto-suave">
                                    Fecha de inicio
                                </span>
                                <span className="font-bold text-texto">
                                    {formatearFechaSalida(salidaActual.fechaInicio)}
                                </span>
                            </div>
                            <div>
                                <span className="block font-semibold text-texto-suave">
                                    Pasajeros
                                </span>
                                <span className="font-bold text-texto">
                                    {detalleSalida?.nomina.length ?? salidaActual.pasajeros}/
                                    {salidaActual.pasajeros}
                                </span>
                            </div>
                        </div>

                        <div className="w-full md:max-w-xs">
                            <div className="flex justify-between text-[11px] font-semibold text-texto-suave">
                                <span>Avance del circuito</span>
                                <span>{porcentajeProgreso}%</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#16d6dc] to-[#1b9fc7] transition-all"
                                    style={{ width: `${porcentajeProgreso}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </article>
            ) : (
                <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-sm text-texto-suave shadow-tarjeta">
                    No tienes una salida asignada en curso en este momento.
                </div>
            )}

            {sinSalidas ? null : <>
            <div>
                <h2 className="mb-3 text-base font-bold text-navegacion">
                    Panel de actividad rápida
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Salida en curso */}
                    <article className="rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                        <div className="mb-2 grid size-9 place-items-center rounded-lg bg-[#1b9fc7]/15 text-[#1b9fc7]">
                            <IconoMontana tamano={18} />
                        </div>
                        <h3 className="text-sm font-bold text-navegacion">
                            Salida en curso actual
                        </h3>
                        {salidaActual ? (
                            <>
                                <p className="mt-1 text-xs text-texto-suave">
                                    {salidaActual.circuito}
                                </p>
                                <p className="mt-2 text-xs font-semibold text-texto">
                                    {formatearFechaSalida(salidaActual.fechaInicio)} ·{" "}
                                    {salidaActual.pasajeros} pasajeros
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-xs text-texto-suave">
                                No hay salida en curso asignada
                            </p>
                        )}
                    </article>

                    {/* Próxima salida */}
                    <article className="rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                        <div className="mb-2 grid size-9 place-items-center rounded-lg bg-[#1b9fc7]/15 text-[#1b9fc7]">
                            <IconoCalendario tamano={18} />
                        </div>
                        <h3 className="text-sm font-bold text-navegacion">
                            Próxima salida asignada
                        </h3>
                        {proximaSalida ? (
                            <>
                                <p className="mt-1 text-xs text-texto-suave">
                                    {proximaSalida.circuito}{" "}
                                    {proximaSalida.paquete ? `· ${proximaSalida.paquete}` : ""}
                                </p>
                                <p className="mt-2 text-xs font-semibold text-texto">
                                    {formatearFechaSalida(proximaSalida.fechaInicio)}
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-xs text-texto-suave">
                                No hay próximas salidas asignadas
                            </p>
                        )}
                    </article>

                    {/* Recorrido real de la salida */}
                    <article className="rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                        <h3 className="text-sm font-bold text-navegacion">
                            Recorrido
                        </h3>
                        {etapasTotales > 0 ? (
                            <>
                                <p className="mt-1 text-xs text-texto-suave">
                                    {etapasCompletadas} de {etapasTotales} etapas completadas
                                </p>
                                <p className="mt-2 text-xs font-semibold text-texto">
                                    {proximoTramo
                                        ? `Próximo tramo: ${proximoTramo.puntoInicio} → ${proximoTramo.puntoFin}`
                                        : "Recorrido completado"}
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-xs text-texto-suave">
                                Sin tramos para mostrar
                            </p>
                        )}
                    </article>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                {/* Resumen de pasajeros */}
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <h3 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                        Pasajeros y estado
                    </h3>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs" aria-label="Resumen de pasajeros">
                            <thead>
                                <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                    <th className="py-2">ID/Pasaporte</th>
                                    <th className="py-2">Nombre completo</th>
                                    <th className="py-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde/50">
                                {pasajerosResumen.map((p) => (
                                    <tr key={p.idpasajero}>
                                        <td className="py-2.5 font-medium text-texto">
                                            {p.nroPasaporte}
                                        </td>
                                        <td className="py-2.5 text-texto">
                                            {p.nombreCompleto}
                                        </td>
                                        <td className="py-2.5">
                                            <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800">
                                                Confirmada
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {pasajerosResumen.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="py-6 text-center text-xs text-texto-suave"
                                        >
                                            No hay pasajeros registrados para esta salida
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </article>

                {/* Novedades recientes */}
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <h3 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                        Novedades recientes
                    </h3>
                    <div className="mt-3 space-y-3">
                        {novedadesReales.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-start gap-3 border-b border-borde/50 pb-3 last:border-b-0 last:pb-0"
                            >
                                <span
                                    className={`mt-1 size-2.5 shrink-0 rounded-full ${
                                        item.demorado
                                            ? "bg-amber-500 ring-4 ring-amber-100"
                                            : "bg-emerald-500 ring-4 ring-emerald-100"
                                    }`}
                                />
                                <div>
                                    <p className="text-xs font-bold text-navegacion">
                                        {item.titulo}
                                    </p>
                                    <p className="text-[11px] text-texto-suave">
                                        {item.subtitulo}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {novedadesReales.length === 0 ? (
                            <p className="py-6 text-center text-xs text-texto-suave">
                                No hay novedades recientes registradas
                            </p>
                        ) : null}
                    </div>
                </article>
            </div>
            </>}
        </section>
    );
}
