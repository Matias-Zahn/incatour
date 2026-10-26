import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioServicio from "../../components/FormularioServicio";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import { useProveedor } from "../../services/proveedorService";
import {
    useDarDeBajaServicio,
    useModificarServicio,
    useRegistrarServicio,
    useServicio,
    useServicios,
    type DatosServicio,
    type FiltrosServicio,
    type Servicio,
    type ServicioModificar,
} from "../../services/servicioService";

const ELEMENTOS_POR_PAGINA = 5;

const CAMPOS_COMPARABLES: (keyof ServicioModificar)[] = [
    "nombreServicio",
    "descripcion",
    "costoBase",
    "localidad",
    "categoria",
    "tipoHabitacion",
    "capacidadDisponible",
    "modalidadConfirmacion",
    "capacidadVehiculo",
    "pesoEquipajeIncluido",
    "costoPorKgExcedente",
    "horarioSalida",
    "horarioLlegada",
    "diasOperacion",
    "tipoEquipamiento",
    "inventarioTotal",
];

function describirDisponibilidad(servicio: Servicio): string {
    switch (servicio.tipo) {
        case "EQUIPAMIENTO": {
            const libre = servicio.cantidadDisponible ?? 0;
            const comprometida = servicio.cantidadComprometida ?? 0;
            const total = servicio.inventarioTotal ?? libre + comprometida;
            return `${servicio.tipoEquipamiento ?? "Equipo"} · Libre: ${libre} / Comprometido: ${comprometida} / Total: ${total}`;
        }
        case "ALOJAMIENTO":
            return `${servicio.categoria ?? "-"} · ${servicio.tipoHabitacion ?? "-"} · ${servicio.capacidadDisponible ?? 0} plazas (${servicio.modalidadConfirmacion ?? "-"})`;
        case "TRANSPORTE":
            return `${servicio.capacidadVehiculo ?? 0} asientos · ${servicio.pesoEquipajeIncluido ?? 0} kg incl. (+$${servicio.costoPorKgExcedente ?? 0}/kg)`;
        case "TREN":
            return `${servicio.horarioSalida ?? "--:--"} a ${servicio.horarioLlegada ?? "--:--"} (${servicio.diasOperacion ?? "-"})`;
        default:
            return "-";
    }
}

