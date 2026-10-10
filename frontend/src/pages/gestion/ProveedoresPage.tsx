import { useState } from "react";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";

type Estado = "cargando" | "vacio" | "error" | "exito";

const proveedores = [
    { id: 1, nombre: "Andes Travel", contacto: "contacto@andes.com" },
    { id: 2, nombre: "Camino Inca Tours", contacto: "info@caminoinca.com" },
];

type Proveedor = (typeof proveedores)[number];

function ProveedoresPage() {
    const [estado, setEstado] = useState<Estado>("exito");
    const [paginaActual, setPaginaActual] = useState(1);
    const [proveedorSeleccionado, setProveedorSeleccionado] =
        useState<Proveedor | null>(null);

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

        console.log(`Baja simulada para ${proveedorSeleccionado.nombre}`);
        cancelarBaja();
    }

    return (
        <section className="mx-auto max-w-6xl">
            <header className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Panel de gestión
                    </p>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Proveedores
                    </h1>
            </header>

            <div className="mb-6 flex flex-wrap gap-2">
                    <Boton
                        variante="secundario"
                        onClick={() => setEstado("cargando")}
                    >
                        Cargando
                    </Boton>

                    <Boton
                        variante="secundario"
                        onClick={() => setEstado("vacio")}
                    >
                        Vacío
                    </Boton>

                    <Boton
                        variante="peligro"
                        onClick={() => setEstado("error")}
                    >
                        Error
                    </Boton>

                    <Boton
                        onClick={() => setEstado("exito")}
                    >
                        Mostrar proveedores
                    </Boton>
            </div>

            {estado !== "exito" ? (
                    <EstadoListado
                        estado={estado}
                        mensaje={
                            estado === "vacio"
                                ? "Todavía no hay proveedores registrados."
                                : undefined
                        }
                    />
                ) : (
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
                                titulo: "Acción",
                                renderizar: (proveedor) => (
                                    <Boton
                                        variante="peligro"
                                        onClick={() =>
                                            abrirDialogoBaja(proveedor)
                                        }
                                    >
                                        Dar de baja
                                    </Boton>
                                ),
                            },
                        ]}
                    />
            )}

            {estado === "exito" ? (
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
                            ? `¿Estás seguro de que querés dar de baja a ${proveedorSeleccionado.nombre}? Esta acción es una simulación y todavía no elimina datos.`
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