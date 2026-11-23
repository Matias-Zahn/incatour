import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioPersonal from "../../components/FormularioPersonal";
import Modal from "../../components/Modal";
import Paginacion from "../../components/Paginacion";
import {
    esFechaFuturaOVigente,
    useCrearPersonal,
    useDarDeBajaPersonal,
    useModificarPersonal,
    usePersonal,
    type DatosCrearPersonal,
    type DatosModificarPersonal,
    type EstadoPersonal,
    type FiltrosPersonal,
    type Personal,
    type PersonalModificar,
    type ResultadoCrearPersonal,
    type RolPersonal,
} from "../../services/personalService";
import { ErrorApi } from "../../services/clienteApi";
import {
    etiquetaEstadoRegistro,
    etiquetaHabilitacion,
    formatearFechaSalida,
    formatearRangoFechasUtc,
} from "../../services/formato";

type SalidaBloqueantePersonal = {
    idsalida: number;
    nroSalida: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
};

type VistaPresentacion = "tarjetas" | "tabla";

function extraerSalidasBloqueantes(error: unknown): SalidaBloqueantePersonal[] {
    if (!(error instanceof ErrorApi) || !error.detalle || typeof error.detalle !== "object") {
        return [];
    }
    const det = error.detalle as { salidas?: unknown };
    return Array.isArray(det.salidas) ? (det.salidas as SalidaBloqueantePersonal[]) : [];
}

function obtenerIniciales(nombre: string): string {
    const partes = nombre
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (partes.length === 0) return "?";
    if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
    return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

function tieneDocumentacionVencida(persona: Personal): boolean {
    if (persona.estado !== "ACTIVO") return false;
    const pasaporteVigente = esFechaFuturaOVigente(persona.fechaVencimientoPasaporte);
    const habilitacionVigente = persona.guia
        ? esFechaFuturaOVigente(persona.guia.fechaHabilitacion)
        : true;
    return !pasaporteVigente || !habilitacionVigente;
}

function IconoGuia() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
    );
}

function IconoPorteador() {
    return (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            <path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" />
            <path d="M8 10h8" />
        </svg>
    );
}

function IconoPasaporte() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="16" height="20" x="4" y="2" rx="2" />
            <circle cx="12" cy="10" r="3" />
            <path d="M8 17h8" />
        </svg>
    );
}

function IconoCredencial() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
            <path d="m9 12 2 2 4-4" />
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

const ELEMENTOS_POR_PAGINA = 9;

