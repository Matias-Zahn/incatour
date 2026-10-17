import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioTemporada from "../../components/FormularioTemporada";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    useDarDeBajaTemporada,
    useModificarTemporada,
    useRegistrarTemporada,
    useTemporadas,
    type DatosTemporada,
    type Temporada,
} from "../../services/temporadaService";

const ELEMENTOS_POR_PAGINA = 5;

function formatearFecha(iso: string): string {
    const fechaIso = iso.slice(0, 10);
    const partes = fechaIso.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return iso;
}

function estiloEstado(estado: Temporada["estado"]): string {
    return estado === "ACTIVO"
        ? "bg-green-50 text-exito"
        : "bg-slate-100 text-texto-suave";
}

function TemporadasPage() {
    const {
        data: temporadas = [],
        isPending,
        isError,
        error,
    } = useTemporadas();
    const registrar = useRegistrarTemporada();
    const modificar = useModificarTemporada();
    const darDeBaja = useDarDeBajaTemporada();
    const guardando = registrar.isPending || modificar.isPending;

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [temporadaEnEdicion, setTemporadaEnEdicion] =
        useState<Temporada | null>(null);
    const [temporadaSeleccionada, setTemporadaSeleccionada] =
        useState<Temporada | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [errorBaja, setErrorBaja] = useState("");

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirFormulario(temporada?: Temporada) {
        setTemporadaEnEdicion(temporada ?? null);
        setErrorFormulario("");
        setErrorBaja("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setTemporadaEnEdicion(null);
        setErrorFormulario("");
    }

    function guardarTemporada(datos: DatosTemporada) {
        const opciones = {
            onSuccess: cerrarFormulario,
            onError: (e: Error) => setErrorFormulario(e.message),
        };

        if (temporadaEnEdicion) {
            modificar.mutate(
                { id: temporadaEnEdicion.idtemporada, datos },
                opciones,
            );
        } else {
            registrar.mutate(datos, opciones);
        }
    }

    function abrirDialogoBaja(temporada: Temporada) {
        setErrorBaja("");
        setTemporadaSeleccionada(temporada);
    }

    function cancelarBaja() {
        setTemporadaSeleccionada(null);
    }

    function confirmarBaja() {
        if (!temporadaSeleccionada) {
            return;
        }

        darDeBaja.mutate(temporadaSeleccionada.idtemporada, {
            onSuccess: () => {
                setTemporadaSeleccionada(null);
                setPaginaActual(1);
            },
            onError: (e: Error) => {
                setTemporadaSeleccionada(null);
                setErrorBaja(e.message);
            },
        });
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const temporadasFiltradas = temporadas.filter((temporada) => {
        if (!terminoLimpio) return true;
        return (
            temporada.nombre.toLowerCase().includes(terminoLimpio) ||
            formatearFecha(temporada.fechaInicio).includes(terminoLimpio) ||
            formatearFecha(temporada.fechaFin).includes(terminoLimpio)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(temporadasFiltradas.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const temporadasPaginadas = temporadasFiltradas.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinTemporadasRegistradas =
        estado === "exito" && temporadas.length === 0;
    const sinResultadosBusqueda =
        estado === "exito" &&
        temporadas.length > 0 &&
        temporadasFiltradas.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-borde pb-3">
                <Link
                    to="/gestion/circuitos"
                    className="rounded-control px-3.5 py-1.5 text-sm font-semibold text-texto-suave hover:bg-white hover:text-texto"
                >
                    Circuitos y etapas
                </Link>
                <Link
                    to="/gestion/temporadas"
                    className="rounded-control bg-marca text-white px-3.5 py-1.5 text-sm font-semibold shadow-sm"
                >
                    Temporadas
                </Link>
            </div>

            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Catálogo turístico
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Temporadas
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Administrá las temporadas comerciales utilizadas en los cuadros tarifarios de los paquetes.
                    </p>
                </div>

                <Boton onClick={() => abrirFormulario()}>
                    Nueva temporada
                </Boton>
            </header>

            {formularioAbierto ? (
                <FormularioTemporada
                    temporadaEnEdicion={temporadaEnEdicion}
                    alGuardar={guardarTemporada}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
            ) : null}

            {errorBaja ? (
                <Alerta
                    tipo="error"
                    titulo="No se pudo dar de baja la temporada"
                >
                    {errorBaja}
                </Alerta>
            ) : null}

            {estado === "exito" && temporadas.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-md">
                        <label htmlFor="buscar-temporada" className="sr-only">
                            Buscar temporada
                        </label>
                        <input
                            id="buscar-temporada"
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                manejarCambioBusqueda(evento.target.value)
                            }
                            placeholder="Buscar por nombre o fecha (dd/mm/aaaa)..."
                            className="w-full rounded-control border border-borde bg-white px-3.5 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </div>

                    {busqueda ? (
                        <Boton
                            variante="fantasma"
                            className="self-start text-xs text-texto-suave sm:self-auto"
                            onClick={() => manejarCambioBusqueda("")}
                        >
                            Limpiar búsqueda
                        </Boton>
                    ) : null}
                </div>
            ) : null}

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : sinTemporadasRegistradas ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Todavía no hay temporadas registradas."
                />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron temporadas que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={temporadasPaginadas}
                        columnas={[
                            {
                                clave: "nombre",
                                titulo: "Temporada",
                                renderizar: (temporada) => (
                                    <span className="font-semibold text-texto">
                                        {temporada.nombre}
                                    </span>
                                ),
                            },
                            {
                                clave: "fechaInicio",
                                titulo: "Fecha de inicio",
                                renderizar: (temporada) =>
                                    formatearFecha(temporada.fechaInicio),
                            },
                            {
                                clave: "fechaFin",
                                titulo: "Fecha de fin",
                                renderizar: (temporada) =>
                                    formatearFecha(temporada.fechaFin),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                                renderizar: (temporada) => (
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                            temporada.estado,
                                        )}`}
                                    >
                                        {temporada.estado}
                                    </span>
                                ),
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (temporada) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                temporada.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirFormulario(temporada)
                                            }
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                temporada.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirDialogoBaja(temporada)
                                            }
                                        >
                                            Dar de baja
                                        </Boton>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            )}

            {estado === "exito" && temporadasFiltradas.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={temporadaSeleccionada !== null}
                titulo="Confirmar baja de temporada"
                descripcion={
                    temporadaSeleccionada
                        ? `¿Estás seguro de que querés dar de baja la temporada "${temporadaSeleccionada.nombre}"?`
                        : ""
                }
                textoConfirmar={
                    darDeBaja.isPending ? "Procesando..." : "Dar de baja"
                }
                cargando={darDeBaja.isPending}
                onConfirmar={confirmarBaja}
                onCancelar={cancelarBaja}
            />
        </section>
    );
}

export default TemporadasPage;
