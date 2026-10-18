import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioPersonal from "../../components/FormularioPersonal";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    rolesPersonal,
    useCrearPersonal,
    useDarDeBajaPersonal,
    useModificarPersonal,
    usePersonal,
    type DatosCrearPersonal,
    type DatosModificarPersonal,
    type EstadoPersonal,
    type FiltrosPersonal,
    type Personal,
    type RolPersonal,
} from "../../services/personalService";

const ELEMENTOS_POR_PAGINA = 5;

function PersonalPage() {
    const [filtroRol, setFiltroRol] = useState<RolPersonal | "">("");
    const [filtroEstado, setFiltroEstado] = useState<EstadoPersonal | "">("");
    const [filtroHabilitacion, setFiltroHabilitacion] = useState<"" | "true" | "false">("");
    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);

    const filtrosConsulta: FiltrosPersonal = {
        ...(filtroRol ? { rol: filtroRol } : {}),
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(filtroHabilitacion !== ""
            ? { habilitacionVigente: filtroHabilitacion === "true" }
            : {}),
    };

    const { data: listaPersonal = [], isPending, isError, error } = usePersonal(filtrosConsulta);
    const crear = useCrearPersonal();
    const modificar = useModificarPersonal();
    const darDeBaja = useDarDeBajaPersonal();
    const guardando = crear.isPending || modificar.isPending;

    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [personalEnEdicion, setPersonalEnEdicion] = useState<Personal | null>(null);
    const [personalSeleccionado, setPersonalSeleccionado] = useState<Personal | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");

    function abrirFormulario(persona?: Personal) {
        setPersonalEnEdicion(persona ?? null);
        setErrorFormulario("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setPersonalEnEdicion(null);
        setErrorFormulario("");
    }

    function manejarCrear(datos: DatosCrearPersonal) {
        crear.mutate(datos, {
            onSuccess: cerrarFormulario,
            onError: (e: Error) => setErrorFormulario(e.message),
        });
    }

    function manejarModificar(datos: DatosModificarPersonal) {
        if (!personalEnEdicion) return;
        modificar.mutate(
            { id: personalEnEdicion.idpersonal, datos },
            {
                onSuccess: cerrarFormulario,
                onError: (e: Error) => setErrorFormulario(e.message),
            },
        );
    }

    function confirmarBaja() {
        if (!personalSeleccionado) return;
        darDeBaja.mutate(personalSeleccionado.idpersonal, {
            onSuccess: () => {
                setPersonalSeleccionado(null);
                setPaginaActual(1);
            },
        });
    }

    function limpiarFiltros() {
        setFiltroRol("");
        setFiltroEstado("");
        setFiltroHabilitacion("");
        setBusqueda("");
        setPaginaActual(1);
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const personalFiltrado = listaPersonal.filter((persona) => {
        if (!terminoLimpio) return true;
        return (
            persona.nombreCompleto.toLowerCase().includes(terminoLimpio) ||
            persona.nroPasaporte.toLowerCase().includes(terminoLimpio) ||
            persona.nacionalidad.toLowerCase().includes(terminoLimpio) ||
            (persona.guia?.nroHabilitacion.toLowerCase().includes(terminoLimpio) ?? false)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(personalFiltrado.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const personalPaginado = personalFiltrado.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const hayFiltrosActivos =
        Boolean(filtroRol) ||
        Boolean(filtroEstado) ||
        Boolean(filtroHabilitacion) ||
        Boolean(terminoLimpio);

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinResultados = estado === "exito" && personalFiltrado.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de personal
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">Personal operativo</h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Administrá los legajos de guías y porteadores de IncaTour.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to="/gestion/cuentas-guia"
                        className="inline-flex items-center justify-center rounded-control border border-borde bg-white px-4 py-2 text-sm font-semibold text-texto transition-colors hover:bg-fondo focus-visible:outline-2 focus-visible:outline-marca"
                    >
                        Cuentas de guía
                    </Link>
                    <Boton onClick={() => abrirFormulario()}>Nuevo personal</Boton>
                </div>
            </header>

            {formularioAbierto ? (
                <FormularioPersonal
                    personalEnEdicion={personalEnEdicion}
                    alCrear={manejarCrear}
                    alModificar={manejarModificar}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
            ) : null}

            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja al personal">
                    {darDeBaja.error.message}
                </Alerta>
            ) : null}

            <div className="grid gap-3 rounded-tarjeta border border-borde bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Buscar por nombre, pasaporte o habilitación
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(evento) => {
                            setBusqueda(evento.target.value);
                            setPaginaActual(1);
                        }}
                        placeholder="Ej. Carlos o P123456..."
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Rol operativo
                    <select
                        value={filtroRol}
                        onChange={(evento) => {
                            setFiltroRol(evento.target.value as RolPersonal | "");
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los roles</option>
                        {rolesPersonal.map((rol) => (
                            <option key={rol} value={rol}>
                                {rol}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Estado
                    <select
                        value={filtroEstado}
                        onChange={(evento) => {
                            setFiltroEstado(evento.target.value as EstadoPersonal | "");
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los estados</option>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                    </select>
                </label>

                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Habilitación (solo guías)
                    <select
                        value={filtroHabilitacion}
                        onChange={(evento) => {
                            setFiltroHabilitacion(evento.target.value as "" | "true" | "false");
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todas</option>
                        <option value="true">Vigente</option>
                        <option value="false">Vencida</option>
                    </select>
                </label>

                {hayFiltrosActivos ? (
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
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
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={personalPaginado}
                        columnas={[
                            {
                                clave: "nombreCompleto",
                                titulo: "Nombre completo",
                            },
                            {
                                clave: "rol",
                                titulo: "Rol",
                            },
                            {
                                clave: "nroPasaporte",
                                titulo: "Pasaporte",
                                renderizar: (persona) => (
                                    <div>
                                        <p className="font-medium text-texto">{persona.nroPasaporte}</p>
                                        <p className="text-xs text-texto-suave">
                                            {persona.nacionalidad} · Vence {persona.fechaVencimientoPasaporte}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "guia",
                                titulo: "Habilitación",
                                renderizar: (persona) =>
                                    persona.guia ? (
                                        <div>
                                            <p className="font-medium text-texto">
                                                {persona.guia.nroHabilitacion}
                                            </p>
                                            <p className="text-xs text-texto-suave">
                                                Vence {persona.guia.fechaHabilitacion}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-texto-suave">No aplica</span>
                                    ),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                            },
                            {
                                clave: "idpersonal",
                                titulo: "Acciones",
                                renderizar: (persona) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => abrirFormulario(persona)}
                                            disabled={persona.estado === "INACTIVO"}
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => setPersonalSeleccionado(persona)}
                                            disabled={persona.estado === "INACTIVO"}
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

            {estado === "exito" && personalFiltrado.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
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
