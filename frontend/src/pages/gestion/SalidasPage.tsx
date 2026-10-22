import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import { useCircuitos } from "../../services/circuitoService";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaSalida,
} from "../../services/guiaService";
import { usePaquetes } from "../../services/paqueteService";
import { usePersonal } from "../../services/personalService";
import {
    contarSolicitudesPendientesPorSalida,
    dotacionDeSalida,
    nombresGuiasDeSalida,
    useSalidas,
    type FiltrosSalidas,
    type Salida,
} from "../../services/salidaService";
import { listarSolicitudesPendientes } from "../../services/solicitudService";

const ELEMENTOS_POR_PAGINA = 5;

const ESTADOS_SALIDA = [
    { valor: "PUBLICADA", etiqueta: "Publicada" },
    { valor: "CERRADA", etiqueta: "Cerrada" },
    { valor: "EN_CURSO", etiqueta: "En curso" },
    { valor: "FINALIZADA", etiqueta: "Finalizada" },
    { valor: "CANCELADA", etiqueta: "Cancelada" },
] as const;

function SalidasPage() {
    const [filtroCircuito, setFiltroCircuito] = useState<number | "">("");
    const [filtroPaquete, setFiltroPaquete] = useState<number | "">("");
    const [filtroEstado, setFiltroEstado] = useState<string>("");
    const [filtroDesde, setFiltroDesde] = useState<string>("");
    const [filtroHasta, setFiltroHasta] = useState<string>("");
    const [filtroGuia, setFiltroGuia] = useState<number | "">("");
    const [paginaActual, setPaginaActual] = useState(1);

    // Opciones para los selectores de filtros
    const { data: circuitos = [], isPending: cargandoCircuitos } = useCircuitos();
    const { data: paquetes = [], isPending: cargandoPaquetes } = usePaquetes();
    const { data: personalGuias = [], isPending: cargandoGuias } = usePersonal({
        rol: "Guía",
    });

    const rangoFechasInvalido = Boolean(
        filtroDesde && filtroHasta && filtroDesde > filtroHasta,
    );

    const filtrosConsulta: FiltrosSalidas = {
        ...(filtroCircuito !== "" ? { idcircuito: Number(filtroCircuito) } : {}),
        ...(filtroPaquete !== "" ? { idpaquete: Number(filtroPaquete) } : {}),
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(!rangoFechasInvalido && filtroDesde ? { desde: filtroDesde } : {}),
        ...(!rangoFechasInvalido && filtroHasta ? { hasta: filtroHasta } : {}),
        ...(filtroGuia !== "" ? { idguia: Number(filtroGuia) } : {}),
    };

    const {
        data: salidas = [],
        isPending,
        isError,
        error,
    } = useSalidas(filtrosConsulta);

    // Consulta de solicitudes de alojamiento para enriquecer con el conteo exacto de solicitudes pendientes
    const { data: solicitudesPendientes = [] } = useQuery({
        queryKey: ["solicitudes"],
        queryFn: listarSolicitudesPendientes,
        retry: 1,
    });

    const solicitudesPorSalida = useMemo(() => {
        return contarSolicitudesPendientesPorSalida(solicitudesPendientes);
    }, [solicitudesPendientes]);

    // Advertencias operativas basadas en salida.alertas provistas por el backend (RF-61)
    const salidasConAlertasOperativas = useMemo(() => {
        return salidas.filter((s) => Array.isArray(s.alertas) && s.alertas.length > 0);
    }, [salidas]);

    const hayFiltrosActivos =
        filtroCircuito !== "" ||
        filtroPaquete !== "" ||
        Boolean(filtroEstado) ||
        Boolean(filtroDesde) ||
        Boolean(filtroHasta) ||
        filtroGuia !== "";

    function limpiarFiltros() {
        setFiltroCircuito("");
        setFiltroPaquete("");
        setFiltroEstado("");
        setFiltroDesde("");
        setFiltroHasta("");
        setFiltroGuia("");
        setPaginaActual(1);
    }

    const estadoListado = isPending ? "cargando" : isError ? "error" : "exito";
    const totalPaginas = Math.max(1, Math.ceil(salidas.length / ELEMENTOS_POR_PAGINA));
    const paginaValida = Math.min(paginaActual, totalPaginas);
    const salidasPaginadas = salidas.slice(
        (paginaValida - 1) * ELEMENTOS_POR_PAGINA,
        paginaValida * ELEMENTOS_POR_PAGINA,
    );
    const sinResultados = estadoListado === "exito" && salidas.length === 0;

    const columnas = [
        {
            clave: "nroSalida" as const,
            titulo: "N° Salida",
            renderizar: (fila: Salida) => (
                <span className="font-semibold text-navegacion whitespace-nowrap">
                    {fila.nroSalida}
                </span>
            ),
        },
        {
            clave: "paquete" as const,
            titulo: "Paquete",
            renderizar: (fila: Salida) => (
                <div className="min-w-[180px] max-w-[280px]">
                    <p className="font-medium text-texto leading-snug">
                        {fila.paquete?.nombrePaquete ?? "—"}
                    </p>
                    <p className="text-xs text-texto-suave mt-0.5">
                        {fila.paquete?.nroPaquete}
                    </p>
                </div>
            ),
        },
        {
            clave: "fechaInicio" as const,
            titulo: "Fechas",
            renderizar: (fila: Salida) => (
                <div className="min-w-[130px] whitespace-nowrap text-xs">
                    <p className="font-medium text-texto">
                        Inicio: {formatearFechaSalida(fila.fechaInicio)}
                    </p>
                    <p className="text-texto-suave mt-0.5">
                        Fin: {formatearFechaSalida(fila.fechaFin)}
                    </p>
                </div>
            ),
        },
        {
            clave: "estado" as const,
            titulo: "Estado",
            renderizar: (fila: Salida) => (
                <div className="whitespace-nowrap">
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(fila.estado)}`}
                    >
                        {formatearEstadoSalida(fila.estado)}
                    </span>
                </div>
            ),
        },
        {
            clave: "tamanoMaximo" as const,
            titulo: "Pasajeros / Cupo",
            renderizar: (fila: Salida) => (
                <div className="min-w-[110px] whitespace-nowrap text-xs">
                    <p className="font-medium text-texto">
                        Confirmados:{" "}
                        <span className="font-semibold text-navegacion">
                            {fila.pasajerosConfirmados}
                        </span>
                    </p>
                    <p className="text-texto-suave mt-0.5">
                        Máx: {fila.tamanoMaximo} · Disp: {fila.stockLocal}
                    </p>
                </div>
            ),
        },
        {
            clave: "personalAsignado" as const,
            titulo: "Personal",
            renderizar: (fila: Salida) => {
                const dotacion = dotacionDeSalida(fila);
                const totalPersonal = fila.cantidadPersonal ?? dotacion.total;
                if (totalPersonal === 0) {
                    return (
                        <span className="text-xs text-texto-suave whitespace-nowrap">
                            Sin personal asignado
                        </span>
                    );
                }
                return (
                    <div className="min-w-[140px] text-xs">
                        <p className="font-medium text-texto whitespace-nowrap">
                            {totalPersonal} {totalPersonal === 1 ? "asignado" : "asignados"}
                        </p>
                        {dotacion.total > 0 && (
                            <p className="text-texto-suave mt-0.5 whitespace-nowrap">
                                {dotacion.guias} {dotacion.guias === 1 ? "guía" : "guías"} ·{" "}
                                {dotacion.porteadores}{" "}
                                {dotacion.porteadores === 1 ? "porteador" : "porteadores"}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            clave: "id" as const,
            titulo: "Guía/s",
            renderizar: (fila: Salida) => {
                const guias =
                    fila.guias && fila.guias.length > 0
                        ? fila.guias
                        : nombresGuiasDeSalida(fila);
                if (guias.length === 0) {
                    return (
                        <span className="text-xs text-texto-suave whitespace-nowrap">
                            Sin guías asignados
                        </span>
                    );
                }
                return (
                    <ul className="min-w-[120px] text-xs text-texto space-y-0.5">
                        {guias.map((nombre, i) => (
                            <li key={i} className="font-medium whitespace-nowrap">
                                {nombre}
                            </li>
                        ))}
                    </ul>
                );
            },
        },
        {
            clave: "permisosFaltantes" as const,
            titulo: "Permisos",
            renderizar: (fila: Salida) => {
                const faltantes = fila.permisosFaltantes ?? 0;
                const alertaPermisos = fila.alertas?.includes("PERMISOS_SIN_CONFIRMAR");

                if (faltantes === 0) {
                    return (
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                            Al día (0 faltantes)
                        </span>
                    );
                }

                if (alertaPermisos) {
                    return (
                        <div className="whitespace-nowrap">
                            <span
                                className="inline-flex items-center gap-1 rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-bold text-rose-900"
                                title="Alerta operativa: permisos sin emitir dentro de los 7 días previos al inicio"
                            >
                                <span aria-hidden="true">⚠️</span>
                                <span>
                                    {faltantes}{" "}
                                    {faltantes === 1 ? "faltante" : "faltantes"}
                                </span>
                            </span>
                        </div>
                    );
                }

                return (
                    <span className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap">
                        {faltantes} {faltantes === 1 ? "faltante" : "faltantes"}
                    </span>
                );
            },
        },
        {
            clave: "ultimaEtapaAlcanzada" as const,
            titulo: "Avance",
            renderizar: (fila: Salida) => {
                if (fila.estado === "EN_CURSO") {
                    const informada = fila.etapaInformada ?? fila.ultimaEtapaAlcanzada;
                    const esperada = fila.etapaEsperada;
                    const desfasada = fila.etapaDesfasada;

                    const textoInformada =
                        informada !== null ? `Etapa ${informada}` : "Sin informe";
                    const textoEsperada =
                        esperada !== null ? `Esperada: ${esperada}` : null;

                    if (desfasada) {
                        return (
                            <div className="whitespace-nowrap flex flex-col gap-0.5">
                                <span
                                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
                                    title="Discrepancia entre la etapa informada por el guía y la etapa esperada según itinerario"
                                >
                                    <span aria-hidden="true">⏱️</span>
                                    <span>{textoInformada}</span>
                                    {textoEsperada && (
                                        <span className="font-normal text-amber-700">
                                            ({textoEsperada})
                                        </span>
                                    )}
                                </span>
                                <span className="text-[10px] font-semibold text-amber-700">
                                    Desfasada del cronograma
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div className="whitespace-nowrap flex flex-col gap-0.5">
                            <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                {textoInformada}
                                {textoEsperada && (
                                    <span className="ml-1 text-emerald-600">
                                        ({textoEsperada})
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">
                                Al día
                            </span>
                        </div>
                    );
                }
                return <span className="text-xs text-texto-suave">—</span>;
            },
        },
        {
            clave: "id" as const,
            titulo: "Avisos",
            renderizar: (fila: Salida) => {
                const tieneAlertas =
                    Array.isArray(fila.alertas) && fila.alertas.length > 0;
                if (!tieneAlertas) {
                    return (
                        <span className="text-xs text-texto-suave whitespace-nowrap">
                            Sin avisos
                        </span>
                    );
                }

                const cantSolicitudes = solicitudesPorSalida.get(fila.idsalida);

                return (
                    <div className="whitespace-nowrap flex flex-col gap-1 items-start">
                        {fila.alertas.includes("SOLICITUD_PENDIENTE") && (
                            <Link
                                to="/gestion/solicitudes"
                                title="Solicitudes de alojamiento pendientes en salida próxima (< 7 días)"
                                className="inline-flex items-center gap-1 rounded bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 transition-colors"
                            >
                                <span aria-hidden="true">⚠️</span>
                                <span>
                                    {cantSolicitudes !== undefined && cantSolicitudes > 0
                                        ? `${cantSolicitudes} ${cantSolicitudes === 1 ? "solicitud pend." : "solicitudes pend."}`
                                        : "Solicitud pend."}
                                </span>
                            </Link>
                        )}
                        {fila.alertas.includes("PERMISOS_SIN_CONFIRMAR") && (
                            <span
                                title="Permisos sin confirmar en salida próxima (< 7 días)"
                                className="inline-flex items-center gap-1 rounded bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-xs font-semibold text-rose-900"
                            >
                                <span aria-hidden="true">📋</span>
                                <span>
                                    {fila.permisosFaltantes}{" "}
                                    {fila.permisosFaltantes === 1
                                        ? "perm. faltante"
                                        : "perm. faltantes"}
                                </span>
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            clave: "idsalida" as const,
            titulo: "Acciones",
            renderizar: (fila: Salida) => {
                const tieneSolicitudes =
                    (solicitudesPorSalida.get(fila.idsalida) ?? 0) > 0 ||
                    fila.alertas?.includes("SOLICITUD_PENDIENTE");
                const esFinalizada = fila.estado === "FINALIZADA";

                if (!tieneSolicitudes && !esFinalizada) {
                    return <span className="text-xs text-texto-suave">—</span>;
                }

                return (
                    <div className="min-w-[110px] whitespace-nowrap flex flex-col gap-1 items-start text-xs font-semibold">
                        {tieneSolicitudes && (
                            <Link
                                to="/gestion/solicitudes"
                                className="text-marca hover:underline"
                            >
                                Ver solicitudes
                            </Link>
                        )}
                        {esFinalizada && (
                            <Link
                                to="/gestion/evaluaciones"
                                className="text-marca hover:underline"
                            >
                                Evaluar
                            </Link>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de salidas
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">Consultar Salidas</h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Visualizá y consultá las salidas programadas, su dotación de personal asignado y estado de avance.
                    </p>
                </div>
            </header>

            {/* Advertencia operativa en salidas próximas (< 7 días) (RF-61) */}
            {salidasConAlertasOperativas.length > 0 ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Advertencias operativas: Salidas próximas dentro de 7 días (RF-61)"
                >
                    <div className="space-y-2">
                        <p className="text-sm">
                            Se detectaron situaciones operativas pendientes en{" "}
                            {salidasConAlertasOperativas.length}{" "}
                            {salidasConAlertasOperativas.length === 1
                                ? "salida próxima a iniciar"
                                : "salidas próximas a iniciar"}
                            :
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {salidasConAlertasOperativas.map((s) => {
                                const tieneSol = s.alertas?.includes("SOLICITUD_PENDIENTE");
                                const tienePerm = s.alertas?.includes("PERMISOS_SIN_CONFIRMAR");
                                const cantSol = solicitudesPorSalida.get(s.idsalida);

                                return (
                                    <div
                                        key={s.idsalida}
                                        className="inline-flex flex-wrap items-center gap-1.5 rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300"
                                    >
                                        <span>
                                            {s.nroSalida} ({s.paquete?.nombrePaquete}):
                                        </span>
                                        {tieneSol && (
                                            <Link
                                                to="/gestion/solicitudes"
                                                className="font-bold underline hover:text-amber-950"
                                            >
                                                {cantSol
                                                    ? `${cantSol} ${cantSol === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`
                                                    : "solicitud pendiente"}
                                            </Link>
                                        )}
                                        {tieneSol && tienePerm && <span>·</span>}
                                        {tienePerm && (
                                            <span className="text-rose-900 font-bold">
                                                {s.permisosFaltantes}{" "}
                                                {s.permisosFaltantes === 1
                                                    ? "permiso faltante"
                                                    : "permisos faltantes"}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="pt-1">
                            <Link
                                to="/gestion/solicitudes"
                                className="inline-flex items-center text-xs font-semibold text-amber-900 underline hover:text-amber-950"
                            >
                                Ir a Gestión de Solicitudes →
                            </Link>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {rangoFechasInvalido ? (
                <Alerta tipo="error" titulo="Rango de fechas inválido">
                    La fecha desde no puede ser posterior a la fecha hasta.
                </Alerta>
            ) : null}

            {/* Panel de Filtros */}
            <div className="grid gap-3 rounded-tarjeta border border-borde bg-white p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <label
                    htmlFor="filtro-circuito"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Circuito
                    <select
                        id="filtro-circuito"
                        value={filtroCircuito}
                        disabled={cargandoCircuitos}
                        onChange={(evento) => {
                            setFiltroCircuito(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los circuitos</option>
                        {circuitos.map((c) => (
                            <option key={c.idcircuito} value={c.idcircuito}>
                                {c.nombreCircuito}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-paquete"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Paquete
                    <select
                        id="filtro-paquete"
                        value={filtroPaquete}
                        disabled={cargandoPaquetes}
                        onChange={(evento) => {
                            setFiltroPaquete(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los paquetes</option>
                        {paquetes.map((p) => (
                            <option key={p.idpaquete} value={p.idpaquete}>
                                {p.nroPaquete} · {p.nombrePaquete}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-estado"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Estado
                    <select
                        id="filtro-estado"
                        value={filtroEstado}
                        onChange={(evento) => {
                            setFiltroEstado(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los estados</option>
                        {ESTADOS_SALIDA.map((item) => (
                            <option key={item.valor} value={item.valor}>
                                {item.etiqueta}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-desde"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Fecha desde
                    <input
                        id="filtro-desde"
                        type="date"
                        value={filtroDesde}
                        onChange={(evento) => {
                            setFiltroDesde(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label
                    htmlFor="filtro-hasta"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Fecha hasta
                    <input
                        id="filtro-hasta"
                        type="date"
                        value={filtroHasta}
                        onChange={(evento) => {
                            setFiltroHasta(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label
                    htmlFor="filtro-guia"
                    className="grid gap-1 text-xs font-semibold text-texto-suave"
                >
                    Guía asignado
                    <select
                        id="filtro-guia"
                        value={filtroGuia}
                        disabled={cargandoGuias}
                        onChange={(evento) => {
                            setFiltroGuia(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los guías</option>
                        {personalGuias.map((g) => (
                            <option key={g.idpersonal} value={g.idpersonal}>
                                {g.nombreCompleto}
                            </option>
                        ))}
                    </select>
                </label>

                {hayFiltrosActivos ? (
                    <div className="flex justify-end sm:col-span-2 md:col-span-3 lg:col-span-6">
                        <Boton
                            variante="fantasma"
                            className="text-xs text-texto-suave"
                            onClick={limpiarFiltros}
                        >
                            Limpiar filtros
                        </Boton>
                    </div>
                ) : null}
            </div>

            {/* Listado y Estados */}
            {estadoListado !== "exito" ? (
                <EstadoListado
                    estado={estadoListado}
                    mensaje={estadoListado === "error" ? error?.message : undefined}
                />
            ) : sinResultados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={
                        hayFiltrosActivos
                            ? "No se encontraron salidas que coincidan con los filtros seleccionados."
                            : "Todavía no hay salidas registradas."
                    }
                />
            ) : (
                <div className="space-y-4">
                    <div className="overflow-x-auto rounded-tarjeta">
                        <div className="min-w-full w-max">
                            <Tabla
                                filas={salidasPaginadas}
                                columnas={columnas}
                                claseFila={(fila) => {
                                    const tieneAlertas =
                                        Array.isArray(fila.alertas) && fila.alertas.length > 0;
                                    const tieneDesfase = fila.etapaDesfasada === true;
                                    if (tieneAlertas || tieneDesfase) {
                                        return "bg-amber-50/75 hover:bg-amber-100/60 transition-colors";
                                    }
                                    return undefined;
                                }}
                            />
                        </div>
                    </div>

                    <Paginacion
                        paginaActual={paginaValida}
                        totalPaginas={totalPaginas}
                        onCambiarPagina={(nuevaPagina) => setPaginaActual(nuevaPagina)}
                    />
                </div>
            )}
        </section>
    );
}

export default SalidasPage;
