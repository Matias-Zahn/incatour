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
                                    : `Capacidad total: ${data.total} ${servicio.tipo === "ALOJAMIENTO" ? "plazas" : servicio.tipo === "TRANSPORTE" ? "vehículo" : "unidades"}.`
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
                ) : data ? (
                    <div className="space-y-5">
                        {/* Tabla día por día */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-navegacion">
                                Disponibilidad diaria ({data.dias.length} días)
                            </h3>
                            <div className="max-h-64 overflow-y-auto rounded-control border border-borde">
                                <table className="min-w-full divide-y divide-borde text-left text-xs">
                                    <thead className="sticky top-0 bg-slate-50 font-semibold text-texto-suave">
                                        <tr>
                                            <th className="px-3 py-2">Día</th>
                                            <th className="px-3 py-2 text-right">Ocupado</th>
                                            <th className="px-3 py-2 text-right">Disponible</th>
                                            <th className="px-3 py-2">Salidas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-borde bg-white">
                                        {data.dias.map((dia) => {
                                            const salidasDia = salidasPorDia(dia.fecha);
                                            const deficit =
                                                dia.disponible !== null && dia.disponible < 0;
                                            return (
                                                <tr
                                                    key={dia.fecha}
                                                    className={deficit ? "bg-rose-50/70" : undefined}
                                                >
                                                    <td className="px-3 py-1.5 font-medium text-texto whitespace-nowrap">
                                                        {formatearFechaUtcCorta(dia.fecha)}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-semibold">
                                                        {dia.ocupado}
                                                    </td>
                                                    <td
                                                        className={`px-3 py-1.5 text-right font-bold ${
                                                            deficit
                                                                ? "text-peligro"
                                                                : "text-emerald-700"
                                                        }`}
                                                    >
                                                        {dia.disponible === null
                                                            ? "A solicitud"
                                                            : deficit
                                                              ? `${dia.disponible} (faltan ${Math.abs(dia.disponible)})`
                                                              : dia.disponible}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-texto-suave">
                                                        {salidasDia.length > 0
                                                            ? salidasDia
                                                                  .map(
                                                                      (s) =>
                                                                          `${s.nroSalida} (${s.cantidad})`,
                                                                  )
                                                                  .join(", ")
                                                            : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
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
