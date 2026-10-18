import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioProveedor from "../../components/FormularioProveedor";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    useDarDeBajaProveedor,
    useModificarProveedor,
    useProveedores,
    useRegistrarProveedor,
} from "../../services/proveedorService";
import { tiposProveedor } from "../../services/proveedorService";
import type {
    DatosProveedor,
    FiltrosProveedor,
    Proveedor,
} from "../../services/proveedorService";

const ELEMENTOS_POR_PAGINA = 5;

function ProveedoresPage() {
    const [filtroTipo, setFiltroTipo] = useState<FiltrosProveedor["tipoProveedor"]>();
    const [filtroEstado, setFiltroEstado] = useState<FiltrosProveedor["estado"]>();
    const hayFiltros = Boolean(filtroTipo ?? filtroEstado);
    const { data: proveedores = [], isPending, isError, error } = useProveedores({
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
        modificar.mutate({ idproveedor: proveedor.idproveedor, datos: { estado: "ACTIVO" } });
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

    const terminoLimpio = busqueda.trim().toLowerCase();
    const proveedoresFiltrados = proveedores.filter((proveedor) => {
        if (!terminoLimpio) return true;
        return (
            proveedor.razonSocial.toLowerCase().includes(terminoLimpio) ||
            proveedor.localidad.toLowerCase().includes(terminoLimpio) ||
            proveedor.datosContacto.toLowerCase().includes(terminoLimpio)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(proveedoresFiltrados.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
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
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de proveedores
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Proveedores
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Administrá los prestadores que forman parte de IncaTour.
                    </p>
                </div>

                <Boton onClick={() => abrirFormulario()}>
                    Nuevo proveedor
                </Boton>
            </header>

            {formularioAbierto ? (
                <FormularioProveedor
                    proveedorEnEdicion={proveedorEnEdicion}
                    alGuardar={guardarProveedor}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
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

            {estado === "exito" && (proveedores.length > 0 || hayFiltros) ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative w-full max-w-md">
                        <label htmlFor="buscar-proveedor" className="sr-only">
                            Buscar proveedor
                        </label>
                        <input
                            id="buscar-proveedor"
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                manejarCambioBusqueda(evento.target.value)
                            }
                            placeholder="Buscar por razón social, localidad o contacto..."
                            className="w-full rounded-control border border-borde bg-white px-3.5 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
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
                                (evento.target.value || undefined) as FiltrosProveedor["tipoProveedor"],
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los rubros</option>
                        {tiposProveedor.map((tipo) => (
                            <option key={tipo} value={tipo}>
                                {tipo}
                            </option>
                        ))}
                    </select>

                    <label htmlFor="filtro-estado" className="sr-only">
                        Filtrar por estado
                    </label>
                    <select
                        id="filtro-estado"
                        value={filtroEstado ?? ""}
                        onChange={(evento) => {
                            setFiltroEstado(
                                (evento.target.value || undefined) as FiltrosProveedor["estado"],
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los estados</option>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                    </select>

                    {busqueda || hayFiltros ? (
                        <Boton
                            variante="fantasma"
                            className="self-start text-xs text-texto-suave sm:self-auto"
                            onClick={() => {
                                manejarCambioBusqueda("");
                                setFiltroTipo(undefined);
                                setFiltroEstado(undefined);
                            }}
                        >
                            Limpiar filtros
                        </Boton>
                    ) : null}
                </div>
            ) : null}

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : sinProveedoresRegistrados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={mensajeVacio}
                />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron proveedores que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={proveedoresPaginados.map((proveedor) => ({
                            ...proveedor,
                            // Tabla (compartida) usa `id` como key de la fila.
                            id: proveedor.idproveedor,
                        }))}
                        columnas={[
                            {
                                clave: "razonSocial",
                                titulo: "Razón social",
                            },
                            {
                                clave: "tipoProveedor",
                                titulo: "Rubro",
                            },
                            {
                                clave: "localidad",
                                titulo: "Localidad",
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                            },
                            {
                                clave: "idproveedor",
                                titulo: "Acciones",
                                renderizar: (proveedor) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            to={`/gestion/proveedores/${proveedor.idproveedor}/servicios`}
                                            className="inline-flex items-center justify-center rounded-control bg-transparent px-3 py-1.5 text-xs font-semibold text-texto hover:bg-fondo focus-visible:outline-2 focus-visible:outline-marca"
                                        >
                                            Servicios
                                        </Link>
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() =>
                                                abrirFormulario(proveedor)
                                            }
                                        >
                                            Editar
                                        </Boton>
                                        {proveedor.estado === "INACTIVO" ? (
                                            <Boton
                                                variante="secundario"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => reactivarProveedor(proveedor)}
                                                disabled={modificar.isPending}
                                            >
                                                Reactivar
                                            </Boton>
                                        ) : (
                                            <Boton
                                                variante="peligro"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() =>
                                                    abrirDialogoBaja(proveedor)
                                                }
                                            >
                                                Dar de baja
                                            </Boton>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            )}

            {estado === "exito" && proveedoresFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
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
