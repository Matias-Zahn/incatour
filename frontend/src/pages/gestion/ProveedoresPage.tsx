import { useState } from "react";
import type { FormEvent } from "react";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";

type EstadoListadoTipo = "cargando" | "vacio" | "error" | "exito";

type Proveedor = {
    id: number;
    nombre: string;
    contacto: string;
};

type FormularioProveedor = {
    nombre: string;
    contacto: string;
};

const proveedoresIniciales: Proveedor[] = [
    { id: 1, nombre: "Andes Travel", contacto: "contacto@andes.com" },
    { id: 2, nombre: "Camino Inca Tours", contacto: "info@caminoinca.com" },
];

const formularioInicial: FormularioProveedor = {
    nombre: "",
    contacto: "",
};

function ProveedoresPage() {
    const [proveedores, setProveedores] = useState(proveedoresIniciales);
    const [estado, setEstado] = useState<EstadoListadoTipo>("exito");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [formulario, setFormulario] = useState(formularioInicial);
    const [proveedorEnEdicion, setProveedorEnEdicion] =
        useState<Proveedor | null>(null);
    const [proveedorSeleccionado, setProveedorSeleccionado] =
        useState<Proveedor | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");

    function abrirFormulario(proveedor?: Proveedor) {
        setProveedorEnEdicion(proveedor ?? null);
        setFormulario(
            proveedor
                ? { nombre: proveedor.nombre, contacto: proveedor.contacto }
                : formularioInicial,
        );
        setErrorFormulario("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setProveedorEnEdicion(null);
        setFormulario(formularioInicial);
        setErrorFormulario("");
    }

    function actualizarCampo(
        campo: keyof FormularioProveedor,
        valor: string,
    ) {
        setFormulario((actual) => ({ ...actual, [campo]: valor }));
        setErrorFormulario("");
    }

    function guardarProveedor(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        const nombre = formulario.nombre.trim();
        const contacto = formulario.contacto.trim();

        if (!nombre || !contacto) {
            setErrorFormulario("Completá el nombre y el correo de contacto.");
            return;
        }

        if (proveedorEnEdicion) {
            setProveedores((actuales) =>
                actuales.map((proveedor) =>
                    proveedor.id === proveedorEnEdicion.id
                        ? { ...proveedor, nombre, contacto }
                        : proveedor,
                ),
            );
        } else {
            setProveedores((actuales) => [
                ...actuales,
                {
                    id: Math.max(0, ...actuales.map((proveedor) => proveedor.id)) + 1,
                    nombre,
                    contacto,
                },
            ]);
        }

        setEstado("exito");
        cerrarFormulario();
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

        setProveedores((actuales) =>
            actuales.filter(
                (proveedor) => proveedor.id !== proveedorSeleccionado.id,
            ),
        );
        setProveedorSeleccionado(null);
        setPaginaActual(1);
    }

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
                <form
                    className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
                    onSubmit={guardarProveedor}
                >
                    <div className="mb-5">
                        <h2 className="font-bold text-navegacion">
                            {proveedorEnEdicion
                                ? "Editar proveedor"
                                : "Registrar proveedor"}
                        </h2>
                        <p className="mt-1 text-sm text-texto-suave">
                            Ingresá los datos principales del proveedor.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Nombre
                            <input
                                className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                value={formulario.nombre}
                                onChange={(evento) =>
                                    actualizarCampo("nombre", evento.target.value)
                                }
                                placeholder="Ej. Andes Travel"
                                autoFocus
                            />
                        </label>

                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Correo de contacto
                            <input
                                type="email"
                                className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                value={formulario.contacto}
                                onChange={(evento) =>
                                    actualizarCampo(
                                        "contacto",
                                        evento.target.value,
                                    )
                                }
                                placeholder="contacto@proveedor.com"
                            />
                        </label>
                    </div>

                    {errorFormulario ? (
                        <p className="mt-3 text-sm text-peligro" role="alert">
                            {errorFormulario}
                        </p>
                    ) : null}

                    <div className="mt-6 flex justify-end gap-3">
                        <Boton
                            variante="secundario"
                            onClick={cerrarFormulario}
                        >
                            Cancelar
                        </Boton>
                        <Boton type="submit">
                            {proveedorEnEdicion ? "Guardar cambios" : "Registrar proveedor"}
                        </Boton>
                    </div>
                </form>
            ) : null}

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={
                        estado === "vacio"
                            ? "Todavía no hay proveedores registrados."
                            : undefined
                    }
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
                textoConfirmar="Dar de baja"
                onConfirmar={confirmarBaja}
                onCancelar={cancelarBaja}
            />
        </section>
    );
}

export default ProveedoresPage;
