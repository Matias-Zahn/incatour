import { useMemo, useRef, useState } from "react";
import Modal from "../../components/Modal";
import { useNavigate } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioPaquete from "../../components/FormularioPaquete";
import MenuAccionesSalida, {
    type AccionMenuSalida,
} from "../../components/MenuAccionesSalida";
import Paginacion from "../../components/Paginacion";
import { useCircuitos } from "../../services/circuitoService";
import {
    formatearDiasLegibles,
    resolverUrlImagenPaquete,
    useDarDeBajaPaquete,
    useModificarPaquete,
    usePaqueteDetalle,
    usePaquetes,
    useRegistrarPaquete,
    useServiciosDisponiblesCatalogo,
    useSubirImagenPaquete,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type Paquete,
} from "../../services/paqueteService";
import { temporadaVencida, useTemporadas } from "../../services/temporadaService";
import { etiquetaEstadoRegistro, formatearMonto } from "../../services/formato";

const ELEMENTOS_POR_PAGINA = 9;
const FORMATOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_IMAGEN_BYTES = 3 * 1024 * 1024;
const MAX_IMAGENES_PAQUETE = 5;

function IconoTarjetas() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
    );
}

function IconoTabla() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" x2="21" y1="6" y2="6" />
            <line x1="8" x2="21" y1="12" y2="12" />
            <line x1="8" x2="21" y1="18" y2="18" />
            <line x1="3" x2="3.01" y1="6" y2="6" />
            <line x1="3" x2="3.01" y1="12" y2="12" />
            <line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
    );
}

function IconoCamara() {
    return (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
        </svg>
    );
}

type MenuPaqueteProps = {
    paquete: Paquete;
    subiendoEste: boolean;
    onVistaPrevia: () => void;
    onSubirImagenes: () => void;
    onDarDeBaja: () => void;
};

function MenuPaquete({
    paquete,
    subiendoEste,
    onVistaPrevia,
    onSubirImagenes,
    onDarDeBaja,
}: MenuPaqueteProps) {
    const inactivo = paquete.estado === "INACTIVO";
    const acciones: AccionMenuSalida[] = [
        {
            tipo: "boton",
            id: "vista-previa",
            etiqueta: "Vista previa y detalle",
            onClick: onVistaPrevia,
        },
        {
            tipo: "enlace",
            id: "ver-tienda",
            etiqueta: "Ver en tienda cliente",
            to: `/catalogo?vista=admin&paquete=${paquete.idpaquete}`,
        },
    ];

    if (!inactivo) {
        acciones.push({
            tipo: "boton",
            id: "subir-imagenes",
            etiqueta: subiendoEste
                ? "Subiendo imágenes..."
                : "Cambiar imágenes (1-5)",
            deshabilitado: subiendoEste,
            onClick: onSubirImagenes,
        });
        acciones.push({
            tipo: "boton",
            id: "dar-de-baja",
            etiqueta: "Dar de baja",
            tono: "peligro",
            onClick: onDarDeBaja,
        });
    }

    return (
        <MenuAccionesSalida nroSalida={paquete.nroPaquete} acciones={acciones} />
    );
}

function esGarantiaEstablecimiento(tipoGarantia: string): boolean {
    return tipoGarantia.toUpperCase().includes("ESTABLECIMIENTO");
}

function estiloEstado(estado: Paquete["estado"]): string {
    return estado === "ACTIVO"
        ? "bg-green-50 text-exito"
        : "bg-slate-100 text-texto-suave";
}

function obtenerGaleriaPaquete(paquete: Paquete): string[] {
    if (paquete.imagenes && paquete.imagenes.length > 0) {
        return paquete.imagenes;
    }
    if (paquete.imagenPrincipal) {
        return [paquete.imagenPrincipal];
    }
    return ["/imagenes/catalogo/machu-picchu.jpg"];
}

const TARIFAS_EN_LISTADO = 2;

function tarifasVigentes(paquete: Paquete) {
    return (paquete.tarifas ?? [])
        .filter((t) => !t.temporada || !temporadaVencida(t.temporada))
        .sort((a, b) => (a.temporada?.fechaInicio ?? "").localeCompare(b.temporada?.fechaInicio ?? ""));
}

