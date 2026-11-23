import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioProveedor from "../../components/FormularioProveedor";
import Modal from "../../components/Modal";
import Paginacion from "../../components/Paginacion";
import {
    tiposProveedor,
    useDarDeBajaProveedor,
    useModificarProveedor,
    useProveedores,
    useRegistrarProveedor,
} from "../../services/proveedorService";
import type {
    DatosProveedor,
    FiltrosProveedor,
    Proveedor,
} from "../../services/proveedorService";
import {
    etiquetaEstadoRegistro,
    etiquetaTipoServicio,
} from "../../services/formato";

type TipoProveedor = (typeof tiposProveedor)[number];
type VistaPresentacion = "tarjetas" | "tabla";

const ELEMENTOS_POR_PAGINA = 9;

type EstiloRubro = {
    etiqueta: string;
    descripcion: string;
    barra: string;
    iconoCaja: string;
    pill: string;
    kpiActivo: string;
    icono: ReactNode;
};

function IconoAlojamiento() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" />
            <path d="M10 10h4" />
            <path d="M10 14h4" />
            <path d="M10 18h4" />
        </svg>
    );
}

function IconoTransporte() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6v6" />
            <path d="M15 6v6" />
            <path d="M2 12h19.6" />
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
            <circle cx="7" cy="18" r="2" />
            <path d="M9 18h5" />
            <circle cx="16" cy="18" r="2" />
        </svg>
    );
}

function IconoTren() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="16" height="16" x="4" y="3" rx="2" />
            <path d="M4 11h16" />
            <path d="M12 3v8" />
            <path d="m8 19-2 3" />
            <path d="m18 22-2-3" />
            <path d="M8 15h.01" />
            <path d="M16 15h.01" />
        </svg>
    );
}

function IconoEquipamiento() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 21 14 3" />
            <path d="M20.5 21 10 3" />
            <path d="M15.5 21 12 15l-3.5 6" />
            <path d="M2 21h20" />
        </svg>
    );
}

function IconoPin() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function IconoMensaje() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
    );
}

function IconoTarjetas() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
    );
}

function IconoTabla() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" x2="21" y1="6" y2="6" />
            <line x1="8" x2="21" y1="12" y2="12" />
            <line x1="8" x2="21" y1="18" y2="18" />
            <line x1="3" x2="3.01" y1="6" y2="6" />
            <line x1="3" x2="3.01" y1="12" y2="12" />
            <line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
    );
}

const ESTILOS_RUBRO: Record<TipoProveedor, EstiloRubro> = {
    ALOJAMIENTO: {
        etiqueta: "Alojamiento",
        descripcion: "Hoteles y hostales",
        barra: "bg-indigo-500",
        iconoCaja: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-500/20",
        pill: "bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-500/20",
        kpiActivo: "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-400/20",
        icono: <IconoAlojamiento />,
    },
    TRANSPORTE: {
        etiqueta: "Transporte",
        descripcion: "Traslados terrestres",
        barra: "bg-amber-500",
        iconoCaja: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-500/25",
        pill: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25",
        kpiActivo: "border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20",
        icono: <IconoTransporte />,
    },
    TREN: {
        etiqueta: "Tren",
        descripcion: "Tramos ferroviarios",
        barra: "bg-sky-500",
        iconoCaja: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-500/25",
        pill: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/25",
        kpiActivo: "border-sky-400 bg-sky-50/50 ring-2 ring-sky-400/20",
        icono: <IconoTren />,
    },
    EQUIPAMIENTO: {
        etiqueta: "Equipamiento",
        descripcion: "Campamento y montaña",
        barra: "bg-emerald-500",
        iconoCaja: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
        pill: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20",
        kpiActivo: "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20",
        icono: <IconoEquipamiento />,
    },
};

function estiloRubroDe(tipo: string): EstiloRubro {
    return ESTILOS_RUBRO[tipo as TipoProveedor] ?? {
        etiqueta: etiquetaTipoServicio(tipo),
        descripcion: "Prestador",
        barra: "bg-slate-400",
        iconoCaja: "bg-fondo text-navegacion ring-1 ring-inset ring-borde",
        pill: "bg-fondo text-navegacion ring-1 ring-inset ring-borde",
        kpiActivo: "border-navegacion/40 bg-fondo ring-2 ring-navegacion/15",
        icono: <IconoAlojamiento />,
    };
}