function ServiciosPage() {
    const idProveedor = Number(useParams().idProveedor);
    const { data: proveedor } = useProveedor(idProveedor);

    const [filtroEstado, setFiltroEstado] = useState<FiltrosServicio["estado"]>();
    const hayFiltros = Boolean(filtroEstado);

    const {
        data: servicios = [],
        isPending,
        isError,
        error,
    } = useServicios(idProveedor, { estado: filtroEstado });

    const registrar = useRegistrarServicio(idProveedor);
    const modificar = useModificarServicio(idProveedor);
    const darDeBaja = useDarDeBajaServicio(idProveedor);
    const guardando = registrar.isPending || modificar.isPending;

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [servicioBaseEdicion, setServicioBaseEdicion] = useState<Servicio | null>(null);
    const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [avisoVersionado, setAvisoVersionado] = useState("");

    // CU-20 paso 1: consulta GET /api/servicios/:id para traer el bloque `edicion` y la disponibilidad actualizada.
    const { data: servicioDetallado, isPending: cargandoDetalleEdicion } = useServicio(
        servicioBaseEdicion?.idservicio ?? 0,
    );
    const servicioEnEdicion = servicioBaseEdicion
        ? (servicioDetallado ?? servicioBaseEdicion)
        : null;

    const tipoProveedor =
        proveedor?.tipoProveedor ?? servicios[0]?.tipo ?? "ALOJAMIENTO";
    const proveedorInactivo = proveedor?.estado === "INACTIVO";

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirAlta() {
        setServicioBaseEdicion(null);
        setErrorFormulario("");
        setAvisoVersionado("");
        registrar.reset();
        modificar.reset();
        setFormularioAbierto(true);
    }

    function abrirEdicion(servicio: Servicio) {
        setServicioBaseEdicion(servicio);
        setErrorFormulario("");
        setAvisoVersionado("");
        registrar.reset();
        modificar.reset();
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setServicioBaseEdicion(null);
        setErrorFormulario("");
        registrar.reset();
        modificar.reset();
    }

    function guardar(datos: DatosServicio) {
        setErrorFormulario("");
        if (servicioEnEdicion) {
            // El contrato pide enviar solo lo que cambia en PUT /api/servicios/:id (CU-20).
            const cambios = CAMPOS_COMPARABLES.reduce<ServicioModificar>(
                (acumulado, campo) => {
                    const nuevoValor = datos[campo];
                    const valorActual =
                        campo === "inventarioTotal"
                            ? (servicioEnEdicion.inventarioTotal ??
                              (servicioEnEdicion.cantidadDisponible ?? 0) +
                                  (servicioEnEdicion.cantidadComprometida ?? 0))
                            : servicioEnEdicion[campo];

                    if (
                        nuevoValor === undefined ||
                        (typeof nuevoValor === "number" && Number.isNaN(nuevoValor)) ||
                        nuevoValor === valorActual
                    ) {
                        return acumulado;
                    }
                    return { ...acumulado, [campo]: nuevoValor };
                },
                {},
            );

            if (Object.keys(cambios).length === 0) {
                cerrarFormulario();
                return;
            }

            modificar.mutate(
                { id: servicioEnEdicion.idservicio, datos: cambios },
                {
                    onSuccess: (resultado) => {
                        cerrarFormulario();
                        if (resultado.versionado) {
                            setAvisoVersionado(resultado.mensaje);
                        }
                    },
                    onError: (e: Error) => setErrorFormulario(e.message),
                },
            );
        } else {
            registrar.mutate(datos, {
                onSuccess: cerrarFormulario,
                onError: (e: Error) => setErrorFormulario(e.message),
            });
        }
    }

    function confirmarBaja() {
        if (!seleccionado) return;
        darDeBaja.mutate(seleccionado.idservicio, {
            onSuccess: () => {
                setSeleccionado(null);
                setPaginaActual(1);
            },
            // Cierra el diálogo para mostrar el motivo del bloqueo (CU-21).
            onError: () => setSeleccionado(null),
        });
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const serviciosFiltrados = servicios.filter((servicio) => {
        if (!terminoLimpio) return true;
        return (
            servicio.nombreServicio.toLowerCase().includes(terminoLimpio) ||
            servicio.localidad.toLowerCase().includes(terminoLimpio) ||
            (servicio.descripcion ?? "").toLowerCase().includes(terminoLimpio)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(serviciosFiltrados.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const serviciosPaginados = serviciosFiltrados.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinServiciosRegistrados = estado === "exito" && servicios.length === 0;
    const mensajeVacio = hayFiltros
        ? "No hay servicios que coincidan con el filtro seleccionado."
        : "Todavía no hay servicios registrados para este proveedor.";
    const sinResultadosBusqueda =
        estado === "exito" &&
        servicios.length > 0 &&
        serviciosFiltrados.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Link
                        to="/gestion/proveedores"
                        className="text-sm font-semibold text-marca hover:underline"
                    >
                        ← Volver a proveedores
                    </Link>
                    <p className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de servicios
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        {proveedor?.razonSocial ?? "Servicios"}
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Rubro: {tipoProveedor}
                        {proveedor ? ` · Localidad: ${proveedor.localidad} · Estado: ${proveedor.estado}` : ""}
                    </p>
                </div>
                <Boton onClick={abrirAlta} disabled={proveedorInactivo}>
                    Nuevo servicio
                </Boton>
            </header>

            {proveedorInactivo ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Proveedor dado de baja"
                >
                    Este proveedor está inactivo: no se pueden registrar nuevos servicios hasta reactivarlo.
                </Alerta>
            ) : null}

            {avisoVersionado ? (
                <Alerta tipo="exito" titulo="Nueva versión de servicio generada">
                    {avisoVersionado}
                </Alerta>
            ) : null}

            {formularioAbierto ? (
                <FormularioServicio
                    tipoProveedor={tipoProveedor}
                    localidadPredeterminada={proveedor?.localidad ?? ""}
                    servicioEnEdicion={servicioEnEdicion}
                    cargandoEdicion={
                        Boolean(servicioBaseEdicion) && cargandoDetalleEdicion
                    }
                    alGuardar={guardar}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
            ) : null}

            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja el servicio">
                    {darDeBaja.error.message}
                </Alerta>
            ) : null}

            {estado === "exito" && (servicios.length > 0 || hayFiltros) ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative w-full max-w-md">
                        <label htmlFor="buscar-servicio" className="sr-only">
                            Buscar servicio
                        </label>
                        <input
                            id="buscar-servicio"
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                manejarCambioBusqueda(evento.target.value)
                            }
                            placeholder="Buscar por nombre, localidad o descripción..."
                            className="w-full rounded-control border border-borde bg-white px-3.5 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </div>

                    <label htmlFor="filtro-estado-servicio" className="sr-only">
                        Filtrar por estado
                    </label>
                    <select
                        id="filtro-estado-servicio"
                        value={filtroEstado ?? ""}
                        onChange={(evento) => {
                            setFiltroEstado(
                                (evento.target.value ||
                                    undefined) as FiltrosServicio["estado"],
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
            ) : sinServiciosRegistrados ? (
                <EstadoListado estado="vacio" mensaje={mensajeVacio} />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron servicios que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={serviciosPaginados.map((servicio) => ({
                            ...servicio,
                            id: servicio.idservicio,
                        }))}
                        columnas={[
                            {
                                clave: "nombreServicio",
                                titulo: "Servicio",
                                renderizar: (servicio) => (
                                    <div>
                                        <p className="font-semibold text-texto">
                                            {servicio.nombreServicio}
                                        </p>
                                        {servicio.descripcion ? (
                                            <p className="text-xs text-texto-suave">
                                                {servicio.descripcion}
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            },
                            { clave: "localidad", titulo: "Localidad" },
                            {
                                clave: "tipo",
                                titulo: "Condiciones y disponibilidad",
                                renderizar: (servicio) => (
                                    <span className="text-xs text-texto">
                                        {describirDisponibilidad(servicio)}
                                    </span>
                                ),
                            },
                            {
                                clave: "costoBase",
                                titulo: "Costo base",
                                renderizar: (servicio) => `$${servicio.costoBase}`,
                            },
                            { clave: "estado", titulo: "Estado" },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (servicio) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => abrirEdicion(servicio)}
                                            disabled={servicio.estado === "INACTIVO"}
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => {
                                                darDeBaja.reset();
                                                setSeleccionado(servicio);
                                            }}
                                            disabled={servicio.estado === "INACTIVO"}
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

            {estado === "exito" && serviciosFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={seleccionado !== null}
                titulo="Confirmar baja de servicio"
                descripcion={
                    seleccionado
                        ? `¿Querés dar de baja a ${seleccionado.nombreServicio}?`
                        : ""
                }
                textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"}
                cargando={darDeBaja.isPending}
                onCancelar={() => setSeleccionado(null)}
                onConfirmar={confirmarBaja}
            />
        </section>
    );
}

export default ServiciosPage;
