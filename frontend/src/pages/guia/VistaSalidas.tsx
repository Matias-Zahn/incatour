import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaSalida,
    type DetalleSalidaGuia,
    type SalidaGuiaResumen,
} from "../../services/guiaService";
import {
    IconoBolsaDormir,
    IconoCalendario,
    IconoCarpa,
    IconoCerrar,
    IconoCocina,
    IconoMapaPlegado,
    IconoMontana,
    IconoReloj,
} from "./IconosGuia";
import Boton from "../../components/Boton";

type VistaSalidasProps = {
    salidaActual: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
    salidas: SalidaGuiaResumen[];
    onSeleccionarSalida: (idsalida: number) => void;
    cargando: boolean;
};

export function VistaSalidas({
    salidaActual,
    detalleSalida,
    salidas,
    onSeleccionarSalida,
    cargando,
}: VistaSalidasProps) {
    const navegar = useNavigate();
    const [vistaModo, setVistaModo] = useState<"lista" | "detalle">("lista");
    const [modalNominaAbierto, setModalNominaAbierto] = useState(false);

    const salidaInfo = detalleSalida?.salida ?? salidaActual;
    const nomina = detalleSalida?.nomina ?? [];
    const equipamiento = detalleSalida?.equipamiento ?? [];
    const personal = detalleSalida?.personal ?? [];

    return (
        <section aria-label="Información de la salida asignada" className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Portal del guía
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-navegacion md:text-3xl">
                        Mis salidas asignadas
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Consulta y gestiona las salidas en las que estás designado como guía
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setVistaModo("lista")}
                        className={`rounded-control px-3.5 py-1.5 text-xs font-bold transition ${
                            vistaModo === "lista"
                                ? "bg-navegacion text-white shadow-xs"
                                : "border border-borde bg-white text-texto hover:bg-slate-50"
                        }`}
                    >
                        Listado de salidas ({salidas.length})
                    </button>
                    {salidaActual ? (
                        <button
                            type="button"
                            onClick={() => setVistaModo("detalle")}
                            className={`rounded-control px-3.5 py-1.5 text-xs font-bold transition ${
                                vistaModo === "detalle"
                                    ? "bg-navegacion text-white shadow-xs"
                                    : "border border-borde bg-white text-texto hover:bg-slate-50"
                            }`}
                        >
                            Detalle ({salidaActual.nroSalida})
                        </button>
                    ) : null}
                </div>
            </header>

            {cargando ? (
                <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-sm text-texto-suave shadow-tarjeta">
                    Cargando información de las salidas asignadas...
                </div>
            ) : salidas.length === 0 ? (
                <div className="rounded-tarjeta border border-borde bg-white p-8 text-center shadow-tarjeta">
                    <p className="text-base font-bold text-navegacion">No tienes salidas asignadas</p>
                    <p className="mt-1 text-xs text-texto-suave">
                        Cuando el administrador te asigne a un grupo o salida programada, aparecerá listada en esta sección.
                    </p>
                </div>
            ) : vistaModo === "lista" ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-texto-suave">
                        <span>Tienes <b>{salidas.length}</b> salida(s) asignada(s) en tu perfil:</span>
                        <span>Selecciona una para consultar su detalle u operar</span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {salidas.map((s) => {
                            const esActiva = s.idsalida === salidaActual?.idsalida;
                            return (
                                <article
                                    key={s.idsalida}
                                    className={`flex flex-col justify-between rounded-tarjeta border bg-white p-5 shadow-tarjeta transition ${
                                        esActiva
                                            ? "border-l-4 border-l-[#16d6dc] border-y border-r ring-2 ring-marca/20"
                                            : "border-borde hover:border-marca/50"
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 border-b border-borde/60 pb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-base font-bold text-navegacion">
                                                    {s.nroSalida}
                                                </span>
                                                {esActiva ? (
                                                    <span className="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                                                        Salida activa
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${estilosEstadoSalida(
                                                    s.estado,
                                                )}`}
                                            >
                                                {formatearEstadoSalida(s.estado)}
                                            </span>
                                        </div>

                                        <div className="mt-4 space-y-2.5 text-xs text-texto">
                                            <div>
                                                <p className="text-sm font-bold text-navegacion">
                                                    {s.circuito}
                                                </p>
                                                <p className="text-[11px] text-texto-suave">
                                                    Paquete: {s.paquete}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 pt-1 text-texto-suave">
                                                <IconoCalendario tamano={15} />
                                                <span>
                                                    <b>Inicio:</b> {formatearFechaSalida(s.fechaInicio)} — <b>Fin:</b> {formatearFechaSalida(s.fechaFin)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-texto-suave">
                                                <IconoMontana tamano={15} />
                                                <span>
                                                    Pasajeros confirmados: <b>{s.pasajeros}</b>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-borde/50 pt-3">
                                        <Boton
                                            variante="principal"
                                            className="flex-1 text-xs py-1.5"
                                            onClick={() => {
                                                onSeleccionarSalida(s.idsalida);
                                                setVistaModo("detalle");
                                            }}
                                        >
                                            Consultar detalle
                                        </Boton>
                                        <Boton
                                            variante="secundario"
                                            className="text-xs py-1.5"
                                            onClick={() => {
                                                onSeleccionarSalida(s.idsalida);
                                                navegar("/guia/novedades", { replace: true });
                                            }}
                                        >
                                            Avances
                                        </Boton>
                                        <Boton
                                            variante="secundario"
                                            className="text-xs py-1.5"
                                            onClick={() => {
                                                onSeleccionarSalida(s.idsalida);
                                                navegar("/guia/incidentes", { replace: true });
                                            }}
                                        >
                                            Incidentes
                                        </Boton>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            ) : salidaInfo ? (
                <>
                    {/* Botón Volver al Listado */}
                    <div className="flex items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => setVistaModo("lista")}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-marca hover:underline"
                        >
                            ← Volver al listado de salidas
                        </button>
                        <div className="flex items-center gap-2">
                            <Boton
                                variante="secundario"
                                className="text-xs py-1"
                                onClick={() => navegar("/guia/novedades", { replace: true })}
                            >
                                Registrar avances de esta salida →
                            </Boton>
                        </div>
                    </div>

                    {/* Banner de Salida Actual */}
                    <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-l-4 border-l-[#16d6dc] border-y border-r border-borde bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr_auto]">
                        <div className="grid size-12 place-items-center rounded-xl bg-[#1b9fc7] text-white">
                            <IconoMontana tamano={24} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-navegacion">
                                Salida {salidaInfo.nroSalida}
                            </h2>
                            <p className="text-xs text-texto-suave">
                                {salidaInfo.circuito}{" "}
                                {salidaInfo.paquete ? `· ${salidaInfo.paquete}` : ""}
                            </p>
                        </div>
                        <div>
                            <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${estilosEstadoSalida(
                                    salidaInfo.estado,
                                )}`}
                            >
                                {formatearEstadoSalida(salidaInfo.estado)}
                            </span>
                        </div>
                    </article>

                    {/* Grilla principal de 3 paneles */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {/* Panel 1: Detalles de la salida */}
                        <article className="flex flex-col justify-between rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                            <div>
                                <h2 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                                    Detalles de la salida
                                </h2>
                                <div className="mt-4 space-y-3.5 text-xs text-texto">
                                    <div className="flex items-center gap-3">
                                        <span className="text-marca">
                                            <IconoMapaPlegado tamano={18} />
                                        </span>
                                        <span>
                                            <b>Circuito:</b> {salidaInfo.circuito}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-marca">
                                            <IconoReloj tamano={18} />
                                        </span>
                                        <span>
                                            <b>Estado:</b> {formatearEstadoSalida(salidaInfo.estado)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-marca">
                                            <IconoCalendario tamano={18} />
                                        </span>
                                        <span>
                                            <b>Inicio:</b> {formatearFechaSalida(salidaInfo.fechaInicio)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-marca">
                                            <IconoCalendario tamano={18} />
                                        </span>
                                        <span>
                                            <b>Duración:</b> {detalleSalida?.salida.duracionDias ?? 4} días
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {personal.length > 0 ? (
                                <div className="mt-5 border-t border-borde/50 pt-3 text-xs">
                                    <p className="font-semibold text-texto-suave">
                                        Personal asignado:
                                    </p>
                                    <div className="mt-1 space-y-1">
                                        {personal.map((p) => (
                                            <p key={p.idpersonal} className="text-texto">
                                                • {p.nombreCompleto} ({p.rol})
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </article>

                        {/* Panel 2: Nómina de pasajeros */}
                        <article className="flex flex-col justify-between rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                            <div>
                                <h2 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                                    Nómina de pasajeros
                                </h2>
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-left text-xs" aria-label="Nómina de pasajeros de la salida">
                                        <thead>
                                            <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                                <th className="py-2">ID/Pasaporte</th>
                                                <th className="py-2">Nombre completo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-borde/50">
                                            {nomina.slice(0, 4).map((p) => (
                                                <tr key={p.idpasajero}>
                                                    <td className="py-2 font-medium text-texto">
                                                        {p.nroPasaporte}
                                                    </td>
                                                    <td className="py-2 text-texto">
                                                        {p.nombreCompleto}
                                                    </td>
                                                </tr>
                                            ))}
                                            {nomina.length === 0 ? (
                                                <tr>
                                                    <td colSpan={2} className="py-4 text-center text-xs text-texto-suave">
                                                        No hay pasajeros registrados
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-borde/50 pt-3 text-xs">
                                <span className="font-bold text-texto">
                                    Total pasajeros: {nomina.length}
                                </span>
                                {nomina.length > 4 ? (
                                    <button
                                        type="button"
                                        onClick={() => setModalNominaAbierto(true)}
                                        className="font-bold text-marca hover:underline"
                                    >
                                        Ver nómina completa ({nomina.length})
                                    </button>
                                ) : null}
                            </div>
                        </article>

                        {/* Panel 3: Equipamiento asignado */}
                        <article className="flex flex-col justify-between rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                            <div>
                                <h2 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                                    Equipamiento asignado
                                </h2>
                                <div className="mt-4 space-y-4">
                                    {equipamiento.length > 0 ? (
                                        equipamiento.map((item, idx) => {
                                            const nombreMinuscula = (
                                                item.nombreServicio + (item.tipoEquipamiento ?? "")
                                            ).toLowerCase();
                                            const icono = nombreMinuscula.includes("carpa") ? (
                                                <IconoCarpa />
                                            ) : nombreMinuscula.includes("bolsa") ||
                                              nombreMinuscula.includes("dormir") ? (
                                                <IconoBolsaDormir />
                                            ) : (
                                                <IconoCocina />
                                            );

                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-3 text-xs text-texto"
                                                >
                                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#1b9fc7]">
                                                        {icono}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="font-bold">
                                                            {item.tipoEquipamiento ?? item.nombreServicio}
                                                        </p>
                                                        <p className="text-[11px] text-texto-suave">
                                                            Cantidad: {item.cantidad}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-texto-suave">
                                            No hay equipamiento registrado.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>
                    </div>

                    {/* Itinerario tramo a tramo (CU-48) */}
                    {detalleSalida?.itinerario && detalleSalida.itinerario.length > 0 ? (
                        <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                            <h2 className="border-b border-borde/70 pb-3 text-sm font-bold text-navegacion">
                                Itinerario tramo a tramo del circuito
                            </h2>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                {detalleSalida.itinerario.map((etapa) => (
                                    <div
                                        key={etapa.numeroOrden}
                                        className="rounded-xl border border-borde/80 bg-fondo p-3 text-xs"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-marca">
                                                Etapa {etapa.numeroOrden}
                                            </span>
                                            {etapa.estadoTramo ? (
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        etapa.estadoTramo === "COMPLETADO"
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : "bg-amber-100 text-amber-800"
                                                    }`}
                                                >
                                                    {formatearEstadoSalida(etapa.estadoTramo)}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                    Pendiente
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 font-bold text-texto">
                                            {etapa.puntoInicio} → {etapa.puntoFin}
                                        </p>
                                        {etapa.campamentoPrevisto ? (
                                            <p className="mt-1 text-[11px] text-texto-suave">
                                                Campamento: {etapa.campamentoPrevisto}
                                            </p>
                                        ) : null}
                                        {etapa.fechaHoraLlegada ? (
                                            <p className="mt-1 text-[11px] text-texto-suave">
                                                Llegada:{" "}
                                                {new Date(etapa.fechaHoraLlegada).toLocaleString("es-ES")}
                                            </p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </article>
                    ) : null}
                </>
            ) : (
                <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-sm text-texto-suave shadow-tarjeta">
                    No hay información de salida disponible.
                </div>
            )}

            {/* Modal Nómina Completa de Pasajeros */}
            {modalNominaAbierto ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setModalNominaAbierto(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Nómina completa de pasajeros"
                        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-tarjeta bg-white p-6 shadow-tarjeta"
                    >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    {salidaInfo?.nroSalida ?? "Salida actual"}
                                </p>
                                <h2 className="text-lg font-bold text-navegacion">
                                    Nómina completa de pasajeros
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalNominaAbierto(false)}
                                className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
                            >
                                <IconoCerrar tamano={20} />
                            </button>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                        <th className="py-2.5">ID/Pasaporte</th>
                                        <th className="py-2.5">Nombre completo</th>
                                        <th className="py-2.5">Nacionalidad</th>
                                        <th className="py-2.5">Contacto de emergencia (Titular)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-borde/50">
                                    {nomina.map((p) => (
                                        <tr key={p.idpasajero}>
                                            <td className="py-2.5 font-medium text-texto">
                                                {p.nroPasaporte}
                                            </td>
                                            <td className="py-2.5 text-texto">
                                                {p.nombreCompleto}
                                            </td>
                                            <td className="py-2.5 text-texto-suave">
                                                {p.nacionalidad ?? "No especificada"}
                                            </td>
                                            <td className="py-2.5 text-texto-suave">
                                                {p.contacto
                                                    ? `${p.contacto.titular} (${p.contacto.email})`
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                    {nomina.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-xs text-texto-suave">
                                                No hay pasajeros registrados
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Boton
                                variante="principal"
                                onClick={() => setModalNominaAbierto(false)}
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
