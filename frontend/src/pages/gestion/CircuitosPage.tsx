import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioCircuito from "../../components/FormularioCircuito";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    useCircuitos,
    useDarDeBajaCircuito,
    useModificarCircuito,
    useRegistrarCircuito,
    type Circuito,
    type DatosCircuito,
} from "../../services/circuitoService";

const ELEMENTOS_POR_PAGINA = 5;

function estiloDificultad(dificultad: string): string {
    const clave = dificultad.trim().toUpperCase();
    if (clave.includes("ALTA")) {
        return "bg-peligro/10 text-peligro";
    }
    if (clave.includes("BAJA")) {
        return "bg-green-50 text-exito";
    }
    return "bg-amber-50 text-advertencia";
}

function estiloEstado(estado: Circuito["estado"]): string {
    return estado === "ACTIVO"
        ? "bg-green-50 text-exito"
        : "bg-slate-100 text-texto-suave";
}

function CircuitosPage() {
    const { data: circuitos = [], isPending, isError, error } = useCircuitos();
    const registrar = useRegistrarCircuito();
    const modificar = useModificarCircuito();
    const darDeBaja = useDarDeBajaCircuito();
    const guardando = registrar.isPending || modificar.isPending;

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [circuitoEnEdicion, setCircuitoEnEdicion] = useState<Circuito | null>(
        null,
    );
    const [circuitoSeleccionado, setCircuitoSeleccionado] =
        useState<Circuito | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [errorBaja, setErrorBaja] = useState("");

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirFormulario(circuito?: Circuito) {
        setCircuitoEnEdicion(circuito ?? null);
        setErrorFormulario("");
        setErrorBaja("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setCircuitoEnEdicion(null);
        setErrorFormulario("");
    }

    function guardarCircuito(datos: DatosCircuito) {
        const opciones = {
            onSuccess: cerrarFormulario,
            onError: (e: Error) => setErrorFormulario(e.message),
        };

        if (circuitoEnEdicion) {
            modificar.mutate(
                { id: circuitoEnEdicion.idcircuito, datos },
                opciones,
            );
        } else {
            registrar.mutate(datos, opciones);
        }
    }

    function abrirDialogoBaja(circuito: Circuito) {
        setErrorBaja("");
        setCircuitoSeleccionado(circuito);
    }

    function cancelarBaja() {
        setCircuitoSeleccionado(null);
    }

    function confirmarBaja() {
        if (!circuitoSeleccionado) {
            return;
        }

        darDeBaja.mutate(circuitoSeleccionado.idcircuito, {
            onSuccess: () => {
                setCircuitoSeleccionado(null);
                setPaginaActual(1);
            },
            onError: (e: Error) => {
                setCircuitoSeleccionado(null);
                setErrorBaja(e.message);
            },
        });
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const circuitosFiltrados = circuitos.filter((circuito) => {
        if (!terminoLimpio) return true;
        return (
            circuito.nombreCircuito.toLowerCase().includes(terminoLimpio) ||
            circuito.dificultad.toLowerCase().includes(terminoLimpio) ||
            (circuito.parametrosPorteadores ?? "")
                .toLowerCase()
                .includes(terminoLimpio)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(circuitosFiltrados.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const circuitosPaginados = circuitosFiltrados.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinCircuitosRegistrados =
        estado === "exito" && circuitos.length === 0;
    const sinResultadosBusqueda =
        estado === "exito" &&
        circuitos.length > 0 &&
        circuitosFiltrados.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-borde pb-3">
                <Link
                    to="/gestion/circuitos"
                    className="rounded-control bg-marca text-white px-3.5 py-1.5 text-sm font-semibold shadow-sm"
                >
                    Circuitos y etapas
                </Link>
                <Link
                    to="/gestion/temporadas"
                    className="rounded-control px-3.5 py-1.5 text-sm font-semibold text-texto-suave hover:bg-white hover:text-texto"
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
                        Circuitos
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Administrá los circuitos turísticos, su duración, dificultad, etapas de ruta y dotación operativa.
                    </p>
                </div>

                <Boton onClick={() => abrirFormulario()}>
                    Nuevo circuito
                </Boton>
            </header>

            {formularioAbierto ? (
                <FormularioCircuito
                    circuitoEnEdicion={circuitoEnEdicion}
                    alGuardar={guardarCircuito}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
            ) : null}

            {errorBaja ? (
                <Alerta
                    tipo="error"
                    titulo="No se pudo dar de baja el circuito"
                >
                    {errorBaja}
                </Alerta>
            ) : null}

            {estado === "exito" && circuitos.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-md">
                        <label htmlFor="buscar-circuito" className="sr-only">
                            Buscar circuito
                        </label>
                        <input
                            id="buscar-circuito"
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                manejarCambioBusqueda(evento.target.value)
                            }
                            placeholder="Buscar por nombre, dificultad o porteadores..."
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
            ) : sinCircuitosRegistrados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Todavía no hay circuitos turísticos registrados."
                />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron circuitos que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={circuitosPaginados}
                        columnas={[
                            {
                                clave: "nombreCircuito",
                                titulo: "Circuito",
                                renderizar: (circuito) => (
                                    <div>
                                        <p className="font-semibold text-texto">
                                            {circuito.nombreCircuito}
                                        </p>
                                        <p className="mt-0.5 text-xs text-texto-suave">
                                            {circuito.etapas &&
                                            circuito.etapas.length > 0
                                                ? `${circuito.etapas.length} ${
                                                      circuito.etapas.length ===
                                                      1
                                                          ? "etapa cargada"
                                                          : "etapas cargadas"
                                                  }`
                                                : "Sin etapas cargadas"}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "duracionDias",
                                titulo: "Duración",
                                renderizar: (circuito) =>
                                    `${circuito.duracionDias} ${
                                        circuito.duracionDias === 1
                                            ? "día"
                                            : "días"
                                    }`,
                            },
                            {
                                clave: "dificultad",
                                titulo: "Dificultad",
                                renderizar: (circuito) => (
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloDificultad(
                                            circuito.dificultad,
                                        )}`}
                                    >
                                        {circuito.dificultad}
                                    </span>
                                ),
                            },
                            {
                                clave: "minimoGuias",
                                titulo: "Mín. guías",
                            },
                            {
                                clave: "parametrosPorteadores",
                                titulo: "Porteadores",
                                renderizar: (circuito) => (
                                    <span className="text-sm text-texto-suave">
                                        {circuito.parametrosPorteadores ||
                                            "Sin especificar"}
                                    </span>
                                ),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                                renderizar: (circuito) => (
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                            circuito.estado,
                                        )}`}
                                    >
                                        {circuito.estado}
                                    </span>
                                ),
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (circuito) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            to={`/gestion/circuitos/${circuito.idcircuito}/etapas`}
                                            className="inline-flex items-center justify-center rounded-control border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-texto shadow-sm transition-colors hover:bg-fondo"
                                        >
                                            Etapas
                                        </Link>
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                circuito.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirFormulario(circuito)
                                            }
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                circuito.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirDialogoBaja(circuito)
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

            {estado === "exito" && circuitosFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={circuitoSeleccionado !== null}
                titulo="Confirmar baja de circuito"
                descripcion={
                    circuitoSeleccionado
                        ? `¿Estás seguro de que querés dar de baja el circuito "${circuitoSeleccionado.nombreCircuito}"?`
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

export default CircuitosPage;
