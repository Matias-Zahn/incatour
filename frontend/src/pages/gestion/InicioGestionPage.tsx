import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import {
    estilosEstadoSalida,
    fechaLocalHoy,
    formatearEstadoSalida,
    formatearFechaSalida,
    useIncidentes,
} from "../../services/guiaService";
import { useSalidas } from "../../services/salidaService";
import { listarSolicitudesPendientes } from "../../services/solicitudService";

const estiloGravedad: Record<string, string> = {
    CRITICO: "bg-peligro text-white",
    MEDIO: "bg-amber-50 text-advertencia",
    BAJO: "bg-marca-activa text-marca-oscura",
};

const fechaHoraLocal = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

function InicioGestionPage() {
    const navigate = useNavigate();
    const salidasQ = useSalidas();
    const solicitudesQ = useQuery({ queryKey: ["solicitudes"], queryFn: listarSolicitudesPendientes });
    const incidentesQ = useIncidentes();

    const salidas = salidasQ.data ?? [];
    const hoy = fechaLocalHoy();
    const futuras = salidas
        .filter(
            (s) =>
                (s.estado === "PUBLICADA" || s.estado === "CERRADA") &&
                s.fechaInicio.slice(0, 10) > hoy,
        )
        .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    const enCurso = salidas.filter((s) => s.estado === "EN_CURSO").length;
    const conAlertas = salidas.filter((s) => s.alertas?.length > 0).length;
    const incidentes = (incidentesQ.data ?? []).slice(0, 5);

    const metricas = [
        { etiqueta: "Salidas programadas", valor: futuras.length, detalle: "Publicadas o cerradas, con fecha futura", cargando: salidasQ.isPending },
        { etiqueta: "Salidas en curso", valor: enCurso, detalle: "En operación hoy", cargando: salidasQ.isPending },
        { etiqueta: "Solicitudes de alojamiento pendientes", valor: solicitudesQ.data?.length, detalle: "Esperan resolución", cargando: solicitudesQ.isPending },
        { etiqueta: "Salidas con alertas", valor: conAlertas, detalle: "Requieren atención", cargando: salidasQ.isPending },
    ];

    return (
        <section className="mx-auto max-w-7xl space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Resumen general
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Buen día, Administrador/a
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Este es el estado de la operación de IncaTour.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/catalogo?vista=admin")}
                    >
                        👁 Ver tienda como cliente
                    </Boton>
                    <Boton onClick={() => navigate("/gestion/paquetes")}>
                        Gestionar paquetes turísticos
                    </Boton>
                </div>
            </header>

            {(salidasQ.isError || solicitudesQ.isError) && (
                <Alerta tipo="error">No se pudieron cargar algunos indicadores del resumen.</Alerta>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricas.map((metrica) => (
                    <article
                        className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta"
                        key={metrica.etiqueta}
                    >
                        <p className="text-sm font-semibold text-texto-suave">{metrica.etiqueta}</p>
                        <p className="mt-3 text-3xl font-bold text-navegacion">
                            {metrica.cargando ? "…" : (metrica.valor ?? "—")}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-texto-suave">{metrica.detalle}</p>
                    </article>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <article className="rounded-tarjeta border border-borde bg-white shadow-tarjeta">
                    <div className="flex items-center justify-between border-b border-borde px-6 py-5">
                        <div>
                            <h2 className="font-bold text-navegacion">Próximas salidas</h2>
                            <p className="mt-1 text-sm text-texto-suave">
                                Las cinco salidas más cercanas
                            </p>
                        </div>
                        <Boton
                            className="px-3 py-1.5 text-xs"
                            variante="fantasma"
                            onClick={() => navigate("/gestion/salidas")}
                        >
                            Ver todas
                        </Boton>
                    </div>

                    {salidasQ.isPending ? (
                        <EstadoListado estado="cargando" />
                    ) : salidasQ.isError ? (
                        <EstadoListado estado="error" mensaje="No se pudieron cargar las salidas." />
                    ) : futuras.length === 0 ? (
                        <EstadoListado estado="vacio" mensaje="No hay salidas próximas programadas." />
                    ) : (
                        <div className="divide-y divide-borde">
                            {futuras.slice(0, 5).map((salida) => (
                                <div
                                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                                    key={salida.idsalida}
                                >
                                    <div>
                                        <p className="text-sm font-bold text-texto">
                                            {salida.paquete.circuito.nombreCircuito}
                                        </p>
                                        <p className="mt-1 text-xs text-texto-suave">
                                            {salida.paquete.nombrePaquete} · {salida.nroSalida} ·{" "}
                                            {formatearFechaSalida(salida.fechaInicio)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${estilosEstadoSalida(salida.estado)}`}
                                        >
                                            {formatearEstadoSalida(salida.estado)}
                                        </span>
                                        <p className="mt-1 text-xs text-texto-suave">
                                            {salida.pasajerosConfirmados} / {salida.tamanoMaximo} pasajeros
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                <article className="rounded-tarjeta border border-borde bg-white shadow-tarjeta">
                    <div className="border-b border-borde px-6 py-5">
                        <h2 className="font-bold text-navegacion">Incidentes recientes</h2>
                        <p className="mt-1 text-sm text-texto-suave">Reportados por los guías</p>
                    </div>

                    {incidentesQ.isPending ? (
                        <EstadoListado estado="cargando" />
                    ) : incidentesQ.isError ? (
                        <EstadoListado estado="error" mensaje="No se pudieron cargar los incidentes." />
                    ) : incidentes.length === 0 ? (
                        <EstadoListado estado="vacio" mensaje="No hay incidentes reportados" />
                    ) : (
                        <div className="divide-y divide-borde">
                            {incidentes.map((inc) => (
                                <div className="px-6 py-4" key={inc.idincidente}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estiloGravedad[inc.nivelGravedad] ?? estiloGravedad.BAJO}`}
                                        >
                                            {inc.nivelGravedad}
                                        </span>
                                        <p className="text-sm font-semibold text-texto">
                                            {inc.salida.nroSalida} · {inc.tipoIncidente}
                                        </p>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-texto">{inc.descripcion}</p>
                                    <p className="mt-1 text-xs text-texto-suave">
                                        {inc.pasajeros.length > 0
                                            ? `Afectados: ${inc.pasajeros.map((p) => p.pasajero.nombreCompleto).join(", ")} · `
                                            : ""}
                                        {fechaHoraLocal(inc.fechaHoraReporte)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </article>
            </div>

            <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                <div className="mb-4">
                    <h2 className="font-bold text-navegacion">Acciones rápidas</h2>
                    <p className="mt-1 text-sm text-texto-suave">
                        Accedé directamente a las tareas más frecuentes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/circuitos")}
                    >
                        Administrar circuitos
                    </Boton>
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/temporadas")}
                    >
                        Gestionar temporadas
                    </Boton>
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/paquetes")}
                    >
                        Paquetes turísticos
                    </Boton>
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/proveedores")}
                    >
                        Administrar proveedores
                    </Boton>
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/solicitudes")}
                    >
                        Revisar solicitudes de alojamiento
                    </Boton>
                    <Boton
                        variante="secundario"
                        onClick={() => navigate("/gestion/evaluaciones")}
                    >
                        Reseñas y evaluaciones
                    </Boton>
                </div>
            </article>
        </section>
    );
}

export default InicioGestionPage;
