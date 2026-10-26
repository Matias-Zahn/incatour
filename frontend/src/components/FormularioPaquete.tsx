import { useState } from "react";
import { Link } from "react-router-dom";
import Boton from "./Boton";
import type { Circuito } from "../services/circuitoService";
import {
    DIAS_HABILES,
    DIAS_SEMANA,
    FIN_DE_SEMANA,
    TODOS_LOS_DIAS,
    extraerNombreFotoCarrusel,
    parsearDiasDisponibles,
    resolverUrlImagenPaquete,
    serializarDiasDisponibles,
    useEliminarFotoIndividualPaquete,
    useModificarFotoIndividualPaquete,
    usePaqueteDetalle,
    type CodigoDia,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type Paquete,
    type PrecioTemporadaInput,
    type ServicioDisponiblePaquete,
    type TipoGarantiaPaquete,
} from "../services/paqueteService";
import type { Temporada } from "../services/temporadaService";

type FormularioPaqueteProps = {
    paqueteEnEdicion?: Paquete | null;
    circuitos: Circuito[];
    temporadas: Temporada[];
    serviciosDisponibles: ServicioDisponiblePaquete[];
    errorCargaServicios?: string;
    alGuardarNuevo: (
        datos: DatosCrearPaquete,
        imagenesArchivos?: File[],
    ) => void;
    alGuardarEdicion: (
        id: number,
        datos: DatosModificarPaquete,
        imagenesArchivos?: File[],
    ) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

const FORMATOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_IMAGEN_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_IMAGENES_PAQUETE = 5;

const CATEGORIAS_SUGERIDAS = [
    "3 Estrellas",
    "4 Estrellas",
    "5 Estrellas",
    "Boutique",
];

const HABITACIONES_SUGERIDAS = ["Doble", "Simple", "Triple", "Matrimonial"];

const LOCALIDADES_SUGERIDAS = [
    "Cusco",
    "Ollantaytambo",
    "Aguas Calientes",
    "Valle Sagrado",
];

function normalizarTipoGarantiaInicial(valor?: string): TipoGarantiaPaquete {
    if (!valor) return "POR_CATEGORIA";
    const limpio = valor.toUpperCase();
    if (limpio.includes("ESTABLECIMIENTO")) {
        return "POR_ESTABLECIMIENTO";
    }
    return "POR_CATEGORIA";
}

function tarifasIniciales(
    paquete?: Paquete | null,
    temporadas: Temporada[] = [],
): PrecioTemporadaInput[] {
    if (paquete?.tarifas && paquete.tarifas.length > 0) {
        return paquete.tarifas.map((tarifa) => ({
            idtemporada: tarifa.idtemporada,
            monto: tarifa.monto,
            moneda: tarifa.moneda,
        }));
    }
    const primeraTemporada = temporadas[0]?.idtemporada ?? 0;
    return [
        {
            idtemporada: primeraTemporada,
            monto: 650,
            moneda: "USD",
        },
    ];
}

function FormularioPaquete({
    paqueteEnEdicion,
    circuitos,
    temporadas,
    serviciosDisponibles,
    errorCargaServicios,
    alGuardarNuevo,
    alGuardarEdicion,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioPaqueteProps) {
    const esEdicion = Boolean(paqueteEnEdicion);

    const circuitoConEtapas =
        circuitos.find((c) => (c.etapas?.length ?? 0) > 0) ?? circuitos[0];

    const [idcircuito, setIdcircuito] = useState<number>(
        paqueteEnEdicion?.idcircuito ?? circuitoConEtapas?.idcircuito ?? 0,
    );
    const [nombrePaquete, setNombrePaquete] = useState(
        paqueteEnEdicion?.nombrePaquete ?? "",
    );
    const [condiciones, setCondiciones] = useState(
        paqueteEnEdicion?.condiciones ?? "",
    );
    const [nochesPrevias, setNochesPrevias] = useState<number>(
        paqueteEnEdicion?.nochesPrevias ?? 0,
    );
    const [nochesPosteriores, setNochesPosteriores] = useState<number>(
        paqueteEnEdicion?.nochesPosteriores ?? 0,
    );
    // Vacío = sin plazo: el reintegro es siempre del 100% (RES-06)
    const [diasMinimosReintegro, setDiasMinimosReintegro] = useState<string>(
        paqueteEnEdicion?.diasMinimosReintegro != null
            ? String(paqueteEnEdicion.diasMinimosReintegro)
            : "",
    );
    const [diasSeleccionados, setDiasSeleccionados] = useState<CodigoDia[]>(
        () => parsearDiasDisponibles(paqueteEnEdicion?.diasDisponibles),
    );

    const [tipoGarantia, setTipoGarantia] = useState<TipoGarantiaPaquete>(
        normalizarTipoGarantiaInicial(paqueteEnEdicion?.tipoGarantia),
    );

    const alojamientosDisponibles = serviciosDisponibles.filter(
        (s) => s.tipo === "ALOJAMIENTO",
    );
    const primerAlojamientoBloqueo = alojamientosDisponibles.find(
        (s) =>
            (s.datos?.modalidadConfirmacion ??
                s.disponibilidad?.modalidadConfirmacion) === "BLOQUEO_PLAZAS",
    );

    const {
        data: detallePaquete,
        isLoading: cargandoDetalle,
        isError: errorDetalle,
    } = usePaqueteDetalle(paqueteEnEdicion?.idpaquete ?? null);
    // GET /paquetes no trae servicios ni garantías: hasta tener el detalle no se puede guardar
    const detalleBloqueado = esEdicion && !detallePaquete;

    const [idservicioGarantizadoEditado, setIdservicioGarantizado] = useState<
        number | null
    >(null);
    const idservicioGarantizado =
        idservicioGarantizadoEditado ??
        paqueteEnEdicion?.garantiasEstablecimiento?.[0]?.idservicio ??
        detallePaquete?.garantiasEstablecimiento?.[0]?.idservicio ??
        primerAlojamientoBloqueo?.idservicio ??
        alojamientosDisponibles[0]?.idservicio ??
        0;

    const [localidadGarantizada, setLocalidadGarantizada] = useState(
        paqueteEnEdicion?.localidadGarantizada ?? "Cusco",
    );
    const [categoriaGarantizada, setCategoriaGarantizada] = useState(
        paqueteEnEdicion?.categoriaGarantizada ?? "3 Estrellas",
    );
    const [tipoHabitacionGarantizada, setTipoHabitacionGarantizada] = useState(
        paqueteEnEdicion?.tipoHabitacionGarantizada ?? "Doble",
    );

    const temporadasPersistidas = new Set(
        paqueteEnEdicion?.tarifas?.map((t) => t.idtemporada) ?? [],
    );

    const [matrizPrecios, setMatrizPrecios] = useState<PrecioTemporadaInput[]>(
        () => tarifasIniciales(paqueteEnEdicion, temporadas),
    );
    const [serviciosIncluidosEditados, setServiciosIncluidosEditados] =
        useState<number[] | null>(null);
    const serviciosIncluidos =
        serviciosIncluidosEditados ??
        paqueteEnEdicion?.servicios?.map((item) => item.idservicio) ??
        detallePaquete?.servicios?.map((item) => item.idservicio) ??
        [];
    const [imagenesArchivos, setImagenesArchivos] = useState<File[]>([]);
    const [vistasPrevias, setVistasPrevias] = useState<string[]>([]);
    const [errorValidacion, setErrorValidacion] = useState("");
    const [mensajeFotoIndividual, setMensajeFotoIndividual] = useState("");
    const [imagenesServidorEditadas, setImagenesServidorEditadas] = useState<
        string[] | null
    >(null);
    const [tienePropiasEditado, setTienePropiasEditado] = useState<
        boolean | null
    >(null);

    const mutacionModificarFoto = useModificarFotoIndividualPaquete();
    const mutacionEliminarFoto = useEliminarFotoIndividualPaquete();

    const imagenesActualesPaquete: string[] =
        imagenesServidorEditadas ??
        (paqueteEnEdicion?.imagenes && paqueteEnEdicion.imagenes.length > 0
            ? paqueteEnEdicion.imagenes
            : paqueteEnEdicion?.imagenPrincipal
              ? [paqueteEnEdicion.imagenPrincipal]
              : []);

    const tieneImagenesPropiasActual =
        tienePropiasEditado ?? Boolean(paqueteEnEdicion?.tieneImagenesPropias);

    const SLOTS_CARRUSEL = [
        "principal",
        "foto_2",
        "foto_3",
        "foto_4",
        "foto_5",
    ] as const;

    function obtenerProximoSlotLibre(): string {
        const usados = new Set(
            imagenesActualesPaquete.map((url, idx) =>
                extraerNombreFotoCarrusel(url, idx),
            ),
        );
        for (const slot of SLOTS_CARRUSEL) {
            if (!usados.has(slot)) return slot;
        }
        return `foto_${Math.min(5, imagenesActualesPaquete.length + 1)}`;
    }

    async function manejarReemplazarFotoIndividual(
        nombreFoto: string,
        indice: number,
        evento: React.ChangeEvent<HTMLInputElement>,
    ) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || !paqueteEnEdicion) return;

        setErrorValidacion("");
        setMensajeFotoIndividual("");

        if (!FORMATOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
            setErrorValidacion(
                `El archivo "${archivo.name}" no tiene un formato válido (JPG, PNG o WEBP).`,
            );
            return;
        }
        if (archivo.size > TAMANO_MAXIMO_IMAGEN_BYTES) {
            setErrorValidacion(
                `El archivo "${archivo.name}" supera el límite de 3 MB.`,
            );
            return;
        }

        try {
            const res = await mutacionModificarFoto.mutateAsync({
                id: paqueteEnEdicion.idpaquete,
                nombreFoto,
                archivo,
            });
            const urlConCacheBust = `${res.url}?v=${Date.now()}`;
            setImagenesServidorEditadas((prev) => {
                const base = [...(prev ?? imagenesActualesPaquete)];
                if (indice >= 0 && indice < base.length) {
                    base[indice] = urlConCacheBust;
                } else {
                    base.push(urlConCacheBust);
                }
                return base;
            });
            setTienePropiasEditado(true);
            setMensajeFotoIndividual(
                indice >= 0
                    ? `✓ Se actualizó "${nombreFoto === "principal" ? "Portada principal" : nombreFoto}" correctamente.`
                    : `✓ Se agregó una nueva foto (${nombreFoto}) a la galería del paquete.`,
            );
        } catch (err) {
            setErrorValidacion(
                err instanceof Error
                    ? err.message
                    : "No se pudo actualizar la foto individual.",
            );
        }
    }

    async function manejarEliminarFotoIndividual(
        nombreFoto: string,
        indice: number,
    ) {
        if (!paqueteEnEdicion) return;
        if (imagenesActualesPaquete.length <= 1) {
            setErrorValidacion(
                "El paquete debe conservar como mínimo 1 imagen. Si querés cambiarla, usá el botón «Cambiar».",
            );
            return;
        }

        setErrorValidacion("");
        setMensajeFotoIndividual("");

        try {
            await mutacionEliminarFoto.mutateAsync({
                id: paqueteEnEdicion.idpaquete,
                nombreFoto,
            });
            setImagenesServidorEditadas((prev) => {
                const base = [...(prev ?? imagenesActualesPaquete)];
                return base.filter((_, idx) => idx !== indice);
            });
            setMensajeFotoIndividual(
                `✓ Se eliminó "${nombreFoto === "principal" ? "Portada principal" : nombreFoto}" de la galería.`,
            );
        } catch (err) {
            setErrorValidacion(
                err instanceof Error
                    ? err.message
                    : "No se pudo eliminar la foto del carrusel.",
            );
        }
    }

    const circuitoSeleccionado = circuitos.find(
        (c) => c.idcircuito === idcircuito,
    );
    const cantidadEtapasCircuito = circuitoSeleccionado?.etapas?.length ?? 0;

    function manejarSeleccionImagenes(
        evento: React.ChangeEvent<HTMLInputElement>,
    ) {
        setErrorValidacion("");
        const listaSeleccionada = Array.from(evento.target.files ?? []);
        evento.target.value = "";
        if (listaSeleccionada.length === 0) {
            return;
        }

        if (
            imagenesArchivos.length + listaSeleccionada.length >
            MAX_IMAGENES_PAQUETE
        ) {
            setErrorValidacion(
                `Solo se permiten hasta ${MAX_IMAGENES_PAQUETE} imágenes por paquete (actualmente tenés ${imagenesArchivos.length} seleccionadas).`,
            );
            return;
        }

        for (const archivo of listaSeleccionada) {
            if (!FORMATOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
                setErrorValidacion(
                    `El archivo "${archivo.name}" no tiene un formato válido. Solo se permiten JPG, PNG o WEBP.`,
                );
                return;
            }
            if (archivo.size > TAMANO_MAXIMO_IMAGEN_BYTES) {
                setErrorValidacion(
                    `El archivo "${archivo.name}" supera el tamaño máximo permitido de 3 MB.`,
                );
                return;
            }
        }

        const nuevasUrls = listaSeleccionada.map((archivo) =>
            URL.createObjectURL(archivo),
        );
        setImagenesArchivos((prev) => [...prev, ...listaSeleccionada]);
        setVistasPrevias((prev) => [...prev, ...nuevasUrls]);
    }

    function quitarImagenEnIndice(indice: number) {
        setVistasPrevias((prev) => {
            const urlQuitada = prev[indice];
            if (urlQuitada) URL.revokeObjectURL(urlQuitada);
            return prev.filter((_, idx) => idx !== indice);
        });
        setImagenesArchivos((prev) => prev.filter((_, idx) => idx !== indice));
    }

    function promoverImagenAPortada(indice: number) {
        if (indice <= 0 || indice >= imagenesArchivos.length) return;
        setImagenesArchivos((prev) => {
            const copia = [...prev];
            const [elegida] = copia.splice(indice, 1);
            return elegida ? [elegida, ...copia] : prev;
        });
        setVistasPrevias((prev) => {
            const copia = [...prev];
            const [elegida] = copia.splice(indice, 1);
            return elegida ? [elegida, ...copia] : prev;
        });
    }

    function limpiarTodasLasImagenesSeleccionadas() {
        for (const url of vistasPrevias) {
            URL.revokeObjectURL(url);
        }
        setImagenesArchivos([]);
        setVistasPrevias([]);
    }

    function alternarDia(codigo: CodigoDia) {
        setErrorValidacion("");
        setDiasSeleccionados((previos) => {
            if (previos.includes(codigo)) {
                if (previos.length <= 1) return previos;
                return previos.filter((item) => item !== codigo);
            }
            return [...previos, codigo];
        });
    }

    function alternarServicioIncluido(idServicio: number) {
        setErrorValidacion("");
        setServiciosIncluidosEditados((previos) => {
            const base = previos ?? serviciosIncluidos;
            return base.includes(idServicio)
                ? base.filter((id) => id !== idServicio)
                : [...base, idServicio];
        });
    }

    function actualizarFilaPrecio(
        indice: number,
        cambios: Partial<PrecioTemporadaInput>,
    ) {
        setErrorValidacion("");
        setMatrizPrecios((previas) =>
            previas.map((fila, idx) =>
                idx === indice ? { ...fila, ...cambios } : fila,
            ),
        );
    }

    function agregarFilaPrecio() {
        setErrorValidacion("");
        const usadas = new Set(matrizPrecios.map((f) => f.idtemporada));
        const temporadaLibre = temporadas.find(
            (t) => !usadas.has(t.idtemporada),
        );
        if (!temporadaLibre) {
            setErrorValidacion(
                "Ya agregaste una tarifa para todas las temporadas activas disponibles.",
            );
            return;
        }
        setMatrizPrecios((previas) => [
            ...previas,
            {
                idtemporada: temporadaLibre.idtemporada,
                monto: 650,
                moneda: "USD",
            },
        ]);
    }

    function quitarFilaPrecio(indice: number) {
        const fila = matrizPrecios[indice];
        if (esEdicion && fila && temporadasPersistidas.has(fila.idtemporada)) {
            return;
        }
        if (matrizPrecios.length <= 1) {
            setErrorValidacion(
                "El paquete debe tener al menos una tarifa vigente en su matriz de precios.",
            );
            return;
        }
        setErrorValidacion("");
        setMatrizPrecios((previas) =>
            previas.filter((_, idx) => idx !== indice),
        );
    }

    function manejarSubmit(evento: React.FormEvent) {
        evento.preventDefault();
        setErrorValidacion("");

        if (!nombrePaquete.trim()) {
            setErrorValidacion("El nombre del paquete es obligatorio.");
            return;
        }

        if (diasSeleccionados.length === 0) {
            setErrorValidacion(
                "Seleccioná al menos un día de salida habilitado.",
            );
            return;
        }

        if (nochesPrevias < 0 || nochesPosteriores < 0) {
            setErrorValidacion(
                "Las noches previas y posteriores deben ser mayores o iguales a 0.",
            );
            return;
        }

        if (matrizPrecios.length === 0) {
            setErrorValidacion(
                "La matriz de precios debe contener al menos una tarifa.",
            );
            return;
        }

        const temporadasVistas = new Set<number>();
        for (let i = 0; i < matrizPrecios.length; i++) {
            const fila = matrizPrecios[i];
            if (!fila.idtemporada || fila.idtemporada <= 0) {
                setErrorValidacion(
                    `Seleccioná una temporada válida en la fila #${i + 1} de precios.`,
                );
                return;
            }
            if (!Number.isFinite(fila.monto) || fila.monto <= 0) {
                setErrorValidacion(
                    `El monto en la fila #${i + 1} debe ser mayor a 0.`,
                );
                return;
            }
            if (temporadasVistas.has(fila.idtemporada)) {
                setErrorValidacion(
                    "No podés repetir la misma temporada en la matriz de precios.",
                );
                return;
            }
            temporadasVistas.add(fila.idtemporada);
        }

        const diasSerializados = serializarDiasDisponibles(diasSeleccionados);

        if (!idcircuito || idcircuito <= 0) {
            setErrorValidacion("Seleccioná un circuito turístico base.");
            return;
        }

        if (cantidadEtapasCircuito === 0) {
            setErrorValidacion(
                "El circuito seleccionado todavía no tiene etapas cargadas. Configuralas antes de guardar el paquete.",
            );
            return;
        }

        if (tipoGarantia === "POR_ESTABLECIMIENTO") {
            if (!idservicioGarantizado || idservicioGarantizado <= 0) {
                setErrorValidacion(
                    "Seleccioná el establecimiento de alojamiento garantizado.",
                );
                return;
            }
        } else {
            if (!localidadGarantizada.trim()) {
                setErrorValidacion(
                    "Con garantía por categoría, la localidad garantizada es obligatoria.",
                );
                return;
            }
            if (!categoriaGarantizada.trim()) {
                setErrorValidacion(
                    "Con garantía por categoría, la categoría garantizada es obligatoria.",
                );
                return;
            }
            // FE-49: el back también la exige; se avisa acá en vez de esperar el 400
            if (!tipoHabitacionGarantizada.trim()) {
                setErrorValidacion(
                    "Con garantía por categoría, el tipo de habitación garantizado es obligatorio.",
                );
                return;
            }
        }

        const payloadComun: DatosCrearPaquete = {
            idcircuito,
            nombrePaquete: nombrePaquete.trim(),
            condiciones: condiciones.trim() || undefined,
            tipoGarantia,
            ...(tipoGarantia === "POR_ESTABLECIMIENTO"
                ? // En edición sin tocar la garantía no se manda: el back la deja como está
                  esEdicion &&
                  idservicioGarantizadoEditado === null &&
                  tipoGarantia ===
                      normalizarTipoGarantiaInicial(
                          paqueteEnEdicion?.tipoGarantia,
                      )
                    ? {}
                    : { idservicioGarantizado }
                : {
                      localidadGarantizada: localidadGarantizada.trim(),
                      categoriaGarantizada: categoriaGarantizada.trim(),
                      tipoHabitacionGarantizada:
                          tipoHabitacionGarantizada.trim() || undefined,
                  }),
            nochesPrevias,
            nochesPosteriores,
            diasMinimosReintegro:
                diasMinimosReintegro === ""
                    ? null
                    : Math.max(0, Math.trunc(Number(diasMinimosReintegro))),
            diasDisponibles: diasSerializados,
            matrizPrecios,
            serviciosIncluidos,
        };

        if (esEdicion && paqueteEnEdicion) {
            // Solo se manda si el usuario los tocó: reenviarlos falla si hay servicios dados de baja
            const sinServicios: Partial<DatosCrearPaquete> = {
                ...payloadComun,
            };
            delete sinServicios.serviciosIncluidos;
            alGuardarEdicion(
                paqueteEnEdicion.idpaquete,
                {
                    ...(serviciosIncluidosEditados === null
                        ? sinServicios
                        : payloadComun),
                    condiciones: condiciones.trim(),
                },
                imagenesArchivos,
            );
            return;
        }

        alGuardarNuevo(payloadComun, imagenesArchivos);
    }

    const mensajeError = errorValidacion || errorServidor;

    return (
        <form
            className="space-y-6 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={manejarSubmit}
        >
            <div className="border-b border-borde pb-4">
                <h2 className="text-xl font-bold text-navegacion">
                    {esEdicion
                        ? `Editar paquete: ${paqueteEnEdicion?.nombrePaquete}`
                        : "Configurar nuevo paquete turístico"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    {esEdicion
                        ? "Actualizá el circuito asociado, la modalidad de garantía, los servicios incluidos y el cuadro tarifario por temporada."
                        : "Completá los pasos para publicar un paquete comercial con garantía de alojamiento y tarifas por temporada."}
                </p>
            </div>

            {/* PASO 1: IDENTIFICACIÓN Y CIRCUITO BASE */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                        1
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                        Identificación y circuito base
                    </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                        Nombre comercial del paquete
                        <input
                            type="text"
                            value={nombrePaquete}
                            onChange={(e) => setNombrePaquete(e.target.value)}
                            placeholder="Ej. Inca Clásico Standard"
                            className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            autoFocus
                        />
                    </label>

                    <div className="grid gap-1.5 text-sm font-semibold text-texto">
                        <label htmlFor="select-circuito">
                            Circuito turístico asociado
                        </label>
                        <select
                            id="select-circuito"
                            value={idcircuito}
                            onChange={(e) =>
                                setIdcircuito(Number(e.target.value))
                            }
                            className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                        >
                            {circuitos.map((circuito) => {
                                const numEtapas =
                                    circuito.etapas?.length ?? 0;
                                return (
                                    <option
                                        key={circuito.idcircuito}
                                        value={circuito.idcircuito}
                                    >
                                        {circuito.nombreCircuito} (
                                        {circuito.duracionDias}{" "}
                                        {circuito.duracionDias === 1
                                            ? "día"
                                            : "días"}{" "}
                                        · Dif. {circuito.dificultad} ·{" "}
                                        {numEtapas}{" "}
                                        {numEtapas === 1 ? "etapa" : "etapas"})
                                    </option>
                                );
                            })}
                        </select>
                        {circuitoSeleccionado ? (
                            cantidadEtapasCircuito > 0 ? (
                                <p className="text-xs font-normal text-exito">
                                    ✓ Circuito válido con{" "}
                                    {cantidadEtapasCircuito}{" "}
                                    {cantidadEtapasCircuito === 1
                                        ? "etapa definida"
                                        : "etapas definidas"}
                                    .
                                </p>
                            ) : (
                                <p className="text-xs font-normal text-peligro">
                                    ⚠ Este circuito no tiene etapas cargadas.{" "}
                                    <Link
                                        to={`/gestion/circuitos/${circuitoSeleccionado.idcircuito}/etapas`}
                                        className="font-semibold underline"
                                    >
                                        Cargar etapas ahora →
                                    </Link>
                                </p>
                            )
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                        Noches previas al circuito
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={nochesPrevias}
                            onChange={(e) =>
                                setNochesPrevias(
                                    Math.max(0, Number(e.target.value) || 0),
                                )
                            }
                            className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </label>

                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                        Noches posteriores al circuito
                        <input
                            type="number"
                            min={0}
                            step={1}
                            value={nochesPosteriores}
                            onChange={(e) =>
                                setNochesPosteriores(
                                    Math.max(0, Number(e.target.value) || 0),
                                )
                            }
                            className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                        />
                    </label>

                    <div className="grid gap-1.5 text-sm font-semibold text-texto">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>Días de salida habilitados</span>
                            <div className="flex gap-1.5 text-[11px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDiasSeleccionados([
                                            ...TODOS_LOS_DIAS,
                                        ])
                                    }
                                    className="rounded bg-fondo px-2 py-0.5 text-texto-suave hover:bg-marca-suave hover:text-marca-oscura"
                                >
                                    Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDiasSeleccionados([...DIAS_HABILES])
                                    }
                                    className="rounded bg-fondo px-2 py-0.5 text-texto-suave hover:bg-marca-suave hover:text-marca-oscura"
                                >
                                    Lun a Vie
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDiasSeleccionados([...FIN_DE_SEMANA])
                                    }
                                    className="rounded bg-fondo px-2 py-0.5 text-texto-suave hover:bg-marca-suave hover:text-marca-oscura"
                                >
                                    Fin de semana
                                </button>
                            </div>
                        </div>

                        <div
                            role="group"
                            aria-label="Seleccionar días de salida habilitados"
                            className="grid grid-cols-7 gap-1.5"
                        >
                            {DIAS_SEMANA.map((dia) => {
                                const activo = diasSeleccionados.includes(
                                    dia.codigo,
                                );
                                return (
                                    <button
                                        key={dia.codigo}
                                        type="button"
                                        title={dia.nombre}
                                        aria-pressed={activo}
                                        onClick={() => alternarDia(dia.codigo)}
                                        className={`rounded-control border py-2 text-center text-xs font-bold transition-colors ${
                                            activo
                                                ? "border-marca bg-marca text-white shadow-sm"
                                                : "border-borde bg-white text-texto-suave hover:border-marca/40 hover:text-texto"
                                        }`}
                                    >
                                        {dia.corto}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <label className="grid gap-1.5 text-sm font-semibold text-texto md:max-w-xs">
                    Días mínimos para reintegro (opcional)
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={diasMinimosReintegro}
                        onChange={(e) => setDiasMinimosReintegro(e.target.value)}
                        placeholder="Sin plazo"
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                    <span className="text-xs font-normal text-texto-suave">
                        Si el cliente cancela con menos anticipación, no recibe reintegro.
                    </span>
                </label>

                <label className="grid gap-1.5 text-sm font-semibold text-texto">
                    Condiciones comerciales y observaciones (opcional)
                    <input
                        type="text"
                        value={condiciones}
                        onChange={(e) => setCondiciones(e.target.value)}
                        placeholder="Ej. Incluye aclimatación en Cusco y traslados desde el aeropuerto."
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>
            </div>

            {/* PASO 2: GARANTÍA DE ALOJAMIENTO */}
            <div className="space-y-4 border-t border-borde pt-5">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                            2
                        </span>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                                Modalidad de garantía de alojamiento
                            </h3>
                            <p className="text-xs text-texto-suave">
                                Elegí si el paquete garantiza una categoría de hotel en la localidad o un establecimiento específico con bloqueo de plazas.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setTipoGarantia("POR_CATEGORIA")}
                            className={`rounded-control border p-4 text-left transition-colors ${
                                tipoGarantia === "POR_CATEGORIA"
                                    ? "border-marca bg-marca-suave/60 ring-2 ring-marca/20"
                                    : "border-borde bg-white hover:bg-fondo"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-navegacion">
                                    Garantía por Categoría
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-marca-oscura">
                                    Flexible
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-texto-suave">
                                Garantiza localidad, categoría de estrellas y tipo de habitación. Permite resolver alojamiento a solicitud.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setTipoGarantia("POR_ESTABLECIMIENTO")
                            }
                            className={`rounded-control border p-4 text-left transition-colors ${
                                tipoGarantia === "POR_ESTABLECIMIENTO"
                                    ? "border-marca bg-marca-suave/60 ring-2 ring-marca/20"
                                    : "border-borde bg-white hover:bg-fondo"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-navegacion">
                                    Garantía por Establecimiento
                                </span>
                                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-exito">
                                    Bloqueo de plazas
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-texto-suave">
                                Garantiza un hotel específico. Exige que el servicio tenga confirmación por bloqueo de plazas.
                            </p>
                        </button>
                    </div>

                    {tipoGarantia === "POR_CATEGORIA" ? (
                        <div className="grid gap-4 rounded-control border border-borde bg-fondo/50 p-4 md:grid-cols-3">
                            <div className="grid gap-1.5 text-sm font-semibold text-texto">
                                <label htmlFor="input-localidad-garantizada">
                                    Localidad garantizada
                                </label>
                                <input
                                    id="input-localidad-garantizada"
                                    type="text"
                                    value={localidadGarantizada}
                                    onChange={(e) =>
                                        setLocalidadGarantizada(e.target.value)
                                    }
                                    placeholder="Ej. Cusco"
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                <div className="flex flex-wrap gap-1">
                                    {LOCALIDADES_SUGERIDAS.map((loc) => (
                                        <button
                                            key={loc}
                                            type="button"
                                            onClick={() =>
                                                setLocalidadGarantizada(loc)
                                            }
                                            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                                localidadGarantizada === loc
                                                    ? "bg-marca text-white"
                                                    : "bg-white text-texto-suave hover:text-texto"
                                            }`}
                                        >
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="grid content-start gap-1.5 text-sm font-semibold text-texto">
                                Categoría garantizada
                                <select
                                    value={categoriaGarantizada}
                                    onChange={(e) =>
                                        setCategoriaGarantizada(e.target.value)
                                    }
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    {CATEGORIAS_SUGERIDAS.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="grid content-start gap-1.5 text-sm font-semibold text-texto">
                                Tipo de habitación
                                <select
                                    value={tipoHabitacionGarantizada}
                                    onChange={(e) =>
                                        setTipoHabitacionGarantizada(
                                            e.target.value,
                                        )
                                    }
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    {HABITACIONES_SUGERIDAS.map((hab) => (
                                        <option key={hab} value={hab}>
                                            {hab}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-3 rounded-control border border-borde bg-fondo/50 p-4">
                            <p className="text-xs font-semibold text-texto">
                                Seleccioná el establecimiento de alojamiento garantizado:
                            </p>
                            {errorCargaServicios ? (
                                <p
                                    className="rounded-control border border-peligro/30 bg-peligro/10 p-3 text-xs text-peligro"
                                    role="alert"
                                >
                                    No se pudieron cargar los servicios de alojamiento: {errorCargaServicios}
                                </p>
                            ) : alojamientosDisponibles.length === 0 ? (
                                <p className="text-xs text-texto-suave">
                                    No se encontraron servicios de alojamiento activos. Podés registrarlos desde la sección Proveedores.
                                </p>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {alojamientosDisponibles.map((aloj) => {
                                        const modalidad =
                                            aloj.datos
                                                ?.modalidadConfirmacion ??
                                            aloj.disponibilidad
                                                ?.modalidadConfirmacion ??
                                            "";
                                        const esBloqueo =
                                            modalidad === "BLOQUEO_PLAZAS";
                                        const seleccionado =
                                            idservicioGarantizado ===
                                            aloj.idservicio;

                                        return (
                                            <button
                                                key={aloj.idservicio}
                                                type="button"
                                                disabled={
                                                    !esBloqueo ||
                                                    detalleBloqueado
                                                }
                                                onClick={() =>
                                                    setIdservicioGarantizado(
                                                        aloj.idservicio,
                                                    )
                                                }
                                                className={`rounded-control border p-3.5 text-left transition-colors ${
                                                    !esBloqueo
                                                        ? "cursor-not-allowed border-borde bg-slate-100/70 opacity-65"
                                                        : seleccionado
                                                          ? "border-marca bg-white ring-2 ring-marca/25"
                                                          : "border-borde bg-white hover:border-marca/50"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-texto">
                                                            {
                                                                aloj.nombreServicio
                                                            }
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-texto-suave">
                                                            {aloj.localidad ??
                                                                "Cusco"}{" "}
                                                            ·{" "}
                                                            {aloj.datos
                                                                ?.categoria ??
                                                                ""}{" "}
                                                            · Hab.{" "}
                                                            {aloj.datos
                                                                ?.tipoHabitacion ??
                                                                ""}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                            esBloqueo
                                                                ? "bg-green-50 text-exito"
                                                                : "bg-amber-50 text-advertencia"
                                                        }`}
                                                    >
                                                        {esBloqueo
                                                            ? "✓ Bloqueo de plazas"
                                                            : "A solicitud (No apto)"}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
            </div>

            {/* PASO 3: MATRIZ DE PRECIOS POR TEMPORADA */}
            <div className="space-y-4 border-t border-borde pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                            3
                        </span>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                                Cuadro tarifario por temporada
                            </h3>
                            <p className="text-xs text-texto-suave">
                                Todo paquete publicado requiere al menos una tarifa vigente asociada a una temporada activa.
                            </p>
                        </div>
                    </div>

                    <Boton
                        type="button"
                        variante="secundario"
                        className="px-3 py-1.5 text-xs"
                        onClick={agregarFilaPrecio}
                        disabled={
                            temporadas.length === 0 ||
                            matrizPrecios.length >= temporadas.length
                        }
                    >
                        + Agregar temporada
                    </Boton>
                </div>

                {temporadas.length === 0 ? (
                    <p className="rounded-control border border-advertencia/30 bg-amber-50 p-3 text-xs text-texto">
                        No hay temporadas activas registradas.{" "}
                        <Link
                            to="/gestion/temporadas"
                            className="font-semibold text-marca underline"
                        >
                            Crear una temporada primero →
                        </Link>
                    </p>
                ) : (
                    <div className="space-y-3">
                        {matrizPrecios.map((fila, indice) => {
                            const esTarifaPersistida =
                                esEdicion &&
                                temporadasPersistidas.has(fila.idtemporada);
                            return (
                                <div
                                    key={indice}
                                    className="grid items-end gap-3 rounded-control border border-borde bg-fondo/50 p-3.5 md:grid-cols-[1.5fr_0.7fr_1fr_auto]"
                                >
                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Temporada comercial
                                        <select
                                            value={fila.idtemporada}
                                            disabled={esTarifaPersistida}
                                            onChange={(e) =>
                                                actualizarFilaPrecio(indice, {
                                                    idtemporada: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                                        >
                                            {temporadas.map((temp) => (
                                                <option
                                                    key={temp.idtemporada}
                                                    value={temp.idtemporada}
                                                >
                                                    {temp.nombre} (
                                                    {temp.fechaInicio.slice(
                                                        0,
                                                        10,
                                                    )}{" "}
                                                    a{" "}
                                                    {temp.fechaFin.slice(
                                                        0,
                                                        10,
                                                    )}
                                                    )
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Moneda
                                        <select
                                            value={fila.moneda}
                                            onChange={(e) =>
                                                actualizarFilaPrecio(indice, {
                                                    moneda: e.target.value,
                                                })
                                            }
                                            className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        >
                                            <option value="USD">USD ($)</option>
                                            <option value="PEN">
                                                PEN (S/)
                                            </option>
                                        </select>
                                    </label>

                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Monto por pasajero
                                        <input
                                            type="number"
                                            min={1}
                                            step="0.01"
                                            value={fila.monto}
                                            onChange={(e) =>
                                                actualizarFilaPrecio(indice, {
                                                    monto: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        />
                                    </label>

                                    {matrizPrecios.length > 1 &&
                                    !esTarifaPersistida ? (
                                        <Boton
                                            type="button"
                                            variante="fantasma"
                                            className="px-2.5 py-2 text-xs text-peligro hover:bg-peligro/10"
                                            onClick={() =>
                                                quitarFilaPrecio(indice)
                                            }
                                        >
                                            Quitar
                                        </Boton>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* PASO 4: SERVICIOS OPERATIVOS INCLUIDOS */}
            {errorCargaServicios ? (
                <div className="space-y-3 border-t border-borde pt-5">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                            4
                        </span>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Servicios operativos incluidos en el paquete
                        </h3>
                    </div>
                    <p
                        className="rounded-control border border-peligro/30 bg-peligro/10 p-3 text-xs text-peligro"
                        role="alert"
                    >
                        No se pudieron cargar los servicios operativos de proveedores: {errorCargaServicios}
                    </p>
                </div>
            ) : serviciosDisponibles.length > 0 ? (
                <div className="space-y-3 border-t border-borde pt-5">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                            4
                        </span>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                                Servicios operativos incluidos en el paquete
                            </h3>
                            <p className="text-xs text-texto-suave">
                                Seleccioná los alojamientos, transportes, trenes o equipamientos que componen este paquete.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            ...serviciosDisponibles.map((s) => ({
                                ...s,
                                inactivo: false,
                            })),
                            // Incluidos que ya no están disponibles (dados de baja): se muestran para poder quitarlos
                            ...serviciosIncluidos
                                .filter(
                                    (id) =>
                                        !serviciosDisponibles.some(
                                            (s) => s.idservicio === id,
                                        ),
                                )
                                .map((id) => {
                                    const s = detallePaquete?.servicios?.find(
                                        (item) => item.idservicio === id,
                                    )?.servicio;
                                    return {
                                        idservicio: id,
                                        nombreServicio:
                                            s?.nombreServicio ??
                                            `Servicio #${id}`,
                                        tipo: "",
                                        localidad: s?.localidad,
                                        costoBase: s?.costoBase ?? 0,
                                        inactivo: true,
                                    };
                                }),
                        ].map((servicio) => {
                            const marcado = serviciosIncluidos.includes(
                                servicio.idservicio,
                            );
                            return (
                                <label
                                    key={servicio.idservicio}
                                    className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 text-sm transition-colors ${
                                        marcado
                                            ? "border-marca bg-marca-suave/50"
                                            : "border-borde bg-white hover:bg-fondo"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={marcado}
                                        disabled={detalleBloqueado}
                                        onChange={() =>
                                            alternarServicioIncluido(
                                                servicio.idservicio,
                                            )
                                        }
                                        className="mt-1 size-4 accent-marca"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-texto">
                                            {servicio.nombreServicio}
                                            {servicio.inactivo
                                                ? " (inactivo)"
                                                : ""}
                                        </p>
                                        <p className="mt-0.5 text-xs text-texto-suave">
                                            {servicio.tipo
                                                ? `${servicio.tipo} · `
                                                : ""}
                                            {" "}
                                            {servicio.localidad ?? "Cusco"} ·
                                            Costo base USD {servicio.costoBase}
                                        </p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {/* GALERÍA DE IMÁGENES DEL PAQUETE (MÍNIMO 1, MÁXIMO 5 AL SUBIR) */}
            <div className="space-y-4 border-t border-borde pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                            5
                        </span>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                                Galería de imágenes del paquete{" "}
                                <span className="font-normal normal-case text-texto-suave">
                                    (1 a {MAX_IMAGENES_PAQUETE} imágenes)
                                </span>
                            </h3>
                            <p className="text-xs text-texto-suave">
                                Formatos admitidos: JPG, PNG o WEBP · Máximo 3 MB por foto · Hasta{" "}
                                {MAX_IMAGENES_PAQUETE} imágenes (la primera será la portada{" "}
                                <code className="rounded bg-fondo px-1 py-0.5 text-[11px]">
                                    principal.*
                                </code>
                                ).
                            </p>
                        </div>
                    </div>

                    <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-marca-oscura">
                        {imagenesArchivos.length} / {MAX_IMAGENES_PAQUETE} nuevas seleccionadas
                    </span>
                </div>

                {/* IMÁGENES ACTUALES EN MODO EDICIÓN */}
                {esEdicion && imagenesActualesPaquete.length > 0 ? (
                    <div className="space-y-2.5 rounded-control border border-borde bg-fondo/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                    Imágenes actuales del paquete ({imagenesActualesPaquete.length} / {MAX_IMAGENES_PAQUETE})
                                </span>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        tieneImagenesPropiasActual
                                            ? "bg-green-50 text-exito"
                                            : "bg-slate-200 text-texto-suave"
                                    }`}
                                >
                                    {tieneImagenesPropiasActual
                                        ? "Galería propia cargada"
                                        : "Imagen de catálogo por defecto"}
                                </span>
                            </div>
                            <span className="text-xs text-texto-suave">
                                {imagenesArchivos.length > 0
                                    ? "⚠ Al guardar el formulario se reemplazará todo el carrusel por el lote de abajo."
                                    : "Podés cambiar o eliminar una foto individual al instante, o subir un carrusel nuevo abajo."}
                            </span>
                        </div>

                        {mensajeFotoIndividual ? (
                            <p className="rounded bg-green-50 px-3 py-1.5 text-xs font-semibold text-exito">
                                {mensajeFotoIndividual}
                            </p>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                            {imagenesActualesPaquete.map((urlImg, idx) => {
                                const nombreFotoSlot =
                                    extraerNombreFotoCarrusel(urlImg, idx);
                                const ocupado =
                                    mutacionModificarFoto.isPending ||
                                    mutacionEliminarFoto.isPending;

                                return (
                                    <div
                                        key={`${urlImg}-${idx}`}
                                        className="group relative flex flex-col overflow-hidden rounded-control border border-borde bg-white shadow-xs"
                                    >
                                        <div className="relative">
                                            <img
                                                src={resolverUrlImagenPaquete(
                                                    urlImg,
                                                )}
                                                alt={`Imagen actual ${idx + 1} de ${paqueteEnEdicion?.nombrePaquete ?? "paquete"}`}
                                                className="h-24 w-full object-cover"
                                            />
                                            <span
                                                className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold shadow-xs ${
                                                    idx === 0
                                                        ? "bg-marca text-white"
                                                        : "bg-navegacion/80 text-white"
                                                }`}
                                            >
                                                {idx === 0
                                                    ? "★ Portada"
                                                    : `Foto #${idx + 1}`}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-1 bg-white px-2 py-1.5 text-[11px]">
                                            <label
                                                className={`cursor-pointer font-semibold text-marca-oscura hover:underline ${
                                                    ocupado
                                                        ? "pointer-events-none opacity-50"
                                                        : ""
                                                }`}
                                                title={`Reemplazar únicamente ${nombreFotoSlot}`}
                                            >
                                                Cambiar
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    disabled={ocupado}
                                                    onChange={(e) =>
                                                        manejarReemplazarFotoIndividual(
                                                            nombreFotoSlot,
                                                            idx,
                                                            e,
                                                        )
                                                    }
                                                    className="sr-only"
                                                />
                                            </label>

                                            {tieneImagenesPropiasActual &&
                                            imagenesActualesPaquete.length >
                                                1 ? (
                                                <button
                                                    type="button"
                                                    disabled={ocupado}
                                                    onClick={() =>
                                                        manejarEliminarFotoIndividual(
                                                            nombreFotoSlot,
                                                            idx,
                                                        )
                                                    }
                                                    className="font-semibold text-peligro hover:underline disabled:opacity-50"
                                                    title={`Eliminar ${nombreFotoSlot} de la galería`}
                                                >
                                                    Eliminar
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-texto-suave">
                                                    Mín. 1 foto
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {imagenesActualesPaquete.length <
                            MAX_IMAGENES_PAQUETE ? (
                                <label
                                    className={`flex min-h-[124px] cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-dashed border-marca/40 bg-white/80 p-2 text-center text-xs font-semibold text-marca-oscura transition hover:border-marca hover:bg-marca-suave/40 ${
                                        mutacionModificarFoto.isPending
                                            ? "pointer-events-none opacity-50"
                                            : ""
                                    }`}
                                >
                                    <span className="text-lg leading-none">
                                        +
                                    </span>
                                    <span>Sumar 1 foto</span>
                                    <span className="text-[10px] font-normal text-texto-suave">
                                        Slot {obtenerProximoSlotLibre()}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        disabled={
                                            mutacionModificarFoto.isPending
                                        }
                                        onChange={(e) =>
                                            manejarReemplazarFotoIndividual(
                                                obtenerProximoSlotLibre(),
                                                -1,
                                                e,
                                            )
                                        }
                                        className="sr-only"
                                    />
                                </label>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* SELECTOR Y VISTA PREVIA DE NUEVAS IMÁGENES (1 A 5) */}
                <div className="space-y-3 rounded-control border border-dashed border-borde bg-fondo/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <label
                                htmlFor="archivo-imagen-paquete"
                                className={`inline-flex items-center gap-2 rounded-control border border-borde bg-white px-3.5 py-2 text-xs font-semibold text-navegacion shadow-xs transition ${
                                    imagenesArchivos.length >= MAX_IMAGENES_PAQUETE
                                        ? "cursor-not-allowed opacity-50"
                                        : "cursor-pointer hover:bg-fondo"
                                }`}
                            >
                                <span>
                                    {imagenesArchivos.length === 0
                                        ? esEdicion
                                            ? "Seleccionar nuevas imágenes (1 a 5)"
                                            : "Seleccionar imágenes (1 a 5)"
                                        : imagenesArchivos.length < MAX_IMAGENES_PAQUETE
                                          ? `Agregar más imágenes (${MAX_IMAGENES_PAQUETE - imagenesArchivos.length} disponibles)`
                                          : "Límite de 5 imágenes alcanzado"}
                                </span>
                                <input
                                    id="archivo-imagen-paquete"
                                    type="file"
                                    multiple
                                    disabled={
                                        imagenesArchivos.length >=
                                        MAX_IMAGENES_PAQUETE
                                    }
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={manejarSeleccionImagenes}
                                    className="sr-only"
                                />
                            </label>

                            {imagenesArchivos.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={limpiarTodasLasImagenesSeleccionadas}
                                    className="rounded-control px-2.5 py-1.5 text-xs font-semibold text-peligro hover:bg-peligro/10"
                                >
                                    Quitar todas ({imagenesArchivos.length})
                                </button>
                            ) : null}
                        </div>

                        <p className="text-xs text-texto-suave">
                            {imagenesArchivos.length === 0
                                ? esEdicion
                                    ? "Podés subir entre 1 y 5 imágenes nuevas para actualizar la galería del paquete."
                                    : "Podés adjuntar entre 1 y 5 imágenes; la primera será la portada principal."
                                : "Podés elegir cuál será la portada haciendo clic en «Usar como portada»."}
                        </p>
                    </div>

                    {vistasPrevias.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                            {vistasPrevias.map((urlPrevia, idx) => {
                                const archivo = imagenesArchivos[idx];
                                return (
                                    <div
                                        key={`${archivo?.name ?? "img"}-${idx}`}
                                        className={`flex flex-col overflow-hidden rounded-control border bg-white shadow-xs ${
                                            idx === 0
                                                ? "border-marca ring-2 ring-marca/20"
                                                : "border-borde"
                                        }`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={urlPrevia}
                                                alt={`Vista previa ${idx + 1}`}
                                                className="h-24 w-full object-cover"
                                            />
                                            <span
                                                className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold shadow-xs ${
                                                    idx === 0
                                                        ? "bg-marca text-white"
                                                        : "bg-navegacion/80 text-white"
                                                }`}
                                            >
                                                {idx === 0
                                                    ? "★ Portada"
                                                    : `Imagen #${idx + 1}`}
                                            </span>
                                        </div>

                                        <div className="flex flex-1 flex-col justify-between gap-1.5 p-2 text-[11px]">
                                            <div className="truncate font-semibold text-texto" title={archivo?.name}>
                                                {archivo?.name}
                                                <span className="ml-1 font-normal text-texto-suave">
                                                    ({((archivo?.size ?? 0) / 1024).toFixed(0)} KB)
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-1 border-t border-borde pt-1">
                                                {idx > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            promoverImagenAPortada(
                                                                idx,
                                                            )
                                                        }
                                                        className="font-semibold text-marca-oscura hover:underline"
                                                    >
                                                        Usar como portada
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-exito">
                                                        Principal
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        quitarImagenEnIndice(idx)
                                                    }
                                                    className="font-semibold text-peligro hover:underline"
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            </div>

            {detalleBloqueado ? (
                errorDetalle ? (
                    <p className="rounded-control border border-peligro/30 bg-peligro/10 p-3 text-sm text-peligro" role="alert">
                        No se pudieron cargar los servicios y la garantía del paquete. Cerrá y volvé a abrir la edición para reintentar.
                    </p>
                ) : cargandoDetalle ? (
                    <p className="text-sm text-texto-suave">
                        Cargando datos del paquete…
                    </p>
                ) : null
            ) : null}

            {mensajeError ? (
                <p className="rounded-control border border-peligro/30 bg-peligro/10 p-3 text-sm text-peligro" role="alert">
                    {mensajeError}
                </p>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-borde pt-4">
                <Boton
                    type="button"
                    variante="secundario"
                    onClick={alCancelar}
                    disabled={guardando}
                >
                    Cancelar
                </Boton>
                <Boton
                    type="submit"
                    cargando={guardando}
                    disabled={detalleBloqueado}
                >
                    {esEdicion
                        ? "Guardar cambios del paquete"
                        : "Publicar paquete turístico"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioPaquete;