function PersonalPage() {
    const [filtroRol, setFiltroRol] = useState<RolPersonal | "">("");
    const [filtroEstado, setFiltroEstado] = useState<EstadoPersonal | "">("");
    const [filtroHabilitacion, setFiltroHabilitacion] = useState<"" | "true" | "false">("");
    const [soloEnSalida, setSoloEnSalida] = useState(false);
    const [soloVencidos, setSoloVencidos] = useState(false);
    const [vistaPresentacion, setVistaPresentacion] =
        useState<VistaPresentacion>("tarjetas");
    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);

    const filtrosConsulta: FiltrosPersonal = {
        ...(filtroRol ? { rol: filtroRol } : {}),
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(filtroHabilitacion !== ""
            ? { habilitacionVigente: filtroHabilitacion === "true" }
            : {}),
    };

    const { data: todoElPersonal = [] } = usePersonal();
    const {
        data: listaPersonal = [],
        isPending,
        isError,
        error,
    } = usePersonal(filtrosConsulta);

    const crear = useCrearPersonal();
    const modificar = useModificarPersonal();
    const darDeBaja = useDarDeBajaPersonal();
    const guardando = crear.isPending || modificar.isPending;

    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [personalEnEdicion, setPersonalEnEdicion] = useState<Personal | null>(null);
    const [personalSeleccionado, setPersonalSeleccionado] = useState<Personal | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [salidasBloqueantesEdicion, setSalidasBloqueantesEdicion] = useState<
        SalidaBloqueantePersonal[]
    >([]);
    const [ultimoRegistro, setUltimoRegistro] = useState<ResultadoCrearPersonal | null>(null);

    function abrirFormulario(persona?: Personal) {
        setPersonalEnEdicion(persona ?? null);
        setErrorFormulario("");
        setSalidasBloqueantesEdicion([]);
        setUltimoRegistro(null);
        darDeBaja.reset();
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setPersonalEnEdicion(null);
        setErrorFormulario("");
        setSalidasBloqueantesEdicion([]);
    }

    function manejarCrear(datos: DatosCrearPersonal) {
        crear.mutate(datos, {
            onSuccess: (resultado) => {
                setUltimoRegistro(resultado);
                cerrarFormulario();
            },
            onError: (e: Error) => setErrorFormulario(e.message),
        });
    }

    function manejarModificar(datos: DatosModificarPersonal) {
        if (!personalEnEdicion) return;

        const cambios: PersonalModificar = {};
        if (datos.nombreCompleto.trim() !== personalEnEdicion.nombreCompleto) {
            cambios.nombreCompleto = datos.nombreCompleto.trim();
        }
        if (datos.nroPasaporte.trim() !== personalEnEdicion.nroPasaporte) {
            cambios.nroPasaporte = datos.nroPasaporte.trim();
        }
        if (datos.nacionalidad.trim() !== personalEnEdicion.nacionalidad) {
            cambios.nacionalidad = datos.nacionalidad.trim();
        }
        if (datos.fechaVencimientoPasaporte !== personalEnEdicion.fechaVencimientoPasaporte) {
            cambios.fechaVencimientoPasaporte = datos.fechaVencimientoPasaporte;
        }

        if (personalEnEdicion.rol === "Guía") {
            const habActual = personalEnEdicion.guia?.nroHabilitacion ?? "";
            const fechaHabActual = personalEnEdicion.guia?.fechaHabilitacion ?? "";
            const nuevaHab = datos.nroHabilitacion?.trim() ?? "";
            const nuevaFechaHab = datos.fechaHabilitacion ?? "";

            if (nuevaHab && nuevaHab !== habActual) {
                cambios.nroHabilitacion = nuevaHab;
            }
            if (nuevaFechaHab && nuevaFechaHab !== fechaHabActual) {
                cambios.fechaHabilitacion = nuevaFechaHab;
            }
        }

        if (Object.keys(cambios).length === 0) {
            cerrarFormulario();
            return;
        }

        modificar.mutate(
            { id: personalEnEdicion.idpersonal, datos: cambios },
            {
                onSuccess: () => {
                    setUltimoRegistro(null);
                    cerrarFormulario();
                },
                onError: (e: Error) => {
                    setErrorFormulario(e.message);
                    setSalidasBloqueantesEdicion(extraerSalidasBloqueantes(e));
                },
            },
        );
    }

    function confirmarBaja() {
        if (!personalSeleccionado) return;
        setUltimoRegistro(null);
        darDeBaja.mutate(personalSeleccionado.idpersonal, {
            onSuccess: () => {
                setPersonalSeleccionado(null);
                setPaginaActual(1);
            },
            onError: () => {
                setPersonalSeleccionado(null);
            },
        });
    }

    function limpiarFiltros() {
        setFiltroRol("");
        setFiltroEstado("");
        setFiltroHabilitacion("");
        setSoloEnSalida(false);
        setSoloVencidos(false);
        setBusqueda("");
        setPaginaActual(1);
    }

    const metricas = useMemo(() => {
        const base = todoElPersonal.length > 0 ? todoElPersonal : listaPersonal;
        const guias = base.filter((p) => p.rol === "Guía");
        const porteadores = base.filter((p) => p.rol === "Porteador");
        return {
            guiasActivos: guias.filter((p) => p.estado === "ACTIVO").length,
            guiasTotal: guias.length,
            porteadoresActivos: porteadores.filter((p) => p.estado === "ACTIVO").length,
            porteadoresTotal: porteadores.length,
            enSalida: base.filter((p) => Boolean(p.salidaEnCurso)).length,
            conVencidos: base.filter(tieneDocumentacionVencida).length,
        };
    }, [todoElPersonal, listaPersonal]);

    const terminoLimpio = busqueda.trim().toLowerCase();
    const personalFiltrado = useMemo(() => {
        const filtrados = listaPersonal.filter((persona) => {
            if (soloEnSalida && !persona.salidaEnCurso) return false;
            if (soloVencidos && !tieneDocumentacionVencida(persona)) return false;
            if (!terminoLimpio) return true;
            return (
                persona.nombreCompleto.toLowerCase().includes(terminoLimpio) ||
                persona.nroPasaporte.toLowerCase().includes(terminoLimpio) ||
                persona.nacionalidad.toLowerCase().includes(terminoLimpio) ||
                persona.rol.toLowerCase().includes(terminoLimpio) ||
                (persona.guia?.nroHabilitacion.toLowerCase().includes(terminoLimpio) ?? false)
            );
        });
        // Activos primero, en salida arriba, luego guías y porteadores por nombre
        return [...filtrados].sort(
            (a, b) =>
                Number(a.estado !== "ACTIVO") - Number(b.estado !== "ACTIVO") ||
                Number(Boolean(b.salidaEnCurso)) - Number(Boolean(a.salidaEnCurso)) ||
                Number(b.rol === "Guía") - Number(a.rol === "Guía") ||
                a.nombreCompleto.localeCompare(b.nombreCompleto),
        );
    }, [listaPersonal, soloEnSalida, soloVencidos, terminoLimpio]);

    const totalPaginas = Math.max(
        1,
        Math.ceil(personalFiltrado.length / ELEMENTOS_POR_PAGINA),
    );
    const paginaValida = Math.min(paginaActual, totalPaginas);
    const indiceInicio = (paginaValida - 1) * ELEMENTOS_POR_PAGINA;
    const personalPaginado = personalFiltrado.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const hayFiltrosActivos =
        Boolean(filtroRol) ||
        Boolean(filtroEstado) ||
        Boolean(filtroHabilitacion) ||
        soloEnSalida ||
        soloVencidos ||
        Boolean(terminoLimpio);

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinResultados = estado === "exito" && personalFiltrado.length === 0;

    return (
        <section className="mx-auto max-w-[1440px] space-y-5">
            {/* CABECERA */}
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca-oscura">
                        Recursos y equipo
                    </p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-navegacion">
                        Personal operativo
                    </h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        Legajos de guías y porteadores, vigencia documental y actividad en terreno.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                        to="/gestion/cuentas-guia"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-borde bg-white px-4 py-2.5 text-sm font-semibold text-navegacion transition hover:border-navegacion/30 hover:bg-fondo"
                    >
                        <IconoGuia />
                        <span>Cuentas de guía</span>
                    </Link>
                    <Boton
                        onClick={() => abrirFormulario()}
                        className="rounded-xl px-4 py-2.5 shadow-[0_8px_20px_-6px_rgba(18,61,112,0.35)]"
                    >
                        + Nuevo personal
                    </Boton>
                </div>
            </header>

            {formularioAbierto ? (
                <Modal
                    onCerrar={cerrarFormulario}
                    bloqueado={guardando}
                    tamano="lg"
                    etiqueta={
                        personalEnEdicion ? "Editar personal" : "Nuevo personal"
                    }
                >
                    <FormularioPersonal
                        personalEnEdicion={personalEnEdicion}
                        alCrear={manejarCrear}
                        alModificar={manejarModificar}
                        alCancelar={cerrarFormulario}
                        guardando={guardando}
                        errorServidor={errorFormulario}
                    />
                    {salidasBloqueantesEdicion.length > 0 ? (
                        <div className="px-6 pb-6">
                            <Alerta tipo="advertencia" titulo="Salidas que impiden el cambio">
                                <ul className="mt-1 space-y-2 text-xs">
                                    {salidasBloqueantesEdicion.map((s) => (
                                        <li
                                            key={s.idsalida}
                                            className="flex flex-wrap items-center justify-between gap-2"
                                        >
                                            <span>
                                                <strong>{s.nroSalida}</strong> (
                                                {formatearRangoFechasUtc(s.fechaInicio, s.fechaFin)})
                                            </span>
                                            <Link
                                                to={`/gestion/salidas?reemplazarSalida=${s.idsalida}`}
                                                onClick={cerrarFormulario}
                                                className="rounded-control border border-marca bg-white px-2.5 py-1 font-semibold text-marca transition-colors hover:bg-marca hover:text-white"
                                            >
                                                Reemplazar en la salida
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </Alerta>
                        </div>
                    ) : null}
                </Modal>
            ) : null}

            {ultimoRegistro ? (
                <Alerta tipo="exito" titulo={ultimoRegistro.mensaje}>
                    {ultimoRegistro.credencialesAcceso ? (
                        <>
                            Se creó el legajo de guía de{" "}
                            <span className="font-semibold">
                                {ultimoRegistro.perfilOperativo.nombreCompleto}
                            </span>{" "}
                            junto con su cuenta de acceso{" "}
                            <span className="font-semibold">
                                {ultimoRegistro.credencialesAcceso.email}
                            </span>{" "}
                            (rol {ultimoRegistro.credencialesAcceso.rol}).
                        </>
                    ) : (
                        <>
                            Se creó el legajo operativo de{" "}
                            <span className="font-semibold">
                                {ultimoRegistro.perfilOperativo.nombreCompleto}
                            </span>{" "}
                            ({ultimoRegistro.perfilOperativo.rol}).
                        </>
                    )}
                </Alerta>
            ) : null}

            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja al personal">
                    <div className="space-y-2">
                        <p>{darDeBaja.error.message}</p>
                        {(() => {
                            const salidasBloq = extraerSalidasBloqueantes(darDeBaja.error);
                            if (salidasBloq.length === 0) return null;
                            return (
                                <ul className="space-y-1.5 border-t border-rose-200 pt-2 text-xs">
                                    {salidasBloq.map((s) => (
                                        <li
                                            key={s.idsalida}
                                            className="flex flex-wrap items-center justify-between gap-2"
                                        >
                                            <span>
                                                <strong>{s.nroSalida}</strong> ·{" "}
                                                {formatearRangoFechasUtc(s.fechaInicio, s.fechaFin)}
                                            </span>
                                            <Link
                                                to={`/gestion/salidas?reemplazarSalida=${s.idsalida}`}
                                                className="rounded-control border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-900 transition-colors hover:bg-rose-100"
                                            >
                                                Reemplazar en la salida
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            );
                        })()}
                    </div>
                </Alerta>
            ) : null}

            {/* 4 TARJETAS KPI CLICABLES */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                    type="button"
                    aria-pressed={filtroRol === "Guía" && !soloEnSalida && !soloVencidos}
                    onClick={() => {
                        setSoloEnSalida(false);
                        setSoloVencidos(false);
                        setFiltroRol((prev) => (prev === "Guía" ? "" : "Guía"));
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroRol === "Guía" && !soloEnSalida && !soloVencidos
                            ? "border-sky-400 bg-sky-50/50 ring-2 ring-sky-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Guías activos
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.guiasActivos}
                            {metricas.guiasTotal !== metricas.guiasActivos ? (
                                <span className="ml-1.5 text-xs font-medium text-texto-suave">
                                    / {metricas.guiasTotal}
                                </span>
                            ) : null}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            Con habilitación oficial
                        </p>
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-500/25">
                        <IconoGuia />
                    </span>
                </button>

                <button
                    type="button"
                    aria-pressed={filtroRol === "Porteador" && !soloEnSalida && !soloVencidos}
                    onClick={() => {
                        setSoloEnSalida(false);
                        setSoloVencidos(false);
                        setFiltroHabilitacion("");
                        setFiltroRol((prev) => (prev === "Porteador" ? "" : "Porteador"));
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroRol === "Porteador" && !soloEnSalida && !soloVencidos
                            ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Porteadores activos
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.porteadoresActivos}
                            {metricas.porteadoresTotal !== metricas.porteadoresActivos ? (
                                <span className="ml-1.5 text-xs font-medium text-texto-suave">
                                    / {metricas.porteadoresTotal}
                                </span>
                            ) : null}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            Soporte logístico en ruta
                        </p>
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-500/25">
                        <IconoPorteador />
                    </span>
                </button>

                <button
                    type="button"
                    aria-pressed={soloEnSalida}
                    onClick={() => {
                        setSoloVencidos(false);
                        setSoloEnSalida((prev) => !prev);
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        soloEnSalida
                            ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            En salida ahora
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.enSalida}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricas.enSalida > 0 ? (
                                <span className="font-semibold text-emerald-700">
                                    Operando en terreno
                                </span>
                            ) : (
                                "Sin salidas en curso"
                            )}
                        </p>
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <span
                            className={`size-2.5 rounded-full ${
                                metricas.enSalida > 0
                                    ? "animate-pulse bg-emerald-500"
                                    : "bg-emerald-300"
                            }`}
                        />
                    </span>
                </button>

                <button
                    type="button"
                    aria-pressed={soloVencidos}
                    onClick={() => {
                        setSoloEnSalida(false);
                        setSoloVencidos((prev) => !prev);
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        soloVencidos
                            ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Doc. vencida
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.conVencidos}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricas.conVencidos > 0 ? (
                                <span className="font-semibold text-rose-700">
                                    Pasaporte o habilitación
                                </span>
                            ) : (
                                <span className="font-medium text-emerald-700">
                                    Todo vigente
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ring-1 ring-inset ${
                            metricas.conVencidos > 0
                                ? "bg-rose-50 text-rose-700 ring-rose-500/25"
                                : "bg-fondo text-texto-suave ring-borde"
                        }`}
                    >
                        {metricas.conVencidos > 0 ? "!" : "✓"}
                    </span>
                </button>
            </div>

            {/* BARRA DE HERRAMIENTAS COMPACTA */}
            <div className="rounded-2xl border border-borde/80 bg-white p-3.5 shadow-[0_4px_16px_-8px_rgba(18,61,112,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* PÍLDORA SEGMENTADA DE ROLES */}
                    <div
                        role="tablist"
                        aria-label="Filtrar personal por rol"
                        className="inline-flex items-center gap-0.5 rounded-full bg-fondo p-1 ring-1 ring-borde/80"
                    >
                        {(
                            [
                                { valor: "" as const, etiqueta: "Todos" },
                                { valor: "Guía" as const, etiqueta: "Guías" },
                                { valor: "Porteador" as const, etiqueta: "Porteadores" },
                            ] as const
                        ).map((op) => {
                            const activo = filtroRol === op.valor;
                            return (
                                <button
                                    key={op.etiqueta}
                                    type="button"
                                    role="tab"
                                    aria-selected={activo}
                                    onClick={() => {
                                        setFiltroRol(op.valor);
                                        if (op.valor === "Porteador") {
                                            setFiltroHabilitacion("");
                                        }
                                        setPaginaActual(1);
                                    }}
                                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                        activo
                                            ? "bg-white text-navegacion shadow-2xs ring-1 ring-navegacion/[0.06]"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    {op.etiqueta}
                                </button>
                            );
                        })}
                    </div>

                    {/* BUSCADOR + FILTROS + SWITCH VISTA */}
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                        <div className="relative min-w-[210px] flex-1 sm:w-64 sm:flex-initial">
                            <label htmlFor="buscar-personal" className="sr-only">
                                Buscar personal
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
                                id="buscar-personal"
                                type="search"
                                value={busqueda}
                                onChange={(evento) => {
                                    setBusqueda(evento.target.value);
                                    setPaginaActual(1);
                                }}
                                placeholder="Nombre, pasaporte o habilitación..."
                                className="w-full rounded-xl border border-borde bg-fondo/50 py-2 pl-9 pr-3 text-xs font-medium text-navegacion outline-none placeholder:text-texto-suave/70 transition focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15"
                            />
                        </div>

                        <label htmlFor="filtro-estado-personal" className="sr-only">
                            Filtrar por estado
                        </label>
                        <select
                            id="filtro-estado-personal"
                            value={filtroEstado}
                            onChange={(evento) => {
                                setFiltroEstado(evento.target.value as EstadoPersonal | "");
                                setPaginaActual(1);
                            }}
                            className="rounded-xl border border-borde bg-white px-3 py-2 text-xs font-semibold text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                        >
                            <option value="">Todos los estados</option>
                            <option value="ACTIVO">Activos</option>
                            <option value="INACTIVO">Inactivos</option>
                        </select>

                        <label htmlFor="filtro-habilitacion-personal" className="sr-only">
                            Filtrar por habilitación de guías
                        </label>
                        <select
                            id="filtro-habilitacion-personal"
                            value={filtroHabilitacion}
                            disabled={filtroRol === "Porteador"}
                            onChange={(evento) => {
                                setFiltroHabilitacion(
                                    evento.target.value as "" | "true" | "false",
                                );
                                setPaginaActual(1);
                            }}
                            className="rounded-xl border border-borde bg-white px-3 py-2 text-xs font-semibold text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Habilitación: todas</option>
                            <option value="true">Habilitación vigente</option>
                            <option value="false">Habilitación vencida</option>
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

                        {hayFiltrosActivos ? (
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

                {soloEnSalida || soloVencidos ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-borde/60 pt-2.5 text-xs">
                        {soloEnSalida ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                                Mostrando personal en salida en curso
                                <button
                                    type="button"
                                    onClick={() => setSoloEnSalida(false)}
                                    className="cursor-pointer text-emerald-700 hover:text-emerald-950"
                                    aria-label="Quitar filtro en salida"
                                >
                                    ✕
                                </button>
                            </span>
                        ) : null}
                        {soloVencidos ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-800 ring-1 ring-inset ring-rose-500/25">
                                Mostrando personal activo con documentación vencida
                                <button
                                    type="button"
                                    onClick={() => setSoloVencidos(false)}
                                    className="cursor-pointer text-rose-700 hover:text-rose-950"
                                    aria-label="Quitar filtro documentación vencida"
                                >
                                    ✕
                                </button>
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* CONTENIDO */}
            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : sinResultados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={
                        hayFiltrosActivos
                            ? "No se encontró personal que coincida con los filtros seleccionados."
                            : "Todavía no hay personal operativo registrado."
                    }
                />
            ) : vistaPresentacion === "tarjetas" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {personalPaginado.map((persona) => {
                        const esGuia = persona.rol === "Guía";
                        const esActivo = persona.estado === "ACTIVO";
                        const pasaporteVigente = esFechaFuturaOVigente(
                            persona.fechaVencimientoPasaporte,
                        );
                        const habVigente = persona.guia
                            ? esFechaFuturaOVigente(persona.guia.fechaHabilitacion)
                            : true;
                        const docVencida = esActivo && (!pasaporteVigente || !habVigente);

                        const colorBarra = !esActivo
                            ? "bg-slate-300"
                            : docVencida
                              ? "bg-rose-500"
                              : esGuia
                                ? "bg-sky-500"
                                : "bg-amber-500";

                        return (
                            <article
                                key={persona.idpersonal}
                                className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:border-navegacion/25 hover:shadow-[0_14px_30px_-14px_rgba(18,61,112,0.2)] ${
                                    !esActivo
                                        ? "border-borde/70 opacity-80"
                                        : docVencida
                                          ? "border-rose-300/80"
                                          : "border-borde/80"
                                }`}
                            >
                                {/* FRANJA DE COLOR POR ROL / ALERTA */}
                                <div className={`h-1.5 w-full ${colorBarra}`} />

                                <div className="flex flex-1 flex-col p-5">
                                    {/* CABECERA: AVATAR + NOMBRE + ROL + ESTADO */}
                                    <div className="flex items-start gap-3.5">
                                        <div
                                            className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold tracking-tight ${
                                                !esActivo
                                                    ? "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
                                                    : esGuia
                                                      ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/25"
                                                      : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25"
                                            }`}
                                        >
                                            {obtenerIniciales(persona.nombreCompleto)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                        !esActivo
                                                            ? "bg-slate-100 text-slate-600"
                                                            : esGuia
                                                              ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/25"
                                                              : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25"
                                                    }`}
                                                >
                                                    {persona.rol}
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
                                                    {etiquetaEstadoRegistro(persona.estado)}
                                                </span>
                                            </div>

                                            <h2 className="mt-1.5 truncate text-base font-bold tracking-tight text-navegacion">
                                                {persona.nombreCompleto}
                                            </h2>

                                            {persona.salidaEnCurso ? (
                                                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                                                    <span
                                                        className="size-1.5 animate-pulse rounded-full bg-emerald-500"
                                                        aria-hidden="true"
                                                    />
                                                    En salida {persona.salidaEnCurso}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* BLOQUE DOCUMENTACIÓN */}
                                    <div className="mt-4 space-y-2 rounded-xl border border-borde/70 bg-fondo/50 p-3 text-xs">
                                        {/* PASAPORTE */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="inline-flex items-center gap-1.5 font-semibold text-texto">
                                                    <span className="text-texto-suave">
                                                        <IconoPasaporte />
                                                    </span>
                                                    <span className="font-mono">
                                                        {persona.nroPasaporte}
                                                    </span>
                                                    <span className="font-normal text-texto-suave">
                                                        · {persona.nacionalidad}
                                                    </span>
                                                </p>
                                                <p className="mt-0.5 pl-5 text-[11px] text-texto-suave">
                                                    Pasaporte vence{" "}
                                                    {formatearFechaSalida(
                                                        persona.fechaVencimientoPasaporte,
                                                    )}
                                                </p>
                                            </div>
                                            {!pasaporteVigente ? (
                                                <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">
                                                    Vencido
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* HABILITACIÓN (GUÍAS) */}
                                        <div className="border-t border-borde/60 pt-2">
                                            {persona.guia ? (
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="inline-flex items-center gap-1.5 font-semibold text-texto">
                                                            <span className="text-texto-suave">
                                                                <IconoCredencial />
                                                            </span>
                                                            <span className="font-mono">
                                                                {persona.guia.nroHabilitacion}
                                                            </span>
                                                        </p>
                                                        <p className="mt-0.5 pl-5 text-[11px] text-texto-suave">
                                                            Habilitación vence{" "}
                                                            {formatearFechaSalida(
                                                                persona.guia.fechaHabilitacion,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                                                            habVigente
                                                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                                                : "bg-rose-100 text-rose-800"
                                                        }`}
                                                    >
                                                        {etiquetaHabilitacion(
                                                            habVigente ? "VIGENTE" : "VENCIDA",
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-texto-suave">
                                                    Rol de soporte en ruta · no requiere habilitación de guía
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* ACCIONES */}
                                    <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-borde/70 pt-3.5">
                                        <button
                                            type="button"
                                            aria-label={`Editar a ${persona.nombreCompleto}`}
                                            onClick={() => abrirFormulario(persona)}
                                            disabled={!esActivo}
                                            title={
                                                !esActivo
                                                    ? "No se puede modificar personal dado de baja"
                                                    : undefined
                                            }
                                            className="cursor-pointer rounded-xl border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Dar de baja a ${persona.nombreCompleto}`}
                                            onClick={() => {
                                                darDeBaja.reset();
                                                setPersonalSeleccionado(persona);
                                            }}
                                            disabled={!esActivo}
                                            title={
                                                !esActivo
                                                    ? "El personal ya está dado de baja"
                                                    : undefined
                                            }
                                            className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-peligro transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            Dar de baja
                                        </button>
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
                                    <th className="px-5 py-3.5">Personal</th>
                                    <th className="px-4 py-3.5">Rol</th>
                                    <th className="px-4 py-3.5">Pasaporte</th>
                                    <th className="px-4 py-3.5">Habilitación</th>
                                    <th className="px-4 py-3.5">Estado</th>
                                    <th className="px-5 py-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde/70">
                                {personalPaginado.map((persona) => {
                                    const esGuia = persona.rol === "Guía";
                                    const esActivo = persona.estado === "ACTIVO";
                                    const pasaporteVigente = esFechaFuturaOVigente(
                                        persona.fechaVencimientoPasaporte,
                                    );
                                    const habVigente = persona.guia
                                        ? esFechaFuturaOVigente(persona.guia.fechaHabilitacion)
                                        : true;

                                    return (
                                        <tr
                                            key={persona.idpersonal}
                                            className={`transition-colors hover:bg-fondo/45 ${
                                                esActivo ? "" : "opacity-75"
                                            }`}
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                                                            !esActivo
                                                                ? "bg-slate-100 text-slate-500"
                                                                : esGuia
                                                                  ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/25"
                                                                  : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25"
                                                        }`}
                                                    >
                                                        {obtenerIniciales(persona.nombreCompleto)}
                                                    </span>
                                                    <span className="font-bold text-navegacion">
                                                        {persona.nombreCompleto}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        esGuia
                                                            ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/25"
                                                            : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25"
                                                    }`}
                                                >
                                                    {persona.rol}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs">
                                                <p className="font-mono font-semibold text-texto">
                                                    {persona.nroPasaporte}
                                                    {!pasaporteVigente ? (
                                                        <span className="ml-1.5 font-sans font-bold text-peligro">
                                                            · Vencido
                                                        </span>
                                                    ) : null}
                                                </p>
                                                <p className="mt-0.5 text-texto-suave">
                                                    {persona.nacionalidad} · Vence{" "}
                                                    {formatearFechaSalida(
                                                        persona.fechaVencimientoPasaporte,
                                                    )}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5 text-xs">
                                                {persona.guia ? (
                                                    <div>
                                                        <p className="font-mono font-semibold text-texto">
                                                            {persona.guia.nroHabilitacion}{" "}
                                                            <span
                                                                className={`font-sans font-bold ${
                                                                    habVigente
                                                                        ? "text-emerald-700"
                                                                        : "text-peligro"
                                                                }`}
                                                            >
                                                                ·{" "}
                                                                {etiquetaHabilitacion(
                                                                    habVigente
                                                                        ? "VIGENTE"
                                                                        : "VENCIDA",
                                                                )}
                                                            </span>
                                                        </p>
                                                        <p className="mt-0.5 text-texto-suave">
                                                            Vence{" "}
                                                            {formatearFechaSalida(
                                                                persona.guia.fechaHabilitacion,
                                                            )}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-texto-suave">
                                                        No aplica
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-col items-start gap-1">
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
                                                        {etiquetaEstadoRegistro(persona.estado)}
                                                    </span>
                                                    {persona.salidaEnCurso ? (
                                                        <span className="text-xs font-semibold text-emerald-700">
                                                            En salida {persona.salidaEnCurso}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Editar a ${persona.nombreCompleto}`}
                                                        onClick={() => abrirFormulario(persona)}
                                                        disabled={!esActivo}
                                                        title={
                                                            !esActivo
                                                                ? "No se puede modificar personal dado de baja"
                                                                : undefined
                                                        }
                                                        className="cursor-pointer rounded-xl border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Dar de baja a ${persona.nombreCompleto}`}
                                                        onClick={() => {
                                                            darDeBaja.reset();
                                                            setPersonalSeleccionado(persona);
                                                        }}
                                                        disabled={!esActivo}
                                                        title={
                                                            !esActivo
                                                                ? "El personal ya está dado de baja"
                                                                : undefined
                                                        }
                                                        className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-peligro transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                                                    >
                                                        Dar de baja
                                                    </button>
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

            {estado === "exito" && personalFiltrado.length > 0 ? (
                <Paginacion
                    paginaActual={paginaValida}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={personalSeleccionado !== null}
                titulo="Confirmar baja de personal"
                descripcion={
                    personalSeleccionado
                        ? `¿Estás seguro de que querés dar de baja a ${personalSeleccionado.nombreCompleto}?${
                              personalSeleccionado.rol === "Guía"
                                  ? " También se desactivará su cuenta de acceso."
                                  : ""
                          }`
                        : ""
                }
                textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"}
                cargando={darDeBaja.isPending}
                onConfirmar={confirmarBaja}
                onCancelar={() => setPersonalSeleccionado(null)}
            />
        </section>
    );
}

export default PersonalPage;
