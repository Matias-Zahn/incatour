import { useState } from "react";
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
import type { DatosProveedor, Proveedor } from "../../services/proveedorService";

const ELEMENTOS_POR_PAGINA = 5;

function ProveedoresPage() {
    const { data: proveedores = [], isPending, isError, error } = useProveedores();
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
            modificar.mutate(
                { id: proveedorEnEdicion.id, datos },
                opciones,
            );
        } else {
            registrar.mutate(datos, opciones);
        }
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

        darDeBaja.mutate(proveedorSeleccionado.id, {
            onSuccess: () => {
                setProveedorSeleccionado(null);
                setPaginaActual(1);
            },
        });
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const proveedoresFiltrados = proveedores.filter((proveedor) => {
        if (!terminoLimpio) return true;
        return (
            proveedor.nombre.toLowerCase().includes(terminoLimpio) ||
            proveedor.contacto.toLowerCase().includes(terminoLimpio)
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

            {estado === "exito" && proveedores.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            placeholder="Buscar por nombre o correo..."
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
            ) : sinProveedoresRegistrados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Todavía no hay proveedores registrados."
                />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron proveedores que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={proveedoresPaginados}
                        columnas={[
                            {
                                clave: "nombre",
                                titulo: "Proveedor",
                            },
                            {
                                clave: "contacto",
                                titulo: "Contacto",
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (proveedor) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() =>
                                                abrirFormulario(proveedor)
                                            }
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() =>
                                                abrirDialogoBaja(proveedor)
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
                        ? `¿Estás seguro de que querés dar de baja a ${proveedorSeleccionado.nombre}?`
                        : ""
                }
                textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"}
                onConfirmar={confirmarBaja}
                onCancelar={cancelarBaja}
            />
        </section>
    );
}

export default ProveedoresPage;