function ProveedoresPage() {
    const [filtroTipo, setFiltroTipo] = useState<FiltrosProveedor["tipoProveedor"]>();
    const [filtroEstado, setFiltroEstado] = useState<FiltrosProveedor["estado"]>();
    const [vistaPresentacion, setVistaPresentacion] =
        useState<VistaPresentacion>("tarjetas");

    const hayFiltros = Boolean(filtroTipo ?? filtroEstado);
    const { data: todosLosProveedores = [] } = useProveedores();
    const {
        data: proveedores = [],
        isPending,
        isError,
        error,
    } = useProveedores({
        tipoProveedor: filtroTipo,
        estado: filtroEstado,
    });

    const registrar = useRegistrarProveedor();
    const modificar = useModificarProveedor();
    const darDeBaja = useDarDeBajaProveedor();
    const guardando = registrar.isPending || modificar.isPending;

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [proveedorEnEdicion, setProveedorEnEdicion] =
        useState<Proveedor | null>(null);
    const [proveedorSeleccionado, setProveedorSeleccionado] =
        useState<Proveedor | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirFormulario(proveedor?: Proveedor) {
        setProveedorEnEdicion(proveedor ?? null);
        setErrorFormulario("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setProveedorEnEdicion(null);
        setErrorFormulario("");
        modificar.reset();
    }

    function guardarProveedor(datos: DatosProveedor) {
        const opciones = {
            onSuccess: cerrarFormulario,
            onError: (e: Error) => setErrorFormulario(e.message),
        };

        if (proveedorEnEdicion) {
            // El contrato pide enviar solo lo que cambia (PUT parcial).
            const cambios = (Object.keys(datos) as (keyof DatosProveedor)[]).reduce<
                Partial<DatosProveedor>
            >(
                (acumulado, campo) =>
                    datos[campo] === proveedorEnEdicion[campo]
                        ? acumulado
                        : { ...acumulado, [campo]: datos[campo] },
                {},
            );
            if (Object.keys(cambios).length === 0) {
                cerrarFormulario();
                return;
            }
            modificar.mutate(
                { idproveedor: proveedorEnEdicion.idproveedor, datos: cambios },
                opciones,
            );
        } else {
            registrar.mutate(datos, opciones);
        }
    }

    function reactivarProveedor(proveedor: Proveedor) {
        modificar.reset();
        modificar.mutate({
            idproveedor: proveedor.idproveedor,
            datos: { estado: "ACTIVO" },
        });
    }

    function abrirDialogoBaja(proveedor: Proveedor) {
        setProveedorSeleccionado(proveedor);
    }

    function cancelarBaja() {
        setProveedorSeleccionado(null);
    }

    function confirmarBaja() {
        if (!proveedorSeleccionado) {
            return;
        }

        darDeBaja.mutate(proveedorSeleccionado.idproveedor, {
            onSuccess: () => {
                setProveedorSeleccionado(null);
                setPaginaActual(1);
            },
            // Cierra el diálogo para que se vea el motivo del bloqueo (CU-17).
            onError: () => setProveedorSeleccionado(null),
        });
    }

    function limpiarFiltros() {
        manejarCambioBusqueda("");
        setFiltroTipo(undefined);
        setFiltroEstado(undefined);
    }

    const metricas = useMemo(() => {
        const base =
            todosLosProveedores.length > 0 ? todosLosProveedores : proveedores;
        const porRubro = tiposProveedor.reduce(
            (acc, tipo) => {
                const delRubro = base.filter((p) => p.tipoProveedor === tipo);
                acc[tipo] = {
                    total: delRubro.length,
                    activos: delRubro.filter((p) => p.estado === "ACTIVO").length,
                };
                return acc;
            },
            {} as Record<TipoProveedor, { total: number; activos: number }>,
        );
        const inactivos = base.filter((p) => p.estado === "INACTIVO").length;
        return { porRubro, inactivos, total: base.length };
    }, [todosLosProveedores, proveedores]);

    const terminoLimpio = busqueda.trim().toLowerCase();
    const proveedoresFiltrados = useMemo(() => {
        const filtrados = proveedores.filter((proveedor) => {
            if (!terminoLimpio) return true;
            return (
                proveedor.razonSocial.toLowerCase().includes(terminoLimpio) ||
                proveedor.localidad.toLowerCase().includes(terminoLimpio) ||
                proveedor.datosContacto.toLowerCase().includes(terminoLimpio) ||
                proveedor.canalComunicacion.toLowerCase().includes(terminoLimpio) ||
                etiquetaTipoServicio(proveedor.tipoProveedor)
                    .toLowerCase()
                    .includes(terminoLimpio)
            );
        });
        // Activos primero, luego ordenados por rubro y razón social
        return [...filtrados].sort(
            (a, b) =>
                Number(a.estado !== "ACTIVO") - Number(b.estado !== "ACTIVO") ||
                a.tipoProveedor.localeCompare(b.tipoProveedor) ||
                a.razonSocial.localeCompare(b.razonSocial),
        );
    }, [proveedores, terminoLimpio]);

    const totalPaginas = Math.max(
        1,
        Math.ceil(proveedoresFiltrados.length / ELEMENTOS_POR_PAGINA),
    );
    const paginaValida = Math.min(paginaActual, totalPaginas);
    const indiceInicio = (paginaValida - 1) * ELEMENTOS_POR_PAGINA;
    const proveedoresPaginados = proveedoresFiltrados.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinProveedoresRegistrados =
        estado === "exito" && proveedores.length === 0;
    const mensajeVacio = hayFiltros
        ? "No hay proveedores que coincidan con los filtros seleccionados."
        : "Todavía no hay proveedores registrados.";
    const sinResultadosBusqueda =
        estado === "exito" &&
        proveedores.length > 0 &&
        proveedoresFiltrados.length === 0;

    return (
        <section className="mx-auto max-w-[1440px] space-y-5">
            {/* CABECERA */}
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca-oscura">
                        Recursos y prestadores
                    </p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-navegacion">
                        Proveedores
                    </h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        Hoteles, transporte, tren y equipamiento agrupados por rubro con acceso directo a sus servicios.
                    </p>
                </div>

                <Boton
                    onClick={() => abrirFormulario()}
                    className="rounded-xl px-4 py-2.5 shadow-[0_8px_20px_-6px_rgba(18,61,112,0.35)]"
                >
                    + Nuevo proveedor
                </Boton>
            </header>

            {formularioAbierto ? (
                <Modal
                    onCerrar={cerrarFormulario}
                    bloqueado={guardando}
                    tamano="lg"
                    etiqueta={
                        proveedorEnEdicion ? "Editar proveedor" : "Nuevo proveedor"
                    }
                >
                    <FormularioProveedor
                        proveedorEnEdicion={proveedorEnEdicion}
                        alGuardar={guardarProveedor}
                        alCancelar={cerrarFormulario}
                        guardando={guardando}
                        errorServidor={errorFormulario}
                    />
                </Modal>
            ) : null}

            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja el proveedor">
                    {darDeBaja.error.message}
                </Alerta>
            ) : null}

            {modificar.isError && !formularioAbierto ? (
                <Alerta tipo="error" titulo="No se pudo reactivar el proveedor">
                    {modificar.error.message}
                </Alerta>
            ) : null}

            {/* 4 TARJETAS KPI CLICABLES POR RUBRO */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tiposProveedor.map((tipo) => {
                    const estilo = ESTILOS_RUBRO[tipo];
                    const conteo = metricas.porRubro[tipo];
                    const activo = filtroTipo === tipo;
                    return (
                        <button
                            key={tipo}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => {
                                setFiltroTipo((prev) =>
                                    prev === tipo ? undefined : tipo,
                                );
                                setPaginaActual(1);
                            }}
                            className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                                activo
                                    ? estilo.kpiActivo
                                    : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                            }`}
                        >
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                                    {estilo.etiqueta}
                                </p>
                                <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                                    {conteo.activos}
                                    {conteo.total !== conteo.activos ? (
                                        <span className="ml-1.5 text-xs font-medium text-texto-suave">
                                            / {conteo.total}
                                        </span>
                                    ) : null}
                                </p>
                                <p className="mt-1 text-xs text-texto-suave">
                                    {estilo.descripcion}
                                </p>
                            </div>
                            <span
                                className={`grid size-9 shrink-0 place-items-center rounded-xl ${estilo.iconoCaja}`}
                            >
                                {estilo.icono}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* BARRA DE HERRAMIENTAS */}
            {estado === "exito" && (proveedores.length > 0 || hayFiltros || busqueda) ? (
                <div className="rounded-2xl border border-borde/80 bg-white p-3.5 shadow-[0_4px_16px_-8px_rgba(18,61,112,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* PÍLDORA SEGMENTADA DE ESTADOS */}
                        <div
                            role="tablist"
                            aria-label="Filtrar proveedores por estado"
                            className="inline-flex items-center gap-0.5 rounded-full bg-fondo p-1 ring-1 ring-borde/80"
                        >
                            {(
                                [
                                    { valor: undefined, etiqueta: "Todos" },
                                    { valor: "ACTIVO" as const, etiqueta: "Activos" },
                                    {
                                        valor: "INACTIVO" as const,
                                        etiqueta: "Inactivos",
                                        contador: metricas.inactivos,
                                    },
                                ] as const
                            ).map((op) => {
                                const activo = filtroEstado === op.valor;
                                return (
                                    <button
                                        key={op.etiqueta}
                                        type="button"
                                        role="tab"
                                        aria-selected={activo}
                                        onClick={() => {
                                            setFiltroEstado(op.valor);
                                            setPaginaActual(1);
                                        }}
                                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                            activo
                                                ? "bg-white text-navegacion shadow-2xs ring-1 ring-navegacion/[0.06]"
                                                : "text-texto-suave hover:text-navegacion"
                                        }`}
                                    >
                                        <span>{op.etiqueta}</span>
                                        {"contador" in op && op.contador > 0 ? (
                                            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-slate-200/80 px-1.5 text-[10.5px] font-bold leading-4 text-slate-700">
                                                {op.contador}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        {/* BUSCADOR + SELECT RUBRO + SWITCH VISTA */}
                        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                            <div className="relative min-w-[220px] flex-1 sm:w-64 sm:flex-initial">
                                <label htmlFor="buscar-proveedor" className="sr-only">
                                    Buscar proveedor
                                </label>
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-texto-suave"
                                >
                                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.3-4.3" />
                                    </svg>
                                </span>
                                <input
                                    id="buscar-proveedor"
                                    type="search"
                                    value={busqueda}
                                    onChange={(evento) =>
                                        manejarCambioBusqueda(evento.target.value)
                                    }
                                    placeholder="Buscar razón social, localidad o contacto..."
                                    className="w-full rounded-xl border border-borde bg-fondo/50 py-2 pl-9 pr-3 text-xs font-medium text-navegacion outline-none placeholder:text-texto-suave/70 transition focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15"
                                />
                            </div>

                            <label htmlFor="filtro-tipo" className="sr-only">
                                Filtrar por rubro
                            </label>
                            <select
                                id="filtro-tipo"
                                value={filtroTipo ?? ""}
                                onChange={(evento) => {
                                    setFiltroTipo(
                                        (evento.target.value ||
                                            undefined) as FiltrosProveedor["tipoProveedor"],
                                    );
                                    setPaginaActual(1);
                                }}
                                className="rounded-xl border border-borde bg-white px-3 py-2 text-xs font-semibold text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                            >
                                <option value="">Todos los rubros</option>
                                {tiposProveedor.map((tipo) => (
                                    <option key={tipo} value={tipo}>
                                        {etiquetaTipoServicio(tipo)}
                                    </option>
                                ))}
                            </select>

                            {/* SWITCH TARJETAS | TABLA */}
                            <div
                                role="group"
                                aria-label="Modo de visualización"
                                className="inline-flex items-center rounded-xl bg-fondo p-0.5 ring-1 ring-borde/80"
                            >
                                <button
                                    type="button"
                                    aria-pressed={vistaPresentacion === "tarjetas"}
                                    onClick={() => setVistaPresentacion("tarjetas")}
                                    title="Vista en tarjetas"
                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        vistaPresentacion === "tarjetas"
                                            ? "bg-white text-navegacion shadow-2xs"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <IconoTarjetas />
                                    <span className="hidden sm:inline">Tarjetas</span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={vistaPresentacion === "tabla"}
                                    onClick={() => setVistaPresentacion("tabla")}
                                    title="Vista en tabla"
                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        vistaPresentacion === "tabla"
                                            ? "bg-white text-navegacion shadow-2xs"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <IconoTabla />
                                    <span className="hidden sm:inline">Tabla</span>
                                </button>
                            </div>

                            {busqueda || hayFiltros ? (
                                <button
                                    type="button"
                                    onClick={limpiarFiltros}
                                    className="cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-marca-oscura transition hover:bg-marca-suave/60"
                                >
                                    Limpiar
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* CONTENIDO */}
            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : sinProveedoresRegistrados ? (
                <EstadoListado estado="vacio" mensaje={mensajeVacio} />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron proveedores que coincidan con "${busqueda.trim()}".`}
                />
            ) : vistaPresentacion === "tarjetas" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {proveedoresPaginados.map((proveedor) => {
                        const estilo = estiloRubroDe(proveedor.tipoProveedor);
                        const esActivo = proveedor.estado === "ACTIVO";

                        return (
                            <article
                                key={proveedor.idproveedor}
                                className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:border-navegacion/25 hover:shadow-[0_14px_30px_-14px_rgba(18,61,112,0.2)] ${
                                    esActivo
                                        ? "border-borde/80"
                                        : "border-borde/70 opacity-80"
                                }`}
                            >
                                {/* FRANJA DE COLOR POR RUBRO */}
                                <div
                                    className={`h-1.5 w-full ${
                                        esActivo ? estilo.barra : "bg-slate-300"
                                    }`}
                                />

                                <div className="flex flex-1 flex-col p-5">
                                    {/* CABECERA: ÍCONO + RAZÓN SOCIAL + ESTADO */}
                                    <div className="flex items-start gap-3.5">
                                        <div
                                            className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                                                esActivo
                                                    ? estilo.iconoCaja
                                                    : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
                                            }`}
                                        >
                                            {estilo.icono}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                        esActivo
                                                            ? estilo.pill
                                                            : "bg-slate-100 text-slate-600"
                                                    }`}
                                                >
                                                    {estilo.etiqueta}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                        esActivo
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-slate-100 text-slate-500"
                                                    }`}
                                                >
                                                    <span
                                                        className={`size-1.5 rounded-full ${
                                                            esActivo
                                                                ? "bg-emerald-500"
                                                                : "bg-slate-400"
                                                        }`}
                                                        aria-hidden="true"
                                                    />
                                                    {etiquetaEstadoRegistro(proveedor.estado)}
                                                </span>
                                            </div>

                                            <h2 className="mt-1.5 truncate text-base font-bold tracking-tight text-navegacion">
                                                {proveedor.razonSocial}
                                            </h2>
                                        </div>
                                    </div>

                                    {/* METADATOS: LOCALIDAD + CONTACTO + CANAL */}
                                    <div className="mt-4 space-y-2 rounded-xl border border-borde/70 bg-fondo/50 p-3 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-texto-suave">
                                                <IconoPin />
                                                <span className="font-semibold text-texto">
                                                    {proveedor.localidad}
                                                </span>
                                            </span>
                                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navegacion ring-1 ring-borde/80">
                                                {proveedor.canalComunicacion}
                                            </span>
                                        </div>

                                        <div
                                            className="flex items-center gap-1.5 text-texto-suave"
                                            title={proveedor.datosContacto}
                                        >
                                            <span className="shrink-0">
                                                <IconoMensaje />
                                            </span>
                                            <span className="truncate font-medium text-texto">
                                                {proveedor.datosContacto}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ACCIONES */}
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-borde/70 pt-3.5">
                                        <Link
                                            to={`/gestion/proveedores/${proveedor.idproveedor}/servicios`}
                                            aria-label={`Ver servicios de ${proveedor.razonSocial}`}
                                            className="inline-flex items-center gap-1 rounded-xl bg-navegacion/5 px-3 py-1.5 text-xs font-bold text-navegacion transition hover:bg-navegacion hover:text-white"
                                        >
                                            <span>Servicios</span>
                                            <span aria-hidden="true">→</span>
                                        </Link>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                aria-label={`Editar proveedor ${proveedor.razonSocial}`}
                                                onClick={() => abrirFormulario(proveedor)}
                                                className="cursor-pointer rounded-xl border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo"
                                            >
                                                Editar
                                            </button>
                                            {proveedor.estado === "INACTIVO" ? (
                                                <button
                                                    type="button"
                                                    aria-label={`Reactivar proveedor ${proveedor.razonSocial}`}
                                                    onClick={() => reactivarProveedor(proveedor)}
                                                    disabled={modificar.isPending}
                                                    className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                                                >
                                                    Reactivar
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    aria-label={`Dar de baja proveedor ${proveedor.razonSocial}`}
                                                    onClick={() => abrirDialogoBaja(proveedor)}
                                                    className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-peligro transition hover:bg-rose-100"
                                                >
                                                    Dar de baja
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-borde/80 bg-white shadow-[0_6px_22px_-12px_rgba(18,61,112,0.12)]">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-borde/80 bg-fondo/60 text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                                    <th className="px-5 py-3.5">Proveedor</th>
                                    <th className="px-4 py-3.5">Rubro</th>
                                    <th className="px-4 py-3.5">Localidad y contacto</th>
                                    <th className="px-4 py-3.5">Estado</th>
                                    <th className="px-5 py-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde/70">
                                {proveedoresPaginados.map((proveedor) => {
                                    const estilo = estiloRubroDe(proveedor.tipoProveedor);
                                    const esActivo = proveedor.estado === "ACTIVO";

                                    return (
                                        <tr
                                            key={proveedor.idproveedor}
                                            className={`transition-colors hover:bg-fondo/45 ${
                                                esActivo ? "" : "opacity-75"
                                            }`}
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                                                            esActivo
                                                                ? estilo.iconoCaja
                                                                : "bg-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        {estilo.icono}
                                                    </span>
                                                    <span className="font-bold text-navegacion">
                                                        {proveedor.razonSocial}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilo.pill}`}
                                                >
                                                    {estilo.etiqueta}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs">
                                                <p className="font-semibold text-texto">
                                                    {proveedor.localidad}{" "}
                                                    <span className="font-normal text-texto-suave">
                                                        · {proveedor.canalComunicacion}
                                                    </span>
                                                </p>
                                                <p className="mt-0.5 text-texto-suave">
                                                    {proveedor.datosContacto}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        esActivo
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-slate-100 text-slate-500"
                                                    }`}
                                                >
                                                    <span
                                                        className={`size-1.5 rounded-full ${
                                                            esActivo
                                                                ? "bg-emerald-500"
                                                                : "bg-slate-400"
                                                        }`}
                                                        aria-hidden="true"
                                                    />
                                                    {etiquetaEstadoRegistro(proveedor.estado)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    <Link
                                                        to={`/gestion/proveedores/${proveedor.idproveedor}/servicios`}
                                                        aria-label={`Ver servicios de ${proveedor.razonSocial}`}
                                                        className="inline-flex items-center gap-1 rounded-xl bg-navegacion/5 px-2.5 py-1.5 text-xs font-bold text-navegacion transition hover:bg-navegacion hover:text-white"
                                                    >
                                                        Servicios →
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        aria-label={`Editar proveedor ${proveedor.razonSocial}`}
                                                        onClick={() => abrirFormulario(proveedor)}
                                                        className="cursor-pointer rounded-xl border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo"
                                                    >
                                                        Editar
                                                    </button>
                                                    {proveedor.estado === "INACTIVO" ? (
                                                        <button
                                                            type="button"
                                                            aria-label={`Reactivar proveedor ${proveedor.razonSocial}`}
                                                            onClick={() =>
                                                                reactivarProveedor(proveedor)
                                                            }
                                                            disabled={modificar.isPending}
                                                            className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                                                        >
                                                            Reactivar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            aria-label={`Dar de baja proveedor ${proveedor.razonSocial}`}
                                                            onClick={() =>
                                                                abrirDialogoBaja(proveedor)
                                                            }
                                                            className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-peligro transition hover:bg-rose-100"
                                                        >
                                                            Dar de baja
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {estado === "exito" && proveedoresFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaValida}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={proveedorSeleccionado !== null}
                titulo="Confirmar baja de proveedor"
                descripcion={
                    proveedorSeleccionado
                        ? `¿Estás seguro de que querés dar de baja a ${proveedorSeleccionado.razonSocial}?`
                        : ""
                }
                textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"}
                cargando={darDeBaja.isPending}
                onConfirmar={confirmarBaja}
                onCancelar={cancelarBaja}
            />
        </section>
    );
}

export default ProveedoresPage;
