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

function ProveedoresPage() {
    const { data: proveedores = [], isPending, isError, error } = useProveedores();
    const registrar = useRegistrarProveedor();
    const modificar = useModificarProveedor();
    const darDeBaja = useDarDeBajaProveedor();
    const guardando = registrar.isPending || modificar.isPending;
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [proveedorEnEdicion, setProveedorEnEdicion] =
        useState<Proveedor | null>(null);
    const [proveedorSeleccionado, setProveedorSeleccionado] =
        useState<Proveedor | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");

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

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const mostrarListadoVacio = estado === "exito" && proveedores.length === 0;

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

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : mostrarListadoVacio ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Todavía no hay proveedores registrados."
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={proveedores}
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

            {estado === "exito" && proveedores.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={1}
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
