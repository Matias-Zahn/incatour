import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "./Alerta";
import Boton from "./Boton";
import Modal from "./Modal";
import {
    formatearFechaUtcCorta,
    formatearRangoFechasUtc,
} from "../services/formato";
import { formatearEstadoSalida } from "../services/guiaService";
import {
    useOcupacionServicio,
    type Servicio,
} from "../services/servicioService";

type ModalOcupacionServicioProps = {
    servicio: Servicio;
    onCerrar: () => void;
};

function isoHoyLocal(): string {
    const f = new Date();
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function sumarDiasIso(iso: string, dias: number): string {
    const f = new Date(iso + "T12:00:00Z");
    f.setUTCDate(f.getUTCDate() + dias);
    return f.toISOString().slice(0, 10);
}

function ModalOcupacionServicio({
    servicio,
    onCerrar,
}: ModalOcupacionServicioProps) {
    const [desde, setDesde] = useState<string>(() => isoHoyLocal());
    const [hasta, setHasta] = useState<string>(() => sumarDiasIso(isoHoyLocal(), 30));

    const rangoInvalido = Boolean(desde && hasta && desde > hasta);
    const { data, isPending, isError, error } = useOcupacionServicio(
        rangoInvalido ? null : servicio.idservicio,
        desde,
        hasta,
    );

    const salidasPorDia = (fecha: string) =>
        (data?.ocupaciones ?? []).filter(
            (o) => o.estadoSalida !== "FINALIZADA" && o.desde <= fecha && fecha <= o.hasta,
        );

    return (
        <Modal
            onCerrar={onCerrar}
            tamano="xl"
            etiqueta={`Ocupación e historial de ${servicio.nombreServicio}`}
        >
            <div className="p-6 space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borde pb-4">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Stock por día e historial
                        </span>
                        <h2 className="text-xl font-bold text-navegacion">
                            {servicio.nombreServicio}
                        </h2>
                        <p className="mt-1 text-xs text-texto-suave">
                            {data
                                ? data.total === null
                                    ? "Modalidad a solicitud (sin tope fijo de plazas)."
                                    : servicio.tipo === "ALOJAMIENTO"
                                      ? `Bloqueo contratado: ${data.total} plazas por noche.`
                                      : `Capacidad total: ${data.total} ${servicio.tipo === "TRANSPORTE" ? "vehículo" : "unidades"}.`
                                : "Consultando ocupación por fecha..."}
                        </p>
                    </div>
                    <Boton variante="secundario" className="px-3 py-1.5 text-xs" onClick={onCerrar}>
                        Cerrar
                    </Boton>
                </header>

                {/* Filtros de fecha */}
                <div className="grid gap-3 sm:grid-cols-2 rounded-control border border-borde bg-fondo/40 p-3.5">
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                        Desde
                        <input
                            type="date"
                            value={desde}
                            onChange={(e) => setDesde(e.target.value)}
                            className="rounded-control border border-borde bg-white px-3 py-1.5 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                        Hasta
                        <input
                            type="date"
                            value={hasta}
                            onChange={(e) => setHasta(e.target.value)}
                            className="rounded-control border border-borde bg-white px-3 py-1.5 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </label>
                </div>

                {rangoInvalido ? (
                    <Alerta tipo="error" titulo="Rango de fechas inválido">
                        La fecha «Desde» no puede ser posterior a «Hasta».
                    </Alerta>
                ) : isPending ? (
                    <p className="py-6 text-center text-sm text-texto-suave">
                        Cargando ocupación diaria...
                    </p>
                ) : isError ? (
                    <Alerta tipo="error" titulo="No se pudo consultar la ocupación">
                        {error?.message}
                    </Alerta>
                ) : data && !data.dias.some((d) => d.ocupado > 0) ? (
                    // ponytail: el bloqueo vale todos los días; con vigencia por fechas (cambio de modelo) esto mostraría solo las contratadas
                    <Alerta titulo="Sin salidas en estas fechas">
                        Ninguna salida usa este servicio entre las fechas elegidas
                        {data.total === null ? "." : `: ${data.total === 1 ? "está libre" : `las ${data.total} ${servicio.tipo === "ALOJAMIENTO" ? "plazas" : "unidades"} están libres`} todos los días.`}{" "}
                        Cambiá el rango para ver otro período.
                    </Alerta>
                ) : data ? (
                    <div className="space-y-5">
                        {/* Calendario: un mes por bloque, el número grande es lo disponible ese día */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="text-sm font-bold text-navegacion">
                                    Disponibles por día
                                </h3>
                                {/* Leyenda de colores: sin números, para que no se lea como un total */}
                                <p className="flex flex-wrap items-center gap-3 text-[11px] text-texto-suave">
                                    {[
                                        ["border-borde bg-white", "Sin salidas"],
                                        ["border-borde bg-fondo/60", "En uso, con disponibles"],
                                        ["border-amber-300 bg-amber-50", "Sin stock"],
                                        ["border-peligro/40 bg-rose-50", "Faltan"],
                                    ].map(([clase, texto]) => (
                                        <span key={texto} className="inline-flex items-center gap-1.5">
                                            <span className={`inline-block h-3 w-3 rounded-sm border ${clase}`} aria-hidden="true" />
                                            {texto}
                                        </span>
                                    ))}
                                </p>
                            </div>
                            {Object.entries(
                                data.dias.reduce<Record<string, typeof data.dias>>((meses, dia) => {
                                    (meses[dia.fecha.slice(0, 7)] ??= []).push(dia);
                                    return meses;
                                }, {}),
                            ).map(([mes, dias]) => {
                                // lunes primero: cuántas celdas vacías van antes del primer día
                                const hueco = (new Date(dias[0].fecha + "T12:00:00Z").getUTCDay() + 6) % 7;
                                return (
                                    <div key={mes}>
                                        <p className="mb-1.5 text-xs font-bold text-navegacion first-letter:uppercase">
                                            {new Date(mes + "-15T12:00:00Z").toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })}
                                        </p>
                                        <div className="grid grid-cols-7 gap-1 text-center">
                                            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                                                <span key={d} className="text-[10px] font-semibold uppercase text-texto-suave">{d}</span>
                                            ))}
                                            {Array.from({ length: hueco }, (_, i) => <span key={`h${i}`} />)}
                                            {dias.map((dia) => {
                                                const salidasDia = salidasPorDia(dia.fecha);
                                                const libre = dia.disponible;
                                                const color =
                                                    libre === null ? "text-texto-suave"
                                                    : libre < 0 ? "text-peligro"
                                                    : libre === 0 ? "text-amber-700"
                                                    : dia.ocupado > 0 ? "text-emerald-700"
                                                    : "text-texto-suave/50"; // sin uso: el bloqueo entero, sin destacar
                                                const fondo =
                                                    libre !== null && libre < 0 ? "border-peligro/40 bg-rose-50"
                                                    : libre === 0 ? "border-amber-300 bg-amber-50"
                                                    : dia.ocupado > 0 ? "border-borde bg-fondo/60"
                                                    : "border-borde bg-white";
                                                const detalle = `${formatearFechaUtcCorta(dia.fecha)}: ${
                                                    libre === null ? "a solicitud" : `${libre} disponibles, ${dia.ocupado} en uso`
                                                }${salidasDia.length ? ` · ${salidasDia.map((s) => `${s.nroSalida} (${s.cantidad})`).join(", ")}` : ""}`;
                                                return (
                                                    <div
                                                        key={dia.fecha}
                                                        title={detalle}
                                                        aria-label={detalle}
                                                        className={`rounded-control border px-1 py-1.5 ${fondo} ${dia.fecha === isoHoyLocal() ? "ring-2 ring-marca/40" : ""}`}
                                                    >
                                                        <p className="text-left text-[10px] text-texto-suave">{Number(dia.fecha.slice(8))}</p>
                                                        <p className={`text-lg font-bold leading-tight ${color}`}>
                                                            {libre === null ? "—" : libre}
                                                        </p>
                                                        <p className="truncate text-[10px] text-texto-suave">
                                                            {salidasDia.length ? salidasDia.map((s) => s.nroSalida.slice(-3)).join(" ") : " "}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Historial de salidas */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-navegacion">
                                Historial de salidas asociadas ({data.ocupaciones.length})
                            </h3>
                            {data.ocupaciones.length === 0 ? (
                                <p className="text-xs text-texto-suave">
                                    No hay salidas registradas para este servicio en el período.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-control border border-borde">
                                    <table className="min-w-full divide-y divide-borde text-left text-xs">
                                        <thead className="bg-slate-50 font-semibold text-texto-suave">
                                            <tr>
                                                <th className="px-3 py-2">Salida</th>
                                                <th className="px-3 py-2">Fechas de uso</th>
                                                <th className="px-3 py-2 text-right">Cantidad</th>
                                                <th className="px-3 py-2">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-borde bg-white">
                                            {data.ocupaciones.map((oc, idx) => (
                                                <tr key={`${oc.nroSalida}-${idx}`}>
                                                    <td className="px-3 py-2 font-bold">
                                                        <Link
                                                            to="/gestion/salidas"
                                                            className="text-marca hover:underline"
                                                        >
                                                            {oc.nroSalida}
                                                        </Link>
                                                    </td>
                                                    <td className="px-3 py-2 text-texto">
                                                        {formatearRangoFechasUtc(oc.desde, oc.hasta)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold">
                                                        {oc.cantidad}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {formatearEstadoSalida(oc.estadoSalida)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}

export default ModalOcupacionServicio;