function PaquetesPage() {
    const navegar = useNavigate();
    const [filtroEstado, setFiltroEstado] = useState<
        "ACTIVO" | "INACTIVO" | "TODOS"
    >("TODOS");
    const [filtroCircuito, setFiltroCircuito] = useState<number>(0);
    const [filtroTemporada, setFiltroTemporada] = useState<number>(0);
    const [soloPendientes, setSoloPendientes] = useState(false);
    const [filtrosAvanzadosAbiertos, setFiltrosAvanzadosAbiertos] =
        useState(false);
    const [vistaPresentacion, setVistaPresentacion] = useState<
        "tarjetas" | "tabla"
    >("tarjetas");

    const { data: todosLosPaquetes = [] } = usePaquetes({ estado: "TODOS" });
    const {
        data: paquetes = [],
        isPending,
        isError,
        error,
    } = usePaquetes({
        estado: filtroEstado,
        idcircuito: filtroCircuito > 0 ? filtroCircuito : undefined,
    });
    const { data: circuitos = [] } = useCircuitos({ estado: "TODOS" });
    const circuitosActivos = circuitos.filter((c) => c.estado === "ACTIVO");
    const { data: temporadas = [] } = useTemporadas();

    const registrar = useRegistrarPaquete();
    const modificar = useModificarPaquete();
    const darDeBaja = useDarDeBajaPaquete();
    const subirImagen = useSubirImagenPaquete();
    const guardando =
        registrar.isPending || modificar.isPending || subirImagen.isPending;

    const inputImagenRapidaRef = useRef<HTMLInputElement | null>(null);
    const [idPaqueteParaImagen, setIdPaqueteParaImagen] = useState<
        number | null
    >(null);
    const [mensajeExito, setMensajeExito] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const {
        data: serviciosDisponibles = [],
        isError: errorServiciosCatalogo,
        error: detalleErrorServiciosCatalogo,
    } = useServiciosDisponiblesCatalogo(formularioAbierto);
    const [paqueteEnEdicion, setPaqueteEnEdicion] = useState<Paquete | null>(
        null,
    );
    const [paqueteSeleccionado, setPaqueteSeleccionado] =
        useState<Paquete | null>(null);
    const [paqueteVistaPreviaId, setPaqueteVistaPreviaId] = useState<
        number | null
    >(null);
    const [indiceImagenPrevia, setIndiceImagenPrevia] = useState(0);
    const [errorFormulario, setErrorFormulario] = useState("");
    const [errorBaja, setErrorBaja] = useState("");

    const { data: detalleVistaPrevia, isError: errorDetalleVistaPrevia } =
        usePaqueteDetalle(paqueteVistaPreviaId);
    // El listado no trae servicios ni garantías: hasta tener el detalle no se afirma nada sobre ellos
    const textoSinDetalle = errorDetalleVistaPrevia
        ? "No se pudo cargar el detalle del paquete. Cerrá y volvé a abrir la vista previa."
        : "Cargando detalle…";
    const paqueteListaPrevia =
        paquetes.find((p) => p.idpaquete === paqueteVistaPreviaId) ?? null;
    const paqueteVistaPrevia = detalleVistaPrevia ?? paqueteListaPrevia;

    function manejarCambioBusqueda(nuevoValor: string) {
        setBusqueda(nuevoValor);
        setPaginaActual(1);
    }

    function abrirVistaPrevia(paquete: Paquete) {
        setPaqueteVistaPreviaId(paquete.idpaquete);
        setIndiceImagenPrevia(0);
    }

    function cerrarVistaPrevia() {
        setPaqueteVistaPreviaId(null);
        setIndiceImagenPrevia(0);
    }

    function abrirFormulario(paquete?: Paquete) {
        setPaqueteEnEdicion(paquete ?? null);
        setErrorFormulario("");
        setErrorBaja("");
        setMensajeExito("");
        setFormularioAbierto(true);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setPaqueteEnEdicion(null);
        setErrorFormulario("");
    }

    async function guardarNuevoPaquete(
        datos: DatosCrearPaquete,
        imagenesArchivos?: File[],
    ) {
        let creado: Paquete;
        try {
            setErrorFormulario("");
            setMensajeExito("");
            creado = await registrar.mutateAsync(datos);
        } catch (e) {
            setErrorFormulario(
                e instanceof Error
                    ? e.message
                    : "Ocurrió un error al registrar el paquete.",
            );
            return;
        }

        if (imagenesArchivos && imagenesArchivos.length > 0) {
            try {
                const resImg = await subirImagen.mutateAsync({
                    id: creado.idpaquete,
                    archivos: imagenesArchivos,
                    metodo: "POST",
                });
                const cantidad = resImg.urls?.length ?? imagenesArchivos.length;
                setMensajeExito(
                    `Paquete "${creado.nombrePaquete}" publicado con ${cantidad} ${cantidad === 1 ? "imagen guardada" : "imágenes guardadas"}.`,
                );
            } catch (e) {
                setPaqueteEnEdicion(creado);
                setErrorFormulario(
                    `El paquete "${creado.nombrePaquete}" (${creado.nroPaquete}) ya fue creado, pero falló la subida de imágenes: ${
                        e instanceof Error
                            ? e.message
                            : "Error al subir el carrusel."
                    } Podés corregir las imágenes y guardar los cambios sin duplicar el paquete.`,
                );
                return;
            }
        }
        cerrarFormulario();
    }

    async function guardarEdicionPaquete(
        id: number,
        datos: DatosModificarPaquete,
        imagenesArchivos?: File[],
    ) {
        try {
            setErrorFormulario("");
            setMensajeExito("");
            const actualizado = await modificar.mutateAsync({ id, datos });
            if (imagenesArchivos && imagenesArchivos.length > 0) {
                const resImg = await subirImagen.mutateAsync({
                    id,
                    archivos: imagenesArchivos,
                    metodo: "PUT",
                });
                const cantidad = resImg.urls?.length ?? imagenesArchivos.length;
                setMensajeExito(
                    `Paquete "${actualizado.nombrePaquete}" actualizado con ${cantidad} ${cantidad === 1 ? "imagen nueva" : "imágenes nuevas"}.`,
                );
            }
            cerrarFormulario();
        } catch (e) {
            setErrorFormulario(
                e instanceof Error
                    ? e.message
                    : "Ocurrió un error al modificar el paquete.",
            );
        }
    }

    function iniciarSubidaImagenRapida(paquete: Paquete) {
        setErrorBaja("");
        setMensajeExito("");
        setIdPaqueteParaImagen(paquete.idpaquete);
        if (inputImagenRapidaRef.current) {
            inputImagenRapidaRef.current.value = "";
            inputImagenRapidaRef.current.click();
        }
    }

    function manejarArchivoImagenRapida(
        evento: React.ChangeEvent<HTMLInputElement>,
    ) {
        const archivos = Array.from(evento.target.files ?? []);
        const idDestino = idPaqueteParaImagen;
        evento.target.value = "";
        if (archivos.length === 0 || !idDestino) return;

        if (archivos.length > MAX_IMAGENES_PAQUETE) {
            setErrorBaja(
                `Solo se pueden subir entre 1 y ${MAX_IMAGENES_PAQUETE} imágenes por paquete (seleccionaste ${archivos.length}).`,
            );
            return;
        }

        for (const archivo of archivos) {
            if (!FORMATOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
                setErrorBaja(
                    `El archivo "${archivo.name}" tiene un formato no soportado. Solo se permiten imágenes JPG, PNG o WEBP.`,
                );
                return;
            }
            if (archivo.size > TAMANO_MAXIMO_IMAGEN_BYTES) {
                setErrorBaja(
                    `El archivo "${archivo.name}" supera el tamaño máximo permitido (3 MB).`,
                );
                return;
            }
        }

        subirImagen.mutate(
            { id: idDestino, archivos, metodo: "PUT" },
            {
                onSuccess: (res) => {
                    const cantidad = res.urls?.length ?? archivos.length;
                    setIndiceImagenPrevia(0);
                    setMensajeExito(
                        `Galería del paquete #${res.idpaquete} actualizada con ${cantidad} ${cantidad === 1 ? "imagen" : "imágenes"}.`,
                    );
                },
                onError: (e: Error) => {
                    setErrorBaja(e.message);
                },
            },
        );
    }

    function abrirDialogoBaja(paquete: Paquete) {
        setErrorBaja("");
        setMensajeExito("");
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

    const tienePendienteComercial = (paquete: Paquete) =>
        paquete.estado === "ACTIVO" &&
        (paquete.faltaTransporte === true ||
            tarifasVigentes(paquete).length === 0);

    const metricasPaquetes = useMemo(() => {
        const base = todosLosPaquetes.length > 0 ? todosLosPaquetes : paquetes;
        const activos = base.filter((p) => p.estado === "ACTIVO").length;
        const inactivos = base.filter((p) => p.estado === "INACTIVO").length;
        const pendientes = base.filter(tienePendienteComercial).length;
        return { total: base.length, activos, inactivos, pendientes };
    }, [todosLosPaquetes, paquetes]);

    const terminoLimpio = busqueda.trim().toLowerCase();
    const cantidadFiltrosAvanzados = [
        filtroCircuito > 0,
        filtroTemporada > 0,
    ].filter(Boolean).length;
    const hayFiltrosActivos =
        Boolean(terminoLimpio) ||
        filtroEstado !== "TODOS" ||
        filtroCircuito > 0 ||
        filtroTemporada > 0 ||
        soloPendientes;

    function limpiarTodosLosFiltros() {
        setBusqueda("");
        setFiltroEstado("TODOS");
        setFiltroCircuito(0);
        setFiltroTemporada(0);
        setSoloPendientes(false);
        setPaginaActual(1);
    }

    const paquetesFiltrados = paquetes.filter((paquete) => {
        if (soloPendientes && !tienePendienteComercial(paquete)) {
            return false;
        }
        if (
            filtroTemporada > 0 &&
            !paquete.tarifas?.some((t) => t.idtemporada === filtroTemporada)
        ) {
            return false;
        }
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
    const paginaValida = Math.min(paginaActual, totalPaginas);
    const indiceInicio = (paginaValida - 1) * ELEMENTOS_POR_PAGINA;
    const paquetesPaginados = paquetesFiltrados.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinPaquetesRegistrados =
        estado === "exito" && paquetes.length === 0 && !hayFiltrosActivos;
    const sinResultadosBusqueda =
        estado === "exito" &&
        !sinPaquetesRegistrados &&
        paquetesFiltrados.length === 0;

    function resumenGarantia(paquete: Paquete): string {
        const porEst = esGarantiaEstablecimiento(paquete.tipoGarantia);
        if (porEst) {
            const nombres = (paquete.garantiasEstablecimiento ?? [])
                .map((g) => g.servicio?.nombreServicio)
                .filter(Boolean);
            return nombres.length > 0
                ? nombres.join(", ")
                : "Establecimiento garantizado";
        }
        return (
            [
                paquete.categoriaGarantizada,
                paquete.localidadGarantizada,
                paquete.tipoHabitacionGarantizada
                    ? `Hab. ${paquete.tipoHabitacionGarantizada}`
                    : null,
            ]
                .filter(Boolean)
                .join(" · ") || "Categoría garantizada"
        );
    }

    return (
        <section className="mx-auto max-w-[1440px] space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca-oscura">
                        Catálogo comercial
                    </p>
                    <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-navegacion sm:text-3xl">
                        Paquetes turísticos
                    </h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        Oferta comercial, galerías, garantías de alojamiento y tarifas por temporada.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => navegar("/catalogo?vista=admin")}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-borde bg-white px-3.5 py-2 text-xs font-semibold text-navegacion transition hover:border-marca/45 hover:bg-marca-suave/50"
                    >
                        <span>Ver tienda como cliente</span>
                        <span aria-hidden="true">↗</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => abrirFormulario()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
                    >
                        <span>+ Nuevo paquete</span>
                    </button>
                </div>
            </header>

            {formularioAbierto ? (
                <Modal
                    onCerrar={cerrarFormulario}
                    etiquetaId="titulo-asistente-paquete"
                    tamano="xl"
                    className="p-6"
                >
                    <div id="titulo-asistente-paquete" className="sr-only">
                        {paqueteEnEdicion ? "Editar paquete turístico" : "Nuevo paquete turístico"}
                    </div>
                    <FormularioPaquete
                        key={paqueteEnEdicion?.idpaquete ?? "nuevo"}
                        paqueteEnEdicion={paqueteEnEdicion}
                        circuitos={circuitosActivos}
                        temporadas={temporadas}
                        serviciosDisponibles={serviciosDisponibles}
                        errorCargaServicios={
                            errorServiciosCatalogo
                                ? (detalleErrorServiciosCatalogo?.message ??
                                  "Error al consultar proveedores y servicios.")
                                : undefined
                        }
                        alGuardarNuevo={guardarNuevoPaquete}
                        alGuardarEdicion={guardarEdicionPaquete}
                        alCancelar={cerrarFormulario}
                        guardando={guardando}
                        errorServidor={errorFormulario}
                    />
                </Modal>
            ) : null}

            <input
                ref={inputImagenRapidaRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={manejarArchivoImagenRapida}
                className="sr-only"
                aria-label="Seleccionar entre 1 y 5 imágenes para paquete turístico"
            />

            {mensajeExito ? (
                <Alerta
                    tipo="exito"
                    titulo="Galería de paquete actualizada"
                >
                    {mensajeExito}
                </Alerta>
            ) : null}

            {errorBaja ? (
                <Alerta
                    tipo="error"
                    titulo="No se pudo completar la operación sobre el paquete"
                >
                    {errorBaja}
                </Alerta>
            ) : null}

            {/* 3 TARJETAS KPI CLICABLES */}
            <div className="grid gap-3 sm:grid-cols-3">
                <button
                    type="button"
                    onClick={() => {
                        setSoloPendientes(false);
                        setFiltroEstado((prev) =>
                            prev === "ACTIVO" ? "TODOS" : "ACTIVO",
                        );
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroEstado === "ACTIVO" && !soloPendientes
                            ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Activos en tienda
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricasPaquetes.activos}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            Visibles en el catálogo público
                        </p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                        <span className="size-2 rounded-full bg-emerald-500" />
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSoloPendientes((prev) => !prev);
                        setFiltroEstado("TODOS");
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        soloPendientes
                            ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Con pendientes
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricasPaquetes.pendientes}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricasPaquetes.pendientes > 0 ? (
                                <span className="font-semibold text-amber-800">
                                    Sin tarifas vigentes o sin transporte
                                </span>
                            ) : (
                                <span className="font-medium text-emerald-700">
                                    Todos completos para vender
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`grid size-8 place-items-center rounded-xl text-xs font-bold ring-1 ring-inset ${
                            metricasPaquetes.pendientes > 0
                                ? "bg-amber-50 text-amber-800 ring-amber-500/25"
                                : "bg-fondo text-texto-suave ring-borde"
                        }`}
                    >
                        !
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSoloPendientes(false);
                        setFiltroEstado((prev) =>
                            prev === "INACTIVO" ? "TODOS" : "INACTIVO",
                        );
                        setPaginaActual(1);
                    }}
                    className={`flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroEstado === "INACTIVO"
                            ? "border-slate-400 bg-slate-50 ring-2 ring-slate-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Inactivos
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricasPaquetes.inactivos}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            Dados de baja del catálogo
                        </p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-xl bg-fondo text-xs font-bold text-texto-suave ring-1 ring-inset ring-borde">
                        —
                    </span>
                </button>
            </div>

            {/* BARRA DE HERRAMIENTAS DE 1 FILA + FILTROS COLAPSABLES */}
            {estado === "exito" && (paquetes.length > 0 || hayFiltrosActivos) ? (
                <div className="rounded-2xl border border-borde/80 bg-white p-3.5 shadow-[0_4px_16px_-8px_rgba(18,61,112,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* CÁPSULA SEGMENTADA DE ESTADOS */}
                        <div
                            role="tablist"
                            aria-label="Filtrar paquetes por estado"
                            className="inline-flex items-center gap-0.5 rounded-full bg-fondo p-1 ring-1 ring-borde/80"
                        >
                            {(
                                [
                                    { valor: "TODOS", etiqueta: "Todos" },
                                    { valor: "ACTIVO", etiqueta: "Activos" },
                                    { valor: "INACTIVO", etiqueta: "Inactivos" },
                                ] as const
                            ).map((op) => {
                                const activo =
                                    !soloPendientes && filtroEstado === op.valor;
                                return (
                                    <button
                                        key={op.valor}
                                        type="button"
                                        role="tab"
                                        aria-selected={activo}
                                        onClick={() => {
                                            setSoloPendientes(false);
                                            setFiltroEstado(op.valor);
                                            setPaginaActual(1);
                                        }}
                                        className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                            activo
                                                ? "bg-white text-navegacion shadow-2xs ring-1 ring-navegacion/[0.06]"
                                                : "text-texto-suave hover:text-navegacion"
                                        }`}
                                    >
                                        {op.etiqueta}
                                    </button>
                                );
                            })}
                        </div>

                        {/* BUSCADOR + FILTROS + SWITCH TARJETAS/TABLA */}
                        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                            <div className="relative min-w-[210px] flex-1 sm:w-64 sm:flex-initial">
                                <label htmlFor="buscar-paquete" className="sr-only">
                                    Buscar paquete
                                </label>
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-texto-suave"
                                >
                                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.3-4.3" />
                                    </svg>
                                </span>
                                <input
                                    id="buscar-paquete"
                                    type="search"
                                    value={busqueda}
                                    onChange={(evento) =>
                                        manejarCambioBusqueda(evento.target.value)
                                    }
                                    placeholder="Buscar código, nombre o circuito..."
                                    className="w-full rounded-xl border border-borde bg-fondo/50 py-2 pl-9 pr-3 text-xs font-medium text-navegacion outline-none placeholder:text-texto-suave/70 transition focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15"
                                />
                            </div>

                            <button
                                type="button"
                                aria-expanded={filtrosAvanzadosAbiertos}
                                onClick={() =>
                                    setFiltrosAvanzadosAbiertos((v) => !v)
                                }
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                                    filtrosAvanzadosAbiertos ||
                                    cantidadFiltrosAvanzados > 0
                                        ? "border-marca/45 bg-marca-suave/60 text-navegacion"
                                        : "border-borde bg-white text-texto hover:bg-fondo"
                                }`}
                            >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <line x1="21" x2="14" y1="4" y2="4" />
                                    <line x1="10" x2="3" y1="4" y2="4" />
                                    <line x1="21" x2="12" y1="12" y2="12" />
                                    <line x1="8" x2="3" y1="12" y2="12" />
                                    <line x1="21" x2="16" y1="20" y2="20" />
                                    <line x1="12" x2="3" y1="20" y2="20" />
                                    <line x1="14" x2="14" y1="2" y2="6" />
                                    <line x1="8" x2="8" y1="10" y2="14" />
                                    <line x1="16" x2="16" y1="18" y2="22" />
                                </svg>
                                <span>Filtros</span>
                                {cantidadFiltrosAvanzados > 0 ? (
                                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-navegacion text-[10px] font-bold text-white">
                                        {cantidadFiltrosAvanzados}
                                    </span>
                                ) : null}
                            </button>

                            {/* SWITCH TARJETAS | TABLA */}
                            <div
                                role="group"
                                aria-label="Modo de visualización"
                                className="inline-flex items-center rounded-xl bg-fondo p-0.5 ring-1 ring-borde/80"
                            >
                                <button
                                    type="button"
                                    aria-pressed={vistaPresentacion === "tarjetas"}
                                    onClick={() => setVistaPresentacion("tarjetas")}
                                    title="Vista en tarjetas"
                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        vistaPresentacion === "tarjetas"
                                            ? "bg-white text-navegacion shadow-2xs"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <IconoTarjetas />
                                    <span className="hidden sm:inline">Tarjetas</span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={vistaPresentacion === "tabla"}
                                    onClick={() => setVistaPresentacion("tabla")}
                                    title="Vista en tabla"
                                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                        vistaPresentacion === "tabla"
                                            ? "bg-white text-navegacion shadow-2xs"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <IconoTabla />
                                    <span className="hidden sm:inline">Tabla</span>
                                </button>
                            </div>

                            {hayFiltrosActivos ? (
                                <button
                                    type="button"
                                    onClick={limpiarTodosLosFiltros}
                                    className="cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-marca-oscura transition hover:bg-marca-suave/60"
                                >
                                    Limpiar
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {filtrosAvanzadosAbiertos ? (
                        <div className="animar-menu mt-3.5 grid gap-3 border-t border-borde/70 pt-3.5 sm:grid-cols-2">
                            <label className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                                Circuito
                                <select
                                    aria-label="Filtrar paquetes por circuito"
                                    value={filtroCircuito}
                                    onChange={(e) => {
                                        setFiltroCircuito(Number(e.target.value));
                                        setPaginaActual(1);
                                    }}
                                    className="w-full min-w-0 rounded-xl border border-borde bg-white px-3 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
                                >
                                    <option value={0}>Todos los circuitos</option>
                                    {circuitos.map((c) => (
                                        <option key={c.idcircuito} value={c.idcircuito}>
                                            {c.nombreCircuito}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                                Temporada con tarifa cargada
                                <select
                                    aria-label="Filtrar paquetes por temporada"
                                    value={filtroTemporada}
                                    onChange={(e) => {
                                        setFiltroTemporada(Number(e.target.value));
                                        setPaginaActual(1);
                                    }}
                                    className="w-full min-w-0 rounded-xl border border-borde bg-white px-3 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
                                >
                                    <option value={0}>Todas las temporadas</option>
                                    {temporadas
                                        .filter((t) => !temporadaVencida(t))
                                        .map((t) => (
                                            <option
                                                key={t.idtemporada}
                                                value={t.idtemporada}
                                            >
                                                {t.nombre}
                                            </option>
                                        ))}
                                </select>
                            </label>
                        </div>
                    ) : null}

                    {soloPendientes ? (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-borde/60 pt-2.5 text-xs">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900 ring-1 ring-inset ring-amber-500/25">
                                Mostrando paquetes con pendientes comerciales
                                <button
                                    type="button"
                                    onClick={() => setSoloPendientes(false)}
                                    className="cursor-pointer text-amber-800 hover:text-amber-950"
                                    aria-label="Quitar filtro de pendientes"
                                >
                                    ✕
                                </button>
                            </span>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* CONTENIDO: TARJETAS (POR DEFECTO) O TABLA LIMPIA */}
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
                    mensaje="No se encontraron paquetes que coincidan con los filtros seleccionados."
                />
            ) : vistaPresentacion === "tarjetas" ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {paquetesPaginados.map((paquete) => {
                        const galeria = obtenerGaleriaPaquete(paquete);
                        const urlPortada = resolverUrlImagenPaquete(galeria[0]);
                        const vigentes = tarifasVigentes(paquete);
                        const tarifaMin =
                            vigentes.length > 0
                                ? vigentes.reduce(
                                      (min, t) =>
                                          t.monto < min.monto ? t : min,
                                      vigentes[0],
                                  )
                                : null;
                        const porEst = esGarantiaEstablecimiento(
                            paquete.tipoGarantia,
                        );
                        const inactivo = paquete.estado === "INACTIVO";
                        const subiendoEste =
                            subirImagen.isPending &&
                            idPaqueteParaImagen === paquete.idpaquete;

                        return (
                            <article
                                key={paquete.idpaquete}
                                className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_6px_24px_-10px_rgba(18,61,112,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(18,61,112,0.16)] ${
                                    inactivo
                                        ? "border-borde/70 opacity-85"
                                        : "border-borde/80"
                                }`}
                            >
                                {/* PORTADA */}
                                <div
                                    onClick={() => abrirVistaPrevia(paquete)}
                                    className="relative h-44 cursor-pointer overflow-hidden bg-navegacion/10"
                                >
                                    <img
                                        src={urlPortada}
                                        alt={paquete.nombrePaquete}
                                        loading="lazy"
                                        className={`size-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                                            inactivo ? "grayscale-[45%]" : ""
                                        }`}
                                    />
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 bg-gradient-to-t from-[#081c36]/75 via-[#081c36]/15 to-[#081c36]/25"
                                    />

                                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs backdrop-blur-md ${
                                                    inactivo
                                                        ? "bg-slate-800/80 text-white"
                                                        : "bg-emerald-500/90 text-white"
                                                }`}
                                            >
                                                {etiquetaEstadoRegistro(paquete.estado)}
                                            </span>
                                            {paquete.faltaTransporte ? (
                                                <span className="rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[11px] font-bold text-navegacion shadow-2xs">
                                                    Falta transporte
                                                </span>
                                            ) : null}
                                        </div>
                                        <span className="shrink-0 rounded-full bg-black/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-white/95 backdrop-blur-md">
                                            {paquete.nroPaquete}
                                        </span>
                                    </div>

                                    <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                                            <IconoCamara />
                                            {galeria.length}{" "}
                                            {galeria.length === 1 ? "foto" : "fotos"}
                                        </span>

                                        {!inactivo ? (
                                            <button
                                                type="button"
                                                disabled={subiendoEste}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    iniciarSubidaImagenRapida(paquete);
                                                }}
                                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-white/25 disabled:opacity-50"
                                            >
                                                {subiendoEste
                                                    ? "Subiendo..."
                                                    : "Cambiar fotos"}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                {/* CUERPO */}
                                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-marca-oscura">
                                                    {paquete.circuito?.nombreCircuito ??
                                                        `Circuito #${paquete.idcircuito}`}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirVistaPrevia(paquete)
                                                    }
                                                    className="mt-0.5 cursor-pointer text-left text-lg font-bold leading-snug tracking-tight text-navegacion transition hover:text-marca-oscura"
                                                >
                                                    {paquete.nombrePaquete}
                                                </button>
                                                {paquete.localidadGarantizada ? (
                                                    <p className="mt-0.5 text-xs text-texto-suave">
                                                        Sale desde{" "}
                                                        <strong className="font-semibold text-texto">
                                                            {paquete.localidadGarantizada}
                                                        </strong>
                                                        {paquete.diasCierreVenta != null
                                                            ? paquete.diasCierreVenta === 0
                                                                ? " · Cierra el mismo día"
                                                                : ` · Cierra ${paquete.diasCierreVenta} ${paquete.diasCierreVenta === 1 ? "día" : "días"} antes`
                                                            : ""}
                                                    </p>
                                                ) : null}
                                            </div>

                                            {tarifaMin ? (
                                                <div className="shrink-0 rounded-xl bg-fondo/80 px-2.5 py-1.5 text-right ring-1 ring-borde/70">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-texto-suave">
                                                        Desde
                                                    </p>
                                                    <p className="whitespace-nowrap text-base font-bold text-navegacion">
                                                        {formatearMonto(
                                                            tarifaMin.monto,
                                                            tarifaMin.moneda,
                                                        )}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* GARANTÍA Y NOCHES */}
                                        <div className="rounded-xl border border-borde/70 bg-fondo/45 px-3 py-2.5 text-xs">
                                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                        porEst
                                                            ? "bg-emerald-50 text-exito"
                                                            : "bg-marca-suave text-marca-oscura"
                                                    }`}
                                                >
                                                    {porEst
                                                        ? "Por establecimiento"
                                                        : "Por categoría"}
                                                </span>
                                                <span className="text-[11px] font-medium text-texto-suave">
                                                    {paquete.nochesPrevias} prev. ·{" "}
                                                    {paquete.nochesPosteriores} post.
                                                </span>
                                            </div>
                                            <p className="mt-1.5 truncate font-medium text-navegacion" title={resumenGarantia(paquete)}>
                                                {resumenGarantia(paquete)}
                                            </p>
                                            {paquete.diasDisponibles ? (
                                                <p className="mt-0.5 text-[11px] text-texto-suave">
                                                    Salidas:{" "}
                                                    {formatearDiasLegibles(
                                                        paquete.diasDisponibles,
                                                    )}
                                                </p>
                                            ) : null}
                                        </div>

                                        {/* TARIFAS VIGENTES */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {vigentes.length > 0 ? (
                                                <>
                                                    {vigentes
                                                        .slice(0, 3)
                                                        .map((tarifa) => (
                                                            <span
                                                                key={
                                                                    tarifa.idtemporada
                                                                }
                                                                className="inline-flex items-center rounded-lg border border-borde/75 bg-white px-2 py-0.5 text-[11px] font-medium text-texto-suave"
                                                            >
                                                                {tarifa.temporada
                                                                    ?.nombre ??
                                                                    `Temp. #${tarifa.idtemporada}`}
                                                                :
                                                                <strong className="ml-1 font-semibold text-navegacion">
                                                                    {formatearMonto(
                                                                        tarifa.monto,
                                                                        tarifa.moneda,
                                                                    )}
                                                                </strong>
                                                            </span>
                                                        ))}
                                                    {vigentes.length > 3 ? (
                                                        <span className="text-[11px] font-semibold text-texto-suave">
                                                            +{vigentes.length - 3}
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20">
                                                    Sin tarifas vigentes
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* PIE DE TARJETA */}
                                <div className="flex items-center justify-between gap-2 border-t border-borde/70 bg-fondo/30 px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={inactivo}
                                            onClick={() => abrirFormulario(paquete)}
                                            className="cursor-pointer rounded-lg bg-gradient-to-r from-navegacion to-marca-oscura px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => abrirVistaPrevia(paquete)}
                                            className="cursor-pointer rounded-lg border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo"
                                        >
                                            Vista previa
                                        </button>
                                    </div>

                                    <MenuPaquete
                                        paquete={paquete}
                                        subiendoEste={subiendoEste}
                                        onVistaPrevia={() =>
                                            abrirVistaPrevia(paquete)
                                        }
                                        onSubirImagenes={() =>
                                            iniciarSubidaImagenRapida(paquete)
                                        }
                                        onDarDeBaja={() =>
                                            abrirDialogoBaja(paquete)
                                        }
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                /* VISTA TABLA LIMPIA (5 COLUMNAS) */
                <div className="overflow-x-auto rounded-2xl border border-borde/80 bg-white shadow-[0_6px_24px_-10px_rgba(18,61,112,0.08)] max-md:overflow-visible max-md:border-0 max-md:bg-transparent max-md:shadow-none">
                    <table className="w-full text-left max-md:block">
                        <thead className="border-b border-borde/80 bg-fondo/80 text-[11px] font-bold uppercase tracking-wider text-texto-suave max-md:hidden">
                            <tr>
                                <th className="px-5 py-3.5">Paquete y circuito</th>
                                <th className="px-4 py-3.5">Alojamiento</th>
                                <th className="px-4 py-3.5">Tarifas vigentes</th>
                                <th className="px-4 py-3.5">Estado</th>
                                <th className="px-5 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-borde/70 max-md:flex max-md:flex-col max-md:gap-3 max-md:divide-y-0">
                            {paquetesPaginados.map((paquete) => {
                                const galeria = obtenerGaleriaPaquete(paquete);
                                const urlPortada = resolverUrlImagenPaquete(
                                    galeria[0],
                                );
                                const vigentes = tarifasVigentes(paquete);
                                const porEst = esGarantiaEstablecimiento(
                                    paquete.tipoGarantia,
                                );
                                const inactivo = paquete.estado === "INACTIVO";

                                return (
                                    <tr
                                        key={paquete.idpaquete}
                                        className="bg-white transition-colors hover:bg-fondo/45 max-md:block max-md:rounded-2xl max-md:border max-md:border-borde/80 max-md:p-4 max-md:shadow-xs"
                                    >
                                        <td className="px-5 py-3.5 align-middle max-md:block max-md:p-0">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirVistaPrevia(paquete)
                                                    }
                                                    className="group relative shrink-0 cursor-pointer overflow-hidden rounded-xl border border-borde bg-fondo"
                                                >
                                                    <img
                                                        src={urlPortada}
                                                        alt={paquete.nombrePaquete}
                                                        className="h-12 w-16 object-cover transition group-hover:scale-105"
                                                    />
                                                </button>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-marca-oscura">
                                                            {paquete.nroPaquete}
                                                        </span>
                                                        {paquete.faltaTransporte ? (
                                                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/20">
                                                                Falta transporte
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirVistaPrevia(
                                                                paquete,
                                                            )
                                                        }
                                                        className="cursor-pointer text-left text-sm font-semibold text-navegacion hover:text-marca-oscura"
                                                    >
                                                        {paquete.nombrePaquete}
                                                    </button>
                                                    <p className="text-xs text-texto-suave">
                                                        {paquete.circuito
                                                            ?.nombreCircuito ??
                                                            `Circuito #${paquete.idcircuito}`}
                                                        {paquete.localidadGarantizada
                                                            ? ` · Sale desde ${paquete.localidadGarantizada}`
                                                            : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle max-md:mt-3 max-md:block max-md:p-0">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                    porEst
                                                        ? "bg-emerald-50 text-exito"
                                                        : "bg-marca-suave text-marca-oscura"
                                                }`}
                                            >
                                                {porEst
                                                    ? "Por establecimiento"
                                                    : "Por categoría"}
                                            </span>
                                            <p className="mt-1 text-xs text-texto">
                                                {resumenGarantia(paquete)}
                                            </p>
                                            <p className="text-[11px] text-texto-suave">
                                                {paquete.nochesPrevias} prev. ·{" "}
                                                {paquete.nochesPosteriores} post.
                                            </p>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle max-md:mt-3 max-md:block max-md:p-0">
                                            <div className="flex flex-wrap gap-1.5">
                                                {vigentes.length > 0 ? (
                                                    <>
                                                        {vigentes
                                                            .slice(
                                                                0,
                                                                TARIFAS_EN_LISTADO,
                                                            )
                                                            .map((tarifa) => (
                                                                <span
                                                                    key={
                                                                        tarifa.idtemporada
                                                                    }
                                                                    className="inline-flex items-center rounded-lg border border-borde/80 bg-fondo/60 px-2 py-0.5 text-xs text-texto-suave"
                                                                >
                                                                    {tarifa
                                                                        .temporada
                                                                        ?.nombre ??
                                                                        `Temp. #${tarifa.idtemporada}`}
                                                                    :
                                                                    <strong className="ml-1 text-navegacion">
                                                                        {formatearMonto(
                                                                            tarifa.monto,
                                                                            tarifa.moneda,
                                                                        )}
                                                                    </strong>
                                                                </span>
                                                            ))}
                                                        {vigentes.length >
                                                        TARIFAS_EN_LISTADO ? (
                                                            <span className="text-xs font-semibold text-texto-suave">
                                                                +
                                                                {vigentes.length -
                                                                    TARIFAS_EN_LISTADO}
                                                            </span>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                                        Sin tarifas
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3.5 align-middle max-md:mt-3 max-md:block max-md:p-0">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                                    paquete.estado,
                                                )}`}
                                            >
                                                {etiquetaEstadoRegistro(
                                                    paquete.estado,
                                                )}
                                            </span>
                                        </td>

                                        <td className="px-5 py-3.5 align-middle max-md:mt-3 max-md:border-t max-md:border-borde/70 max-md:px-0 max-md:pb-0 max-md:pt-3">
                                            <div className="flex items-center justify-end gap-2 max-md:justify-between">
                                                <button
                                                    type="button"
                                                    disabled={inactivo}
                                                    onClick={() =>
                                                        abrirFormulario(paquete)
                                                    }
                                                    className="cursor-pointer rounded-lg border border-borde bg-white px-3 py-1.5 text-xs font-semibold text-navegacion transition hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    Editar
                                                </button>
                                                <MenuPaquete
                                                    paquete={paquete}
                                                    subiendoEste={
                                                        subirImagen.isPending &&
                                                        idPaqueteParaImagen ===
                                                            paquete.idpaquete
                                                    }
                                                    onVistaPrevia={() =>
                                                        abrirVistaPrevia(
                                                            paquete,
                                                        )
                                                    }
                                                    onSubirImagenes={() =>
                                                        iniciarSubidaImagenRapida(
                                                            paquete,
                                                        )
                                                    }
                                                    onDarDeBaja={() =>
                                                        abrirDialogoBaja(
                                                            paquete,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {estado === "exito" && paquetesFiltrados.length > 0 ? (
                <Paginacion
                    paginaActual={paginaValida}
                    totalPaginas={totalPaginas}
                    total={paquetesFiltrados.length}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            {/* MODAL DE VISTA PREVIA Y CONTEXTO DEL PAQUETE */}
            {paqueteVistaPrevia ? (
                <Modal
                    onCerrar={cerrarVistaPrevia}
                    etiquetaId="titulo-vista-previa-paquete"
                    tamano="xl"
                >
                        {(() => {
                            const galeria =
                                obtenerGaleriaPaquete(paqueteVistaPrevia);
                            const indiceSeguro =
                                indiceImagenPrevia < galeria.length
                                    ? indiceImagenPrevia
                                    : 0;
                            const imagenActiva = resolverUrlImagenPaquete(
                                galeria[indiceSeguro],
                            );
                            const circuitoRef = circuitos.find(
                                (c) =>
                                    c.idcircuito ===
                                    paqueteVistaPrevia.idcircuito,
                            );
                            const duracionCircuito =
                                circuitoRef?.duracionDias ??
                                paqueteVistaPrevia.circuito?.duracionDias ??
                                1;
                            const totalDiasEstimados =
                                duracionCircuito +
                                paqueteVistaPrevia.nochesPrevias +
                                paqueteVistaPrevia.nochesPosteriores;
                            const porEst = esGarantiaEstablecimiento(
                                paqueteVistaPrevia.tipoGarantia,
                            );

                            return (
                                <>
                                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-borde p-6">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded bg-marca-activa px-2.5 py-0.5 text-xs font-bold text-marca-oscura">
                                                    {
                                                        paqueteVistaPrevia.nroPaquete
                                                    }
                                                </span>
                                                <span
                                                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                                        paqueteVistaPrevia.estado,
                                                    )}`}
                                                >
                                                    {etiquetaEstadoRegistro(paqueteVistaPrevia.estado)}
                                                </span>
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        paqueteVistaPrevia.tieneImagenesPropias
                                                            ? "bg-green-50 text-exito"
                                                            : "bg-slate-100 text-texto-suave"
                                                    }`}
                                                >
                                                    {paqueteVistaPrevia.tieneImagenesPropias
                                                        ? `Galería propia (${galeria.length} ${galeria.length === 1 ? "foto" : "fotos"})`
                                                        : "Imagen de catálogo por defecto"}
                                                </span>
                                            </div>
                                            <h2
                                                id="titulo-vista-previa-paquete"
                                                className="mt-2 text-2xl font-bold text-navegacion"
                                            >
                                                {
                                                    paqueteVistaPrevia.nombrePaquete
                                                }
                                            </h2>
                                            <p className="mt-1 text-sm text-texto-suave">
                                                Vista previa comercial y técnica del paquete para administración.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={cerrarVistaPrevia}
                                            className="rounded-control border border-borde px-3 py-1.5 text-xs font-semibold text-texto-suave hover:bg-fondo hover:text-texto"
                                        >
                                            ✕ Cerrar
                                        </button>
                                    </div>

                                    <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr]">
                                        {/* COLUMNA IZQUIERDA: GALERÍA DE IMÁGENES (1 A 5) */}
                                        <div className="space-y-3">
                                            <div className="relative overflow-hidden rounded-tarjeta border border-borde bg-fondo">
                                                <img
                                                    src={imagenActiva}
                                                    alt={`${paqueteVistaPrevia.nombrePaquete} - Foto ${indiceSeguro + 1}`}
                                                    className="h-72 w-full object-cover sm:h-80"
                                                />
                                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                                    <span className="rounded-full bg-navegacion/85 px-3 py-1 text-xs font-bold text-white shadow-xs">
                                                        {indiceSeguro === 0
                                                            ? "★ Portada principal"
                                                            : `Foto #${indiceSeguro + 1}`}{" "}
                                                        ({indiceSeguro + 1} /{" "}
                                                        {galeria.length})
                                                    </span>
                                                </div>

                                                {galeria.length > 1 ? (
                                                    <div className="absolute inset-x-3 bottom-3 flex justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setIndiceImagenPrevia(
                                                                    (prev) =>
                                                                        prev <=
                                                                        0
                                                                            ? galeria.length -
                                                                              1
                                                                            : prev -
                                                                              1,
                                                                )
                                                            }
                                                            className="rounded-full bg-navegacion/80 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-navegacion"
                                                        >
                                                            ← Anterior
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setIndiceImagenPrevia(
                                                                    (prev) =>
                                                                        prev >=
                                                                        galeria.length -
                                                                            1
                                                                            ? 0
                                                                            : prev +
                                                                              1,
                                                                )
                                                            }
                                                            className="rounded-full bg-navegacion/80 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-navegacion"
                                                        >
                                                            Siguiente →
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* MINIATURAS DE LA GALERÍA */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs text-texto-suave">
                                                    <span className="font-semibold text-navegacion">
                                                        Imágenes del paquete ({galeria.length} de {MAX_IMAGENES_PAQUETE} máx.)
                                                    </span>
                                                    {paqueteVistaPrevia.estado ===
                                                    "ACTIVO" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                iniciarSubidaImagenRapida(
                                                                    paqueteVistaPrevia,
                                                                )
                                                            }
                                                            className="font-semibold text-marca-oscura hover:underline"
                                                        >
                                                            Reemplazar imágenes (1 a 5)
                                                        </button>
                                                    ) : null}
                                                </div>

                                                <div className="grid grid-cols-5 gap-2">
                                                    {galeria.map((url, idx) => (
                                                        <button
                                                            key={`${url}-${idx}`}
                                                            type="button"
                                                            onClick={() =>
                                                                setIndiceImagenPrevia(
                                                                    idx,
                                                                )
                                                            }
                                                            className={`relative overflow-hidden rounded-control border transition ${
                                                                idx ===
                                                                indiceSeguro
                                                                    ? "border-marca ring-2 ring-marca/30"
                                                                    : "border-borde opacity-75 hover:opacity-100"
                                                            }`}
                                                        >
                                                            <img
                                                                src={resolverUrlImagenPaquete(
                                                                    url,
                                                                )}
                                                                alt={`Miniatura ${idx + 1}`}
                                                                className="h-14 w-full object-cover"
                                                            />
                                                            <span className="absolute bottom-0.5 left-0.5 rounded bg-navegacion/80 px-1 text-xs font-bold text-white">
                                                                {idx === 0
                                                                    ? "Portada"
                                                                    : `#${idx + 1}`}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {paqueteVistaPrevia.condiciones ? (
                                                <div className="rounded-control border border-borde bg-fondo/60 p-3.5">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                                        Condiciones comerciales
                                                    </p>
                                                    <p className="mt-1 text-sm text-texto">
                                                        {
                                                            paqueteVistaPrevia.condiciones
                                                        }
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* COLUMNA DERECHA: CONTEXTO TÉCNICO Y COMERCIAL */}
                                        <div className="space-y-4">
                                            {/* CIRCUITO Y DURACIÓN */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                    Circuito turístico base
                                                </p>
                                                <p className="mt-1 text-base font-bold text-navegacion">
                                                    {paqueteVistaPrevia.circuito
                                                        ?.nombreCircuito ??
                                                        circuitoRef?.nombreCircuito ??
                                                        `Circuito #${paqueteVistaPrevia.idcircuito}`}
                                                </p>
                                                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                                                    <div className="rounded bg-white p-2 border border-borde">
                                                        <p className="text-xs text-texto-suave">
                                                            Duración total
                                                        </p>
                                                        <p className="text-sm font-bold text-navegacion">
                                                            {totalDiasEstimados}{" "}
                                                            {totalDiasEstimados ===
                                                            1
                                                                ? "día"
                                                                : "días"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded bg-white p-2 border border-borde">
                                                        <p className="text-xs text-texto-suave">
                                                            Noches previas
                                                        </p>
                                                        <p className="text-sm font-bold text-navegacion">
                                                            {
                                                                paqueteVistaPrevia.nochesPrevias
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="rounded bg-white p-2 border border-borde">
                                                        <p className="text-xs text-texto-suave">
                                                            Noches post.
                                                        </p>
                                                        <p className="text-sm font-bold text-navegacion">
                                                            {
                                                                paqueteVistaPrevia.nochesPosteriores
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="mt-2.5 text-xs text-texto-suave">
                                                    <strong className="text-texto">
                                                        Salidas habilitadas:
                                                    </strong>{" "}
                                                    {formatearDiasLegibles(
                                                        paqueteVistaPrevia.diasDisponibles,
                                                    )}
                                                </p>
                                            </div>

                                            {/* GARANTÍA DE ALOJAMIENTO */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                        Garantía de alojamiento
                                                    </p>
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
                                                </div>
                                                {porEst && !detalleVistaPrevia ? (
                                                    <p className="mt-1.5 text-xs text-texto-suave">
                                                        {textoSinDetalle}
                                                    </p>
                                                ) : porEst ? (
                                                    (() => {
                                                        const servicioGarantizado =
                                                            paqueteVistaPrevia
                                                                .garantiasEstablecimiento?.[0]
                                                                ?.servicio;
                                                        return servicioGarantizado ? (
                                                            <div className="mt-1.5 space-y-0.5">
                                                                <p className="text-sm font-semibold text-texto">
                                                                    {
                                                                        servicioGarantizado.nombreServicio
                                                                    }
                                                                </p>
                                                                <p className="text-xs text-texto-suave">
                                                                    {[
                                                                        servicioGarantizado.localidad
                                                                            ? `Localidad: ${servicioGarantizado.localidad}`
                                                                            : null,
                                                                        servicioGarantizado
                                                                            .alojamiento
                                                                            ?.categoria
                                                                            ? `Categoría ${servicioGarantizado.alojamiento.categoria}`
                                                                            : null,
                                                                        servicioGarantizado
                                                                            .alojamiento
                                                                            ?.tipoHabitacion
                                                                            ? `Habitación ${servicioGarantizado.alojamiento.tipoHabitacion}`
                                                                            : null,
                                                                        "Bloqueo de plazas",
                                                                    ]
                                                                        .filter(
                                                                            Boolean,
                                                                        )
                                                                        .join(
                                                                            " · ",
                                                                        )}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="mt-1.5 text-sm font-semibold text-texto">
                                                                Alojamiento garantizado en establecimiento específico con bloqueo de plazas.
                                                            </p>
                                                        );
                                                    })()
                                                ) : (
                                                    <p className="mt-1.5 text-sm font-semibold text-texto">
                                                        {[
                                                            paqueteVistaPrevia.categoriaGarantizada
                                                                ? `Categoría ${paqueteVistaPrevia.categoriaGarantizada}`
                                                                : null,
                                                            paqueteVistaPrevia.localidadGarantizada
                                                                ? `Localidad: ${paqueteVistaPrevia.localidadGarantizada}`
                                                                : null,
                                                            paqueteVistaPrevia.tipoHabitacionGarantizada
                                                                ? `Habitación ${paqueteVistaPrevia.tipoHabitacionGarantizada}`
                                                                : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" · ") ||
                                                            "Garantía general por categoría hotelera."}
                                                    </p>
                                                )}
                                            </div>

                                            {/* TARIFAS POR TEMPORADA */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                    Matriz de tarifas vigentes
                                                </p>
                                                {tarifasVigentes(paqueteVistaPrevia).length > 0 ? (
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        {tarifasVigentes(paqueteVistaPrevia).map(
                                                            (tarifa) => (
                                                                <div
                                                                    key={
                                                                        tarifa.idtemporada
                                                                    }
                                                                    className="flex items-center justify-between rounded border border-borde bg-white px-3 py-2 text-xs"
                                                                >
                                                                    <span className="font-medium text-texto">
                                                                        {tarifa
                                                                            .temporada
                                                                            ?.nombre ??
                                                                            `Temporada #${tarifa.idtemporada}`}
                                                                    </span>
                                                                    <span className="font-bold text-navegacion">
                                                                        {
                                                                            tarifa.moneda
                                                                        }{" "}
                                                                        {
                                                                            tarifa.monto
                                                                        }
                                                                    </span>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-xs text-texto-suave">
                                                        Sin tarifas vigentes.
                                                    </p>
                                                )}
                                            </div>

                                            {/* SERVICIOS INCLUIDOS */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                    Servicios incluidos
                                                    {detalleVistaPrevia
                                                        ? ` (${detalleVistaPrevia.servicios?.length ?? 0})`
                                                        : ""}
                                                </p>
                                                {!detalleVistaPrevia ? (
                                                    <p className="mt-1 text-xs text-texto-suave">
                                                        {textoSinDetalle}
                                                    </p>
                                                ) : paqueteVistaPrevia.servicios &&
                                                paqueteVistaPrevia.servicios
                                                    .length > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {paqueteVistaPrevia.servicios.map(
                                                            (item) => (
                                                                <span
                                                                    key={
                                                                        item.idservicio
                                                                    }
                                                                    className="rounded-full border border-borde bg-white px-2.5 py-1 text-xs font-medium text-texto"
                                                                >
                                                                    {item
                                                                        .servicio
                                                                        ?.nombreServicio ??
                                                                        `Servicio #${item.idservicio}`}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-xs text-texto-suave">
                                                        Sin servicios adicionales incluidos.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-fondo/40 px-6 py-4">
                                        <Boton
                                            variante="fantasma"
                                            onClick={() => {
                                                const id =
                                                    paqueteVistaPrevia.idpaquete;
                                                cerrarVistaPrevia();
                                                navegar(
                                                    `/catalogo?vista=admin&paquete=${id}`,
                                                );
                                            }}
                                        >
                                            👁 Ver como cliente en la tienda ↗
                                        </Boton>

                                        <div className="flex flex-wrap items-center gap-3">
                                            {paqueteVistaPrevia.estado ===
                                            "ACTIVO" ? (
                                                <>
                                                    <Boton
                                                        variante="secundario"
                                                        onClick={() =>
                                                            iniciarSubidaImagenRapida(
                                                                paqueteVistaPrevia,
                                                            )
                                                        }
                                                    >
                                                        Subir / cambiar imágenes (1 a 5)
                                                    </Boton>
                                                    <Boton
                                                        onClick={() => {
                                                            const p =
                                                                paqueteVistaPrevia;
                                                            cerrarVistaPrevia();
                                                            abrirFormulario(p);
                                                        }}
                                                    >
                                                        Editar paquete
                                                    </Boton>
                                                </>
                                            ) : null}
                                            <Boton
                                                variante="fantasma"
                                                onClick={cerrarVistaPrevia}
                                            >
                                                Cerrar vista previa
                                            </Boton>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                </Modal>
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
