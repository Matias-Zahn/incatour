import { useState } from "react";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioPaquete from "../../components/FormularioPaquete";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import { useCircuitos } from "../../services/circuitoService";
import {
    formatearDiasLegibles,
    useDarDeBajaPaquete,
    useModificarPaquete,
    usePaquetes,
    useRegistrarPaquete,
    useServiciosDisponiblesCatalogo,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type Paquete,
} from "../../services/paqueteService";
import { useTemporadas } from "../../services/temporadaService";

const ELEMENTOS_POR_PAGINA = 5;

function esGarantiaEstablecimiento(tipoGarantia: string): boolean {
    return tipoGarantia.toUpperCase().includes("ESTABLECIMIENTO");
}

function estiloEstado(estado: Paquete["estado"]): string {
    return estado === "ACTIVO"
        ? "bg-green-50 text-exito"
        : "bg-slate-100 text-texto-suave";
}

function PaquetesPage() {
    const { data: paquetes = [], isPending, isError, error } = usePaquetes();
    const { data: circuitos = [] } = useCircuitos();
    const { data: temporadas = [] } = useTemporadas();
    const { data: serviciosDisponibles = [] } =
        useServiciosDisponiblesCatalogo();

    const registrar = useRegistrarPaquete();
    const modificar = useModificarPaquete();
    const darDeBaja = useDarDeBajaPaquete();
    const guardando = registrar.isPending || modificar.isPending;

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [paqueteEnEdicion, setPaqueteEnEdicion] = useState<Paquete | null>(
        null,
    );
    const [paqueteSeleccionado, setPaqueteSeleccionado] =
        useState<Paquete | null>(null);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [errorBaja, setErrorBaja] = useState("");

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirFormulario(paquete?: Paquete) {
        setPaqueteEnEdicion(paquete ?? null);
        setErrorFormulario("");
        setErrorBaja("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setPaqueteEnEdicion(null);
        setErrorFormulario("");
    }

    function guardarNuevoPaquete(datos: DatosCrearPaquete) {
        registrar.mutate(datos, {
            onSuccess: cerrarFormulario,
            onError: (e: Error) => setErrorFormulario(e.message),
        });
    }

    function guardarEdicionPaquete(id: number, datos: DatosModificarPaquete) {
        modificar.mutate(
            { id, datos },
            {
                onSuccess: cerrarFormulario,
                onError: (e: Error) => setErrorFormulario(e.message),
            },
        );
    }

    function abrirDialogoBaja(paquete: Paquete) {
        setErrorBaja("");
        setPaqueteSeleccionado(paquete);
    }

    function cancelarBaja() {
        setPaqueteSeleccionado(null);
    }

    function confirmarBaja() {
        if (!paqueteSeleccionado) return;

        darDeBaja.mutate(paqueteSeleccionado.idpaquete, {
            onSuccess: () => {
                setPaqueteSeleccionado(null);
                setPaginaActual(1);
            },
            onError: (e: Error) => {
                setPaqueteSeleccionado(null);
                setErrorBaja(e.message);
            },
        });
    }

    const terminoLimpio = busqueda.trim().toLowerCase();
    const paquetesFiltrados = paquetes.filter((paquete) => {
        if (!terminoLimpio) return true;
        return (
            paquete.nombrePaquete.toLowerCase().includes(terminoLimpio) ||
            paquete.nroPaquete.toLowerCase().includes(terminoLimpio) ||
            (paquete.circuito?.nombreCircuito ?? "")
                .toLowerCase()
                .includes(terminoLimpio) ||
            paquete.tipoGarantia.toLowerCase().includes(terminoLimpio)
        );
    });

    const totalPaginas = Math.max(
        1,
        Math.ceil(paquetesFiltrados.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const paquetesPaginados = paquetesFiltrados.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinPaquetesRegistrados =
        estado === "exito" && paquetes.length === 0;
    const sinResultadosBusqueda =
        estado === "exito" &&
        paquetes.length > 0 &&
        paquetesFiltrados.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Catálogo comercial
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Paquetes turísticos
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Administrá los paquetes comerciales, sus garantías de alojamiento y tarifas por temporada.
                    </p>
                </div>

                <Boton onClick={() => abrirFormulario()}>
                    Nuevo paquete turístico
                </Boton>
            </header>

            {formularioAbierto ? (
                <FormularioPaquete
                    key={paqueteEnEdicion?.idpaquete ?? "nuevo"}
                    paqueteEnEdicion={paqueteEnEdicion}
                    circuitos={circuitos}
                    temporadas={temporadas}
                    serviciosDisponibles={serviciosDisponibles}
                    alGuardarNuevo={guardarNuevoPaquete}
                    alGuardarEdicion={guardarEdicionPaquete}
                    alCancelar={cerrarFormulario}
                    guardando={guardando}
                    errorServidor={errorFormulario}
                />
            ) : null}

            {errorBaja ? (
                <Alerta
                    tipo="error"
                    titulo="No se pudo dar de baja el paquete turístico"
                >
                    {errorBaja}
                </Alerta>
            ) : null}

            {estado === "exito" && paquetes.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-md">
                        <label htmlFor="buscar-paquete" className="sr-only">
                            Buscar paquete turístico
                        </label>
                        <input
                            id="buscar-paquete"
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                manejarCambioBusqueda(evento.target.value)
                            }
                            placeholder="Buscar por código, nombre, circuito o garantía..."
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
            ) : sinPaquetesRegistrados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Todavía no hay paquetes turísticos registrados."
                />
            ) : sinResultadosBusqueda ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={`No se encontraron paquetes que coincidan con "${busqueda.trim()}".`}
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={paquetesPaginados}
                        columnas={[
                            {
                                clave: "nombrePaquete",
                                titulo: "Paquete",
                                renderizar: (paquete) => (
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded bg-marca-activa px-2 py-0.5 text-xs font-bold text-marca-oscura">
                                                {paquete.nroPaquete}
                                            </span>
                                            <p className="font-semibold text-texto">
                                                {paquete.nombrePaquete}
                                            </p>
                                        </div>
                                        {paquete.condiciones ? (
                                            <p className="mt-1 text-xs text-texto-suave">
                                                {paquete.condiciones}
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            },
                            {
                                clave: "idcircuito",
                                titulo: "Circuito y noches",
                                renderizar: (paquete) => (
                                    <div>
                                        <p className="text-sm font-medium text-texto">
                                            {paquete.circuito?.nombreCircuito ??
                                                `Circuito #${paquete.idcircuito}`}
                                        </p>
                                        <p className="mt-0.5 text-xs text-texto-suave">
                                            {paquete.nochesPrevias} prev. ·{" "}
                                            {paquete.nochesPosteriores} post.
                                            {paquete.diasDisponibles
                                                ? ` · ${formatearDiasLegibles(
                                                      paquete.diasDisponibles,
                                                  )}`
                                                : ""}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "tipoGarantia",
                                titulo: "Garantía de alojamiento",
                                renderizar: (paquete) => {
                                    const porEst = esGarantiaEstablecimiento(
                                        paquete.tipoGarantia,
                                    );
                                    return (
                                        <div>
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                    porEst
                                                        ? "bg-green-50 text-exito"
                                                        : "bg-marca-activa text-marca-oscura"
                                                }`}
                                            >
                                                {porEst
                                                    ? "Por establecimiento"
                                                    : "Por categoría"}
                                            </span>
                                            {!porEst &&
                                            (paquete.categoriaGarantizada ||
                                                paquete.localidadGarantizada) ? (
                                                <p className="mt-1 text-xs text-texto-suave">
                                                    {[
                                                        paquete.categoriaGarantizada,
                                                        paquete.localidadGarantizada,
                                                        paquete.tipoHabitacionGarantizada
                                                            ? `Hab. ${paquete.tipoHabitacionGarantizada}`
                                                            : null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </p>
                                            ) : null}
                                        </div>
                                    );
                                },
                            },
                            {
                                clave: "tarifas",
                                titulo: "Tarifas vigentes",
                                renderizar: (paquete) => (
                                    <div className="flex flex-wrap gap-1.5">
                                        {paquete.tarifas &&
                                        paquete.tarifas.length > 0 ? (
                                            paquete.tarifas.map((tarifa) => (
                                                <span
                                                    key={tarifa.idtemporada}
                                                    className="inline-flex items-center rounded-control border border-borde bg-fondo px-2.5 py-1 text-xs font-semibold text-texto"
                                                >
                                                    {tarifa.temporada?.nombre ??
                                                        `Temp. #${tarifa.idtemporada}`}
                                                    :{" "}
                                                    <strong className="ml-1 text-navegacion">
                                                        {tarifa.moneda}{" "}
                                                        {tarifa.monto}
                                                    </strong>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-texto-suave">
                                                Sin tarifas
                                            </span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                                renderizar: (paquete) => (
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                            paquete.estado,
                                        )}`}
                                    >
                                        {paquete.estado}
                                    </span>
                                ),
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (paquete) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                paquete.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirFormulario(paquete)
                                            }
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                paquete.estado === "INACTIVO"
                                            }
                                            onClick={() =>
                                                abrirDialogoBaja(paquete)
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

            {estado === "exito" && paquetesFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={paqueteSeleccionado !== null}
                titulo="Confirmar baja de paquete turístico"
                descripcion={
                    paqueteSeleccionado
                        ? `¿Estás seguro de que querés dar de baja el paquete "${paqueteSeleccionado.nombrePaquete}" (${paqueteSeleccionado.nroPaquete})?`
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

export default PaquetesPage;
