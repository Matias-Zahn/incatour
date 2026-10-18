import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    resolverUrlImagenPaquete,
    useDarDeBajaPaquete,
    useModificarPaquete,
    usePaquetes,
    useRegistrarPaquete,
    useServiciosDisponiblesCatalogo,
    useSubirImagenPaquete,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type Paquete,
} from "../../services/paqueteService";
import { useTemporadas } from "../../services/temporadaService";

const ELEMENTOS_POR_PAGINA = 5;
const FORMATOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_IMAGEN_BYTES = 3 * 1024 * 1024;
const MAX_IMAGENES_PAQUETE = 5;

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

function PaquetesPage() {
    const navegar = useNavigate();
    const { data: paquetes = [], isPending, isError, error } = usePaquetes();
    const { data: circuitos = [] } = useCircuitos();
    const { data: temporadas = [] } = useTemporadas();
    const { data: serviciosDisponibles = [] } =
        useServiciosDisponiblesCatalogo();

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

    const paqueteVistaPrevia =
        paquetes.find((p) => p.idpaquete === paqueteVistaPreviaId) ?? null;

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
        try {
            setErrorFormulario("");
            setMensajeExito("");
            const creado = await registrar.mutateAsync(datos);
            if (imagenesArchivos && imagenesArchivos.length > 0) {
                const resImg = await subirImagen.mutateAsync({
                    id: creado.idpaquete,
                    archivos: imagenesArchivos,
                    metodo: "POST",
                });
                const cantidad = resImg.urls?.length ?? imagenesArchivos.length;
                setMensajeExito(
                    `Paquete "${creado.nombrePaquete}" publicado con ${cantidad} ${cantidad === 1 ? "imagen guardada" : "imágenes guardadas"}.`,
                );
            }
            cerrarFormulario();
        } catch (e) {
            setErrorFormulario(
                e instanceof Error
                    ? e.message
                    : "Ocurrió un error al registrar el paquete.",
            );
        }
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

                <div className="flex flex-wrap gap-2">
                    <Boton
                        variante="secundario"
                        onClick={() => navegar("/catalogo?vista=admin")}
                    >
                        👁 Ver tienda como cliente
                    </Boton>
                    <Boton onClick={() => abrirFormulario()}>
                        Nuevo paquete turístico
                    </Boton>
                </div>
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
                                renderizar: (paquete) => {
                                    const galeria = obtenerGaleriaPaquete(paquete);
                                    const urlPortada = resolverUrlImagenPaquete(
                                        galeria[0],
                                    );
                                    return (
                                        <div className="flex items-start gap-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirVistaPrevia(paquete)
                                                }
                                                title="Ver vista previa y galería del paquete"
                                                className="group relative shrink-0 overflow-hidden rounded-control border border-borde bg-fondo focus:ring-2 focus:ring-marca focus:outline-none"
                                            >
                                                <img
                                                    src={urlPortada}
                                                    alt={paquete.nombrePaquete}
                                                    className="h-14 w-20 object-cover transition group-hover:scale-105"
                                                />
                                                <span className="absolute right-1 bottom-1 rounded bg-navegacion/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                    {galeria.length}{" "}
                                                    {galeria.length === 1
                                                        ? "foto"
                                                        : "fotos"}
                                                </span>
                                            </button>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded bg-marca-activa px-2 py-0.5 text-xs font-bold text-marca-oscura">
                                                        {paquete.nroPaquete}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirVistaPrevia(
                                                                paquete,
                                                            )
                                                        }
                                                        className="text-left font-semibold text-texto hover:text-marca-oscura hover:underline"
                                                    >
                                                        {paquete.nombrePaquete}
                                                    </button>
                                                </div>
                                                {paquete.condiciones ? (
                                                    <p className="mt-1 line-clamp-2 text-xs text-texto-suave">
                                                        {paquete.condiciones}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                },
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
                                            onClick={() =>
                                                abrirVistaPrevia(paquete)
                                            }
                                        >
                                            Vista previa
                                        </Boton>
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
                                            variante="secundario"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={
                                                paquete.estado === "INACTIVO" ||
                                                (subirImagen.isPending &&
                                                    idPaqueteParaImagen ===
                                                        paquete.idpaquete)
                                            }
                                            onClick={() =>
                                                iniciarSubidaImagenRapida(
                                                    paquete,
                                                )
                                            }
                                        >
                                            {subirImagen.isPending &&
                                            idPaqueteParaImagen ===
                                                paquete.idpaquete
                                                ? "Subiendo..."
                                                : "Subir imágenes (1-5)"}
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

            {/* MODAL DE VISTA PREVIA Y CONTEXTO DEL PAQUETE */}
            {paqueteVistaPrevia ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-navegacion/60 p-4 backdrop-blur-xs"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-vista-previa-paquete"
                    onClick={cerrarVistaPrevia}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-tarjeta border border-borde bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
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
                                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estiloEstado(
                                                        paqueteVistaPrevia.estado,
                                                    )}`}
                                                >
                                                    {paqueteVistaPrevia.estado}
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
                                                            <span className="absolute bottom-0.5 left-0.5 rounded bg-navegacion/80 px-1 text-[9px] font-bold text-white">
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
                                                        <p className="text-[11px] text-texto-suave">
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
                                                        <p className="text-[11px] text-texto-suave">
                                                            Noches previas
                                                        </p>
                                                        <p className="text-sm font-bold text-navegacion">
                                                            {
                                                                paqueteVistaPrevia.nochesPrevias
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="rounded bg-white p-2 border border-borde">
                                                        <p className="text-[11px] text-texto-suave">
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
                                                <p className="mt-1.5 text-sm font-semibold text-texto">
                                                    {porEst
                                                        ? "Alojamiento garantizado en establecimiento específico con bloqueo de plazas."
                                                        : [
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
                                            </div>

                                            {/* TARIFAS POR TEMPORADA */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                    Matriz de tarifas vigentes
                                                </p>
                                                {paqueteVistaPrevia.tarifas &&
                                                paqueteVistaPrevia.tarifas
                                                    .length > 0 ? (
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        {paqueteVistaPrevia.tarifas.map(
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
                                                        Sin tarifas registradas.
                                                    </p>
                                                )}
                                            </div>

                                            {/* SERVICIOS INCLUIDOS */}
                                            {paqueteVistaPrevia.servicios &&
                                            paqueteVistaPrevia.servicios
                                                .length > 0 ? (
                                                <div className="rounded-control border border-borde bg-fondo/40 p-4">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                                        Servicios incluidos (
                                                        {
                                                            paqueteVistaPrevia
                                                                .servicios
                                                                .length
                                                        }
                                                        )
                                                    </p>
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
                                                </div>
                                            ) : null}
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
                    </div>
                </div>
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
