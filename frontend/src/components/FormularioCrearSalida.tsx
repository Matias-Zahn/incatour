import { useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alerta from "./Alerta";
import AsistentePasos, { type DefinicionPaso } from "./AsistentePasos";
import Boton from "./Boton";
import {
    formatearFechaUtcCorta,
    formatearMonto,
    formatearRangoFechasUtc,
} from "../services/formato";
import {
    DIAS_CIERRE_SOLICITUD,
    usePaqueteDetalle,
} from "../services/paqueteService";

type DiaSemanaCodigo = "L" | "M" | "X" | "J" | "V" | "S" | "D";
import {
    consultarOpcionesSalida,
    type AlojamientoOpcion,
    type CupoAutoridadOpciones,
    type DatosCrearSalida,
    type DetalleFaltaEquipo,
    type DotacionOpciones,
    type OpcionesSalidaDto,
    type ParametrosConsultaOpciones,
} from "../services/salidaService";

export type PaqueteOpcion = {
    idpaquete: number;
    nombrePaquete: string;
    estado?: string;
    diasSalida?: string;
    diasCierreVenta?: number;
};

export type {
    AlojamientoOpcion,
    CupoAutoridadOpciones,
    DatosCrearSalida as DatosConfirmarSalida,
    DotacionOpciones,
    OpcionesSalidaDto,
    ParametrosConsultaOpciones,
};

export type FormularioCrearSalidaProps = {
    paquetes: PaqueteOpcion[];
    creando?: boolean;
    errorServidor?: string;
    errorDetalleEquipo?: DetalleFaltaEquipo | null;
    errorEsAutoridad?: boolean;
    alConfirmarCreacion: (datos: DatosCrearSalida) => void;
    alCancelar: () => void;
};

const PASOS_CREAR_SALIDA: DefinicionPaso[] = [
    { titulo: "Paquete y fechas" },
    { titulo: "Hotel y transporte" },
    { titulo: "Guías y porteadores" },
    { titulo: "Revisión" },
];

const CODIGOS_DIA_UTC: DiaSemanaCodigo[] = ["D", "L", "M", "X", "J", "V", "S"];
const NOMBRES_DIA_COMPLETO: Record<DiaSemanaCodigo, string> = {
    L: "lunes",
    M: "martes",
    X: "miércoles",
    J: "jueves",
    V: "viernes",
    S: "sábados",
    D: "domingos",
};

function obtenerFechaHoyIsoLocal(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function sumarDiasIso(iso: string, dias: number): string {
    const f = new Date(iso + "T12:00:00Z");
    f.setUTCDate(f.getUTCDate() + dias);
    return f.toISOString().slice(0, 10);
}

function codigoDiaSemanaIso(iso: string): DiaSemanaCodigo | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const f = new Date(iso + "T12:00:00Z");
    if (Number.isNaN(f.getTime())) return null;
    return CODIGOS_DIA_UTC[f.getUTCDay()] ?? null;
}

const esquemaParametrosSalida = z.object({
    idpaquete: z
        .number({ message: "Seleccioná un paquete turístico" })
        .int("El paquete debe ser un número entero")
        .positive("Seleccioná un paquete turístico"),
    fechaInicio: z
        .string()
        .trim()
        .min(1, "La fecha de inicio es requerida")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD"),
    tamanoMaximo: z
        .number({ message: "Ingresá el tamaño del grupo de pasajeros" })
        .int("El tamaño debe ser un número entero")
        .positive("El tamaño del grupo debe ser mayor a 0")
        .max(100, "El grupo no puede superar los 100 pasajeros"),
});

type ValoresParametros = z.infer<typeof esquemaParametrosSalida>;

function FormularioCrearSalida({
    paquetes,
    creando = false,
    errorServidor,
    errorDetalleEquipo = null,
    errorEsAutoridad = false,
    alConfirmarCreacion,
    alCancelar,
}: FormularioCrearSalidaProps) {
    const idForm = useId();
    const [pasoActual, setPasoActual] = useState(0);
    const [opciones, setOpciones] = useState<OpcionesSalidaDto | null>(null);
    // Precio por pasajero de la salida: vacío = la tarifa del paquete para esa temporada
    const [precioAjustado, setPrecioAjustado] = useState("");
    const [cargandoOpciones, setCargandoOpciones] = useState(false);
    const [errorPaso, setErrorPaso] = useState("");

    // Selecciones de pasos 2 y 3
    const [hotelesSeleccionados, setHotelesSeleccionados] = useState<number[]>([]);
    const [idtransporteSeleccionado, setIdtransporteSeleccionado] = useState<number | null>(null);
    const [diasCierreVentaManual, setDiasCierreVentaManual] = useState<number | null>(null);
    const [personalSeleccionadoIds, setPersonalSeleccionadoIds] = useState<number[]>([]);

    const {
        register,
        control,
        trigger,
        getValues,
        setValue,
        formState: { errors },
    } = useForm<ValoresParametros>({
        resolver: zodResolver(esquemaParametrosSalida),
        defaultValues: {
            idpaquete: undefined,
            fechaInicio: "",
            tamanoMaximo: 8,
        },
    });

    const valorIdPaquete = useWatch({ control, name: "idpaquete" });
    const valorFechaInicio = useWatch({ control, name: "fechaInicio" });
    const valorTamanoMaximo = useWatch({ control, name: "tamanoMaximo" });

    const paquetesActivos = useMemo(
        () => paquetes.filter((p) => !p.estado || p.estado === "ACTIVO"),
        [paquetes],
    );

    const { data: detallePaquete } = usePaqueteDetalle(
        Number.isInteger(valorIdPaquete) && valorIdPaquete > 0 ? valorIdPaquete : null,
    );

    const calendario = detallePaquete?.calendarioSalidas;

    // La misma regla que el back (tarifaVigente): la temporada activa que cubre la fecha de inicio. Es la que se congela.
    const tarifaDeLaFecha = valorFechaInicio
        ? detallePaquete?.tarifas?.find(
              (t) =>
                  t.temporada?.estado === "ACTIVO" &&
                  t.temporada.fechaInicio.slice(0, 10) <= valorFechaInicio &&
                  valorFechaInicio <= t.temporada.fechaFin.slice(0, 10),
          )
        : undefined;
    const diasHabilitados = useMemo<DiaSemanaCodigo[]>(
        () =>
            (calendario?.diasHabilitados as DiaSemanaCodigo[] | undefined) ?? [
                "L",
                "M",
                "X",
                "J",
                "V",
                "S",
                "D",
            ],
        [calendario?.diasHabilitados],
    );

    const fechaMinima = useMemo(() => {
        if (calendario?.fechaMinima) return calendario.fechaMinima;
        const cierreBase = detallePaquete?.diasCierreVenta ?? 2;
        return sumarDiasIso(obtenerFechaHoyIsoLocal(), cierreBase + 1);
    }, [calendario, detallePaquete?.diasCierreVenta]);

    const diaElegidoCodigo = valorFechaInicio ? codigoDiaSemanaIso(valorFechaInicio) : null;
    const diaElegidoDeshabilitado = Boolean(
        diaElegidoCodigo && !diasHabilitados.includes(diaElegidoCodigo),
    );
    const fechaAnteriorAMinima = Boolean(
        valorFechaInicio && valorFechaInicio < fechaMinima,
    );

    // Hoteles elegidos (en el orden de selección, que define el orden de llenado en §14) y cálculo de plazas cubiertas (B10)
    const hotelesElegidosObjetos = useMemo(() => {
        if (!opciones) return [];
        const porId = new Map(opciones.alojamientos.map((h) => [h.idservicio, h]));
        return hotelesSeleccionados
            .map((id) => porId.get(id))
            .filter((h): h is AlojamientoOpcion => Boolean(h));
    }, [opciones, hotelesSeleccionados]);

    const algunHotelASolicitud = hotelesElegidosObjetos.some(
        (h) => h.modalidadConfirmacion === "A_SOLICITUD",
    );

    const plazasCubiertasBloqueo = hotelesElegidosObjetos.reduce(
        (acc, h) => acc + (h.modalidadConfirmacion === "BLOQUEO_PLAZAS" ? (h.capacidadDisponible ?? 0) : 0),
        0,
    );

    const plazasNecesarias = opciones?.plazasNecesarias ?? 0;

    // Cuántas plazas aporta cada hotel elegido, en el orden de llenado del back: los de bloqueo en el orden en que se
    // marcaron y uno a solicitud cubre lo que falte. Un hotel que no aporta nada no se puede elegir.
    const aportes = useMemo(() => {
        const mapa = new Map<number, number>();
        let faltan = plazasNecesarias;
        for (const h of hotelesElegidosObjetos.filter((x) => x.modalidadConfirmacion === "BLOQUEO_PLAZAS")) {
            const plazas = Math.min(h.capacidadDisponible ?? 0, faltan);
            mapa.set(h.idservicio, plazas);
            faltan -= plazas;
        }
        for (const h of hotelesElegidosObjetos.filter((x) => x.modalidadConfirmacion === "A_SOLICITUD")) {
            mapa.set(h.idservicio, faltan);
        }
        return mapa;
    }, [hotelesElegidosObjetos, plazasNecesarias]);
    const hotelSinAporte = hotelesElegidosObjetos.find(
        (h) => h.modalidadConfirmacion === "BLOQUEO_PLAZAS" && (aportes.get(h.idservicio) ?? 0) === 0,
    );

    // §14 (FA3): si ningún hotel ni combinación de hoteles disponibles cubre plazasNecesarias,
    // el back permite crear la salida sin hotel y sube el corte sugerido a 5 días.
    const puedeCubrirConAlgunHotel = useMemo(() => {
        if (!opciones || plazasNecesarias === 0) return true;
        if (opciones.alojamientos.some((h) => h.modalidadConfirmacion === "A_SOLICITUD")) {
            return true;
        }
        const totalBloqueoDisponible = opciones.alojamientos.reduce(
            (acc, h) => acc + (h.capacidadDisponible ?? 0),
            0,
        );
        return totalBloqueoDisponible >= plazasNecesarias;
    }, [opciones, plazasNecesarias]);

    const esSinHotelFA3 = plazasNecesarias > 0 && !puedeCubrirConAlgunHotel;

    const plazasCubiertasOk =
        plazasNecesarias === 0 ||
        esSinHotelFA3 ||
        algunHotelASolicitud ||
        plazasCubiertasBloqueo >= plazasNecesarias;

    const corteSugerido = useMemo(() => {
        const base = opciones?.paquete.diasCierreVenta ?? 2;
        const requiereCorteLargo = algunHotelASolicitud || esSinHotelFA3;
        return Math.max(base, requiereCorteLargo ? DIAS_CIERRE_SOLICITUD : 0);
    }, [opciones?.paquete.diasCierreVenta, algunHotelASolicitud, esSinHotelFA3]);

    const diasCierreVenta = diasCierreVentaManual ?? corteSugerido;

    // Personal y totales (B3, 12.4)
    const guiasSeleccionadosIds = useMemo(() => {
        const idsGuias = new Set((opciones?.personal.guias ?? []).map((g) => g.idpersonal));
        return personalSeleccionadoIds.filter((id) => idsGuias.has(id));
    }, [opciones?.personal.guias, personalSeleccionadoIds]);

    const porteadoresSeleccionadosIds = useMemo(() => {
        const idsPort = new Set((opciones?.personal.porteadores ?? []).map((p) => p.idpersonal));
        return personalSeleccionadoIds.filter((id) => idsPort.has(id));
    }, [opciones?.personal.porteadores, personalSeleccionadoIds]);

    const totalLugaresConPersonalElegido = useMemo(() => {
        if (!opciones) return 0;
        const cantPersonal =
            personalSeleccionadoIds.length > 0
                ? personalSeleccionadoIds.length
                : opciones.dotacion.guias + opciones.dotacion.porteadores;
        return opciones.tamanoMaximo + cantPersonal;
    }, [opciones, personalSeleccionadoIds.length]);

    const transporteElegido = useMemo(
        () =>
            opciones?.transportes.find((t) => t.idservicio === idtransporteSeleccionado) ??
            null,
        [opciones?.transportes, idtransporteSeleccionado],
    );

    // El transporte se elige antes que el personal: sin asiento libre no se puede sumar a nadie más
    const sinAsientoLibre =
        transporteElegido != null &&
        opciones != null &&
        opciones.tamanoMaximo + personalSeleccionadoIds.length >= transporteElegido.capacidadVehiculo;

    const equipoBloqueante = useMemo(
        () => (opciones?.equipo ?? []).filter((e) => e.nivel === "NO_ALCANZA"),
        [opciones?.equipo],
    );
    const equipoEnRiesgo = useMemo(
        () => (opciones?.equipo ?? []).filter((e) => e.nivel === "RIESGO"),
        [opciones?.equipo],
    );

    const cupoAutoridadInsuficiente = Boolean(
        opciones?.cupoAutoridad && !opciones.cupoAutoridad.alcanza,
    );

    function inicializarSeleccionesDesdeOpciones(nuevasOpciones: OpcionesSalidaDto) {
        // Preseleccionar primer hotel que alcance solo si hay plazas necesarias
        if (nuevasOpciones.plazasNecesarias > 0) {
            const primeroQueAlcanza = nuevasOpciones.alojamientos.find(
                (a) => a.modalidadConfirmacion === "BLOQUEO_PLAZAS" && a.alcanza,
            );
            setHotelesSeleccionados(
                primeroQueAlcanza ? [primeroQueAlcanza.idservicio] : [],
            );
        } else {
            setHotelesSeleccionados([]);
        }

        // Preseleccionar transporte del paquete si está libre y alcanza, si no el primero válido
        const transPaquete = nuevasOpciones.transportes.find(
            (t) => t.delPaquete && t.libre && t.alcanza,
        );
        const transAlternativo = nuevasOpciones.transportes.find(
            (t) => t.libre && t.alcanza,
        );
        setIdtransporteSeleccionado(
            transPaquete?.idservicio ??
                transAlternativo?.idservicio ??
                nuevasOpciones.paquete.idtransporte ??
                null,
        );

        setDiasCierreVentaManual(null);

        // Preseleccionar personal mínimo sugerido (ordenado por menos salidas en el mes)
        const guiasSugeridos = nuevasOpciones.personal.guias
            .slice(0, nuevasOpciones.dotacion.guias)
            .map((g) => g.idpersonal);
        const porteadoresSugeridos = nuevasOpciones.personal.porteadores
            .slice(0, nuevasOpciones.dotacion.porteadores)
            .map((p) => p.idpersonal);
        setPersonalSeleccionadoIds([...guiasSugeridos, ...porteadoresSugeridos]);
    }

    async function manejarSiguiente() {
        setErrorPaso("");

        if (pasoActual === 0) {
            const valido = await trigger(["idpaquete", "fechaInicio", "tamanoMaximo"]);
            if (!valido) return;
            const valores = getValues();

            if (valores.fechaInicio < fechaMinima) {
                setErrorPaso(
                    `La salida tiene que empezar desde el ${formatearFechaUtcCorta(fechaMinima)} en adelante por el corte de venta.`,
                );
                return;
            }
            const cod = codigoDiaSemanaIso(valores.fechaInicio);
            if (cod && !diasHabilitados.includes(cod)) {
                setErrorPaso(
                    `El paquete no sale los ${NOMBRES_DIA_COMPLETO[cod]}. Días habilitados: ${diasHabilitados.join(", ")}.`,
                );
                return;
            }

            setCargandoOpciones(true);
            try {
                const resp = await consultarOpcionesSalida({
                    idpaquete: Number(valores.idpaquete),
                    fechaInicio: valores.fechaInicio,
                    tamanoMaximo: Number(valores.tamanoMaximo),
                });
                setOpciones(resp);
                setPrecioAjustado(""); // otra fecha u otro paquete: vuelve a la tarifa
                inicializarSeleccionesDesdeOpciones(resp);
                setPasoActual(1);
            } catch (err) {
                setErrorPaso(
                    err instanceof Error
                        ? err.message
                        : "No se pudieron consultar las opciones para esa fecha.",
                );
            } finally {
                setCargandoOpciones(false);
            }
            return;
        }

        if (pasoActual === 1 && opciones) {
            if (cupoAutoridadInsuficiente) {
                setErrorPaso(
                    "No hay cupo suficiente ante la autoridad para esa fecha. Volvé al paso 1 y elegí otra fecha o menos pasajeros.",
                );
                return;
            }
            if (plazasNecesarias > 0 && !esSinHotelFA3 && hotelesSeleccionados.length === 0) {
                setErrorPaso("Elegí al menos un hotel para cubrir las plazas del grupo.");
                return;
            }
            if (hotelSinAporte) {
                setErrorPaso(`${hotelSinAporte.nombreServicio} no hace falta: el grupo ya está cubierto. Desmarcalo.`);
                return;
            }
            if (!plazasCubiertasOk) {
                setErrorPaso(
                    `Los hoteles elegidos cubren ${plazasCubiertasBloqueo} de ${plazasNecesarias} plazas. Sumá otro hotel para cubrir el total.`,
                );
                return;
            }
            if (idtransporteSeleccionado === null) {
                setErrorPaso("Seleccioná un transporte disponible para la salida.");
                return;
            }
            if (transporteElegido && !transporteElegido.libre) {
                setErrorPaso("El transporte seleccionado ya está ocupado en esas fechas.");
                return;
            }
            if (
                transporteElegido &&
                transporteElegido.capacidadVehiculo < opciones.totalLugares
            ) {
                setErrorPaso(
                    `El transporte tiene ${transporteElegido.capacidadVehiculo} asientos y se necesitan al menos ${opciones.totalLugares} lugares (${opciones.tamanoMaximo} pasajeros + personal).`,
                );
                return;
            }
            if (
                !Number.isInteger(diasCierreVenta) ||
                diasCierreVenta < 1 ||
                diasCierreVenta > 30
            ) {
                setErrorPaso("Los días de cierre de venta deben estar entre 1 y 30.");
                return;
            }
            setPasoActual(2);
            return;
        }

        if (pasoActual === 2 && opciones) {
            if (guiasSeleccionadosIds.length < opciones.dotacion.guias) {
                setErrorPaso(
                    `Necesitás seleccionar al menos ${opciones.dotacion.guias} ${opciones.dotacion.guias === 1 ? "guía" : "guías"}.`,
                );
                return;
            }
            if (porteadoresSeleccionadosIds.length < opciones.dotacion.porteadores) {
                setErrorPaso(
                    `Necesitás seleccionar al menos ${opciones.dotacion.porteadores} ${opciones.dotacion.porteadores === 1 ? "porteador" : "porteadores"}.`,
                );
                return;
            }
            if (
                transporteElegido &&
                transporteElegido.capacidadVehiculo < totalLugaresConPersonalElegido
            ) {
                setErrorPaso(
                    `Con el personal elegido se necesitan ${totalLugaresConPersonalElegido} lugares y el transporte seleccionado tiene ${transporteElegido.capacidadVehiculo} asientos. Reducí personal extra o cambiá el transporte en el paso 2.`,
                );
                return;
            }
            setPasoActual(3);
        }
    }

    function alternarHotel(idservicio: number) {
        setErrorPaso("");
        setHotelesSeleccionados((prev) =>
            prev.includes(idservicio)
                ? prev.filter((id) => id !== idservicio)
                : [...prev, idservicio],
        );
    }

    function alternarPersonal(idpersonal: number) {
        setErrorPaso("");
        setPersonalSeleccionadoIds((prev) =>
            prev.includes(idpersonal)
                ? prev.filter((id) => id !== idpersonal)
                : [...prev, idpersonal],
        );
    }

    function manejarConfirmar() {
        if (!opciones || idtransporteSeleccionado === null) return;
        if (equipoBloqueante.length > 0 || cupoAutoridadInsuficiente) return;
        const valores = getValues();
        alConfirmarCreacion({
            idpaquete: opciones.paquete.idpaquete,
            fechaInicio: valores.fechaInicio,
            tamanoMaximo: opciones.tamanoMaximo,
            alojamientos: hotelesSeleccionados,
            idtransporte: idtransporteSeleccionado,
            personalIds: personalSeleccionadoIds,
            diasCierreVenta,
            ...(precioAjustado.trim() !== "" && precioFinal !== opciones.tarifa?.monto && { precioPorPasajero: precioFinal }),
        });
    }

    // Lo que la logística elegida cuesta de más por pasajero respecto de la referencia del paquete:
    // el transporte contra el del paquete, y el hotel contra el más económico de la garantía (precio "desde")
    const extraTransporte = transporteElegido?.encarecePorPasajero ?? 0;
    const extraHotel = useMemo(() => {
        if (!opciones || !opciones.nochesHotel || opciones.plazasNecesarias === 0) return 0;
        const costos = opciones.alojamientos.map((h) => h.costoPorNoche).filter((c): c is number => c != null);
        if (costos.length === 0) return 0;
        const referencia = Math.min(...costos);
        // Mismo orden de llenado que el back: cada hotel con bloqueo cubre lo libre; uno a solicitud, lo que falte
        let resto = opciones.tamanoMaximo;
        let extra = 0;
        for (const h of hotelesElegidosObjetos) {
            const cubre = h.capacidadDisponible === null ? resto : Math.min(h.capacidadDisponible, resto);
            extra += cubre * ((h.costoPorNoche ?? referencia) - referencia);
            resto -= cubre;
        }
        return Math.round(((extra * opciones.nochesHotel) / opciones.tamanoMaximo) * 100) / 100;
    }, [opciones, hotelesElegidosObjetos]);
    const extraLogistica = Math.round((extraTransporte + extraHotel) * 100) / 100;
    const precioFinal = precioAjustado.trim() === "" ? (opciones?.tarifa?.monto ?? 0) : Number(precioAjustado);
    const precioValido = precioFinal > 0;

    const puedeConfirmarFinal =
        precioValido &&
        Boolean(opciones) &&
        !cupoAutoridadInsuficiente &&
        equipoBloqueante.length === 0 &&
        idtransporteSeleccionado !== null;

    return (
        <form
            className="p-6"
            onSubmit={(e) => {
                e.preventDefault();
                if (pasoActual === PASOS_CREAR_SALIDA.length - 1) {
                    manejarConfirmar();
                } else {
                    void manejarSiguiente();
                }
            }}
        >
            <AsistentePasos
                titulo="Nueva salida planificada"
                subtitulo="Elegí el paquete y la fecha, reservá hotel y transporte, asigná el equipo de guías y porteadores y revisá el stock proyectado."
                pasos={PASOS_CREAR_SALIDA}
                pasoActual={pasoActual}
                alCambiarPaso={(destino) => {
                    if (destino < pasoActual) {
                        setErrorPaso("");
                        setPasoActual(destino);
                    }
                }}
                alSiguiente={manejarSiguiente}
                alAtras={() => {
                    setErrorPaso("");
                    setPasoActual((p) => Math.max(0, p - 1));
                }}
                alCancelar={alCancelar}
                textoGuardar={
                    errorEsAutoridad
                        ? "Reintentar publicación"
                        : "Crear y publicar salida"
                }
                guardando={creando || cargandoOpciones}
                deshabilitarGuardar={!puedeConfirmarFinal}
                errorPaso={errorPaso || undefined}
                errorServidor={errorServidor || undefined}
            >
                {/* PASO 1: Paquete y fechas */}
                {pasoActual === 0 ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                <span>
                                    Paquete turístico <span className="text-peligro">*</span>
                                </span>
                                <select
                                    id={`${idForm}-paquete`}
                                    {...register("idpaquete", { valueAsNumber: true })}
                                    disabled={cargandoOpciones || creando}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value="">Seleccionar paquete...</option>
                                    {paquetesActivos.map((p) => (
                                        <option key={p.idpaquete} value={p.idpaquete}>
                                            {p.nombrePaquete}
                                        </option>
                                    ))}
                                </select>
                                {errors.idpaquete ? (
                                    <span className="text-xs font-normal text-peligro" role="alert">
                                        {errors.idpaquete.message}
                                    </span>
                                ) : null}
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                <span>
                                    Fecha de inicio <span className="text-peligro">*</span>
                                </span>
                                <input
                                    id={`${idForm}-fecha`}
                                    type="date"
                                    min={fechaMinima}
                                    {...register("fechaInicio")}
                                    disabled={cargandoOpciones || creando}
                                    className={`rounded-control border bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:ring-2 ${
                                        diaElegidoDeshabilitado || fechaAnteriorAMinima
                                            ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                            : "border-borde focus:border-marca focus:ring-marca/20"
                                    }`}
                                />
                                {errors.fechaInicio ? (
                                    <span className="text-xs font-normal text-peligro" role="alert">
                                        {errors.fechaInicio.message}
                                    </span>
                                ) : diaElegidoDeshabilitado && diaElegidoCodigo ? (
                                    <span className="text-xs font-medium text-peligro" role="alert">
                                        No habilitado los {NOMBRES_DIA_COMPLETO[diaElegidoCodigo]}. Días permitidos: {diasHabilitados.join(", ")}.
                                    </span>
                                ) : fechaAnteriorAMinima ? (
                                    <span className="text-xs font-medium text-peligro" role="alert">
                                        Debe iniciar desde el {formatearFechaUtcCorta(fechaMinima)}.
                                    </span>
                                ) : (
                                    <span className="text-xs font-normal text-texto-suave">
                                        Desde el {formatearFechaUtcCorta(fechaMinima)} · Días habilitados: {diasHabilitados.join(", ")}.
                                    </span>
                                )}
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                <span>
                                    Tamaño máximo (pasajeros) <span className="text-peligro">*</span>
                                </span>
                                <input
                                    id={`${idForm}-tamano`}
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...register("tamanoMaximo", { valueAsNumber: true })}
                                    disabled={cargandoOpciones || creando}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.tamanoMaximo ? (
                                    <span className="text-xs font-normal text-peligro" role="alert">
                                        {errors.tamanoMaximo.message}
                                    </span>
                                ) : (
                                    <span className="text-xs font-normal text-texto-suave">
                                        Cupo de venta para turistas.
                                    </span>
                                )}
                            </label>
                        </div>

                        {detallePaquete ? (
                            <div className="rounded-control border border-borde bg-fondo/50 p-3.5 text-xs text-texto-suave flex flex-wrap gap-x-6 gap-y-1">
                                <span>
                                    Sale desde: <strong className="text-texto">{detallePaquete.localidadGarantizada}</strong>
                                </span>
                                <span>
                                    Duración: <strong className="text-texto">{detallePaquete.circuito?.duracionDias ?? "—"} días</strong>
                                </span>
                                <span>
                                    Cierre de venta del paquete: <strong className="text-texto">{detallePaquete.diasCierreVenta ?? 2} días antes</strong>
                                </span>
                                {valorFechaInicio ? (
                                    tarifaDeLaFecha ? (
                                        <span>
                                            Precio para esa fecha:{" "}
                                            <strong className="text-texto">
                                                {tarifaDeLaFecha.moneda} {tarifaDeLaFecha.monto} / pasajero
                                            </strong>{" "}
                                            ({tarifaDeLaFecha.temporada?.nombre})
                                        </span>
                                    ) : (
                                        <span className="font-semibold text-amber-800">
                                            El paquete no tiene tarifa para una temporada activa en esa fecha: no se va a poder vender.
                                        </span>
                                    )
                                ) : null}
                                {detallePaquete.faltaTransporte ? (
                                    <span className="font-semibold text-amber-800">
                                        Este paquete no tiene transporte preasignado (podrás elegirlo en el paso 2).
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {/* PASO 2: Hotel y transporte */}
                {pasoActual === 1 && opciones ? (
                    <div className="space-y-5">
                        {/* Resumen superior */}
                        <div className="grid gap-3 sm:grid-cols-3 text-xs">
                            <div className="rounded-control border border-borde bg-fondo/50 p-3">
                                <span className="font-semibold uppercase tracking-wide text-texto-suave">
                                    Fechas y tarifa congelada
                                </span>
                                <p className="mt-1 text-sm font-bold text-navegacion">
                                    {formatearRangoFechasUtc(valorFechaInicio, opciones.fechaFin)}
                                </p>
                                <p className="text-texto-suave">
                                    USD {opciones.tarifa.monto} / pasajero ({opciones.tarifa.temporada})
                                </p>
                            </div>
                            <div className="rounded-control border border-borde bg-fondo/50 p-3">
                                <span className="font-semibold uppercase tracking-wide text-texto-suave">
                                    Lugares totales estimados
                                </span>
                                <p className="mt-1 text-sm font-bold text-navegacion">
                                    {opciones.totalLugares} personas
                                </p>
                                <p className="text-texto-suave">
                                    {opciones.tamanoMaximo} turistas + {opciones.dotacion.guias} guía(s) + {opciones.dotacion.porteadores} porteador(es)
                                </p>
                            </div>
                            <div className="rounded-control border border-borde bg-fondo/50 p-3">
                                <span className="font-semibold uppercase tracking-wide text-texto-suave">
                                    Cupo autoridad del parque
                                </span>
                                {opciones.cupoAutoridad === null ? (
                                    <p className="mt-1 font-semibold text-amber-800">
                                        No verificado (se validará al confirmar)
                                    </p>
                                ) : opciones.cupoAutoridad.alcanza ? (
                                    <p className="mt-1 font-semibold text-emerald-700">
                                        ✓ {opciones.cupoAutoridad.lugaresDisponibles} lugares libres
                                    </p>
                                ) : (
                                    <p className="mt-1 font-semibold text-peligro">
                                        Insuficiente ({opciones.cupoAutoridad.lugaresDisponibles} libres, necesita {opciones.totalLugares})
                                    </p>
                                )}
                            </div>
                        </div>

                        {cupoAutoridadInsuficiente ? (
                            <Alerta tipo="error" titulo="Cupo insuficiente ante la autoridad">
                                No hay lugares suficientes para esa fecha. Volvé al paso 1 para cambiar la fecha o reducir el grupo.
                            </Alerta>
                        ) : null}

                        {/* Hoteles (B10) */}
                        <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-navegacion">
                                        Hoteles de la salida
                                    </h3>
                                    <p className="text-xs text-texto-suave">
                                        Podés combinar más de un hotel si ninguno cubre todas las plazas solo.
                                    </p>
                                </div>
                                {plazasNecesarias > 0 ? (
                                    <span
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                                            plazasCubiertasOk
                                                ? "bg-emerald-100 text-emerald-900"
                                                : "bg-amber-100 text-amber-900"
                                        }`}
                                    >
                                        {algunHotelASolicitud
                                            ? `Cubiertas ${plazasNecesarias} de ${plazasNecesarias} plazas (incluye hotel a solicitud)`
                                            : `Cubiertas ${Math.min(plazasCubiertasBloqueo, plazasNecesarias)} de ${plazasNecesarias} plazas`}
                                    </span>
                                ) : null}
                            </div>

                            {plazasNecesarias === 0 ? (
                                <p className="rounded-control border border-borde bg-fondo/40 p-3 text-xs text-texto-suave">
                                    Este paquete no incluye noches de hotel.
                                </p>
                            ) : esSinHotelFA3 ? (
                                <Alerta tipo="advertencia" titulo="Sin hotel con plazas suficientes">
                                    Ningún hotel ni combinación disponible cubre las {plazasNecesarias} plazas. Podés crear la salida sin hotel asignado (cada compra generará una solicitud de alojamiento y el cierre sugerido pasa a {DIAS_CIERRE_SOLICITUD} días).
                                </Alerta>
                            ) : opciones.alojamientos.length === 0 ? (
                                <Alerta tipo="advertencia" titulo="Sin hoteles disponibles">
                                    No se encontraron alojamientos activos que cumplan la garantía del paquete.
                                </Alerta>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {opciones.alojamientos.map((hotel) => {
                                        const marcado = hotelesSeleccionados.includes(hotel.idservicio);
                                        const esSolicitud = hotel.modalidadConfirmacion === "A_SOLICITUD";
                                        // Con el grupo cubierto, otro hotel no aportaría plazas
                                        const cubierto = !marcado && plazasCubiertasOk && hotelesSeleccionados.length > 0;
                                        const aporte = aportes.get(hotel.idservicio);
                                        return (
                                            <label
                                                key={hotel.idservicio}
                                                className={`flex items-start gap-3 rounded-control border p-3 transition-colors ${
                                                    marcado
                                                        ? "cursor-pointer border-marca bg-marca-suave/30"
                                                        : cubierto
                                                          ? "cursor-not-allowed border-borde bg-slate-50 opacity-60"
                                                          : "cursor-pointer border-borde bg-white hover:border-marca/40"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={marcado}
                                                    disabled={cubierto}
                                                    onChange={() => alternarHotel(hotel.idservicio)}
                                                    className="mt-1 h-4 w-4 rounded border-borde text-marca focus:ring-marca"
                                                />
                                                <div className="flex-1 text-xs">
                                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                                        <span className="font-bold text-sm text-navegacion">
                                                            {hotel.nombreServicio}
                                                        </span>
                                                        <span
                                                            className={`rounded px-2 py-0.5 font-semibold ${
                                                                esSolicitud
                                                                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                                                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                            }`}
                                                        >
                                                            {esSolicitud
                                                                ? "A solicitud"
                                                                : `${hotel.capacidadDisponible ?? 0} plazas libres`}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 text-texto-suave">
                                                        {hotel.localidad}
                                                        {hotel.categoria ? ` · ${hotel.categoria}` : ""}
                                                        {hotel.costoPorNoche != null ? ` · ${formatearMonto(hotel.costoPorNoche)} por noche` : ""}
                                                    </p>
                                                    {marcado && aporte !== undefined ? (
                                                        <p className={`mt-0.5 font-semibold ${aporte > 0 ? "text-marca-oscura" : "text-peligro"}`}>
                                                            {aporte > 0
                                                                ? `Aporta ${aporte} ${aporte === 1 ? "plaza" : "plazas"}`
                                                                : "No aporta plazas: desmarcalo"}
                                                        </p>
                                                    ) : cubierto ? (
                                                        <p className="mt-0.5 text-texto-suave">El grupo ya está cubierto</p>
                                                    ) : null}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Cierre de venta (B4) */}
                        <div className="rounded-control border border-borde bg-fondo/40 p-3.5">
                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <label className="grid gap-1 text-xs font-semibold text-texto">
                                    Días de cierre de venta antes del inicio
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={diasCierreVenta}
                                        onChange={(e) => {
                                            setDiasCierreVentaManual(Number(e.target.value));
                                        }}
                                        className="w-32 rounded-control border border-borde bg-white px-3 py-1.5 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                    />
                                </label>
                                <p className="text-xs text-texto-suave flex-1">
                                    {algunHotelASolicitud
                                        ? `Se sugieren ${corteSugerido} días antes porque elegiste al menos un hotel a solicitud.`
                                        : esSinHotelFA3
                                          ? `Se sugieren ${corteSugerido} días antes porque la salida queda sin hotel asignado.`
                                          : `Valor del paquete: ${opciones.paquete.diasCierreVenta} días antes del inicio.`}
                                    {valorFechaInicio
                                        ? ` Último día de venta: ${formatearFechaUtcCorta(sumarDiasIso(valorFechaInicio, -(diasCierreVenta + 1)))}.`
                                        : ""}
                                </p>
                            </div>
                        </div>

                        {/* Transporte (B3, 12.4) */}
                        <div className="space-y-2.5">
                            <div>
                                <h3 className="text-sm font-bold text-navegacion">
                                    Transporte terrestre
                                </h3>
                                <p className="text-xs text-texto-suave">
                                    Debe tener al menos {opciones.totalLugares} asientos para pasajeros y personal.
                                </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {opciones.transportes.map((trans) => {
                                    const seleccionado = idtransporteSeleccionado === trans.idservicio;
                                    const bloqueado = !trans.libre || !trans.alcanza;
                                    return (
                                        <label
                                            key={trans.idservicio}
                                            className={`flex items-start gap-3 rounded-control border p-3 transition-colors ${
                                                bloqueado
                                                    ? "cursor-not-allowed border-borde bg-slate-50 opacity-60"
                                                    : seleccionado
                                                      ? "cursor-pointer border-marca bg-marca-suave/30"
                                                      : "cursor-pointer border-borde bg-white hover:border-marca/40"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="transporte-crear-salida"
                                                disabled={bloqueado}
                                                checked={seleccionado}
                                                onChange={() => setIdtransporteSeleccionado(trans.idservicio)}
                                                className="mt-1 h-4 w-4 text-marca focus:ring-marca"
                                            />
                                            <div className="flex-1 text-xs">
                                                <div className="flex flex-wrap items-center justify-between gap-1">
                                                    <span className="font-bold text-sm text-navegacion">
                                                        {trans.nombreServicio}
                                                    </span>
                                                    {trans.delPaquete ? (
                                                        <span className="rounded bg-marca/10 px-2 py-0.5 font-semibold text-marca-oscura">
                                                            Del paquete
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="mt-0.5 text-texto-suave">
                                                    Capacidad: <strong>{trans.capacidadVehiculo} asientos</strong>
                                                    {!trans.libre ? (
                                                        <span className="ml-2 font-semibold text-peligro">
                                                            · Ocupado en esas fechas
                                                        </span>
                                                    ) : !trans.alcanza ? (
                                                        <span className="ml-2 font-semibold text-peligro">
                                                            · Insuficiente para {opciones.totalLugares} lugares
                                                        </span>
                                                    ) : trans.encarecePorPasajero ? (
                                                        <span
                                                            className="ml-2 text-amber-800"
                                                            title="Cuesta más que el transporte del paquete: la diferencia por pasajero sale del margen"
                                                        >
                                                            · +{formatearMonto(trans.encarecePorPasajero)} por pasajero
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* PASO 3: Guías y porteadores */}
                {pasoActual === 2 && opciones ? (
                    <div className="space-y-4">
                        <p className="text-xs text-texto-suave">
                            Se muestran solo las personas aptas y libres en esas fechas, ordenadas de menor a mayor carga en el mes.
                        </p>
                        {transporteElegido ? (
                            <p
                                className={`rounded-control border px-3 py-2 text-xs ${
                                    sinAsientoLibre
                                        ? "border-amber-300 bg-amber-50 text-amber-900"
                                        : "border-borde bg-fondo/40 text-texto"
                                }`}
                            >
                                Asientos de {transporteElegido.nombreServicio}:{" "}
                                <strong>
                                    {opciones.tamanoMaximo + personalSeleccionadoIds.length} de{" "}
                                    {transporteElegido.capacidadVehiculo}
                                </strong>{" "}
                                ({opciones.tamanoMaximo} pasajeros + {personalSeleccionadoIds.length} personal).
                                {sinAsientoLibre
                                    ? " No quedan asientos: para sumar personal, cambiá el transporte en el paso 2."
                                    : ""}
                            </p>
                        ) : null}

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Guías */}
                            <div className="rounded-control border border-borde p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-borde pb-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-navegacion">
                                            Guías libres
                                        </h3>
                                        <p className="text-xs text-texto-suave">
                                            Mínimo requerido: {opciones.dotacion.guias}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                            guiasSeleccionadosIds.length >= opciones.dotacion.guias
                                                ? "bg-emerald-100 text-emerald-900"
                                                : "bg-amber-100 text-amber-900"
                                        }`}
                                    >
                                        {guiasSeleccionadosIds.length} / {opciones.dotacion.guias}
                                    </span>
                                </div>
                                {opciones.personal.guias.length === 0 ? (
                                    <p className="text-xs text-peligro">
                                        No hay guías aptos y libres para estas fechas.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                                        {opciones.personal.guias.map((g) => {
                                            const marcado = personalSeleccionadoIds.includes(g.idpersonal);
                                            return (
                                                <li key={g.idpersonal}>
                                                    <label
                                                        className={`flex items-center justify-between rounded-control border px-3 py-2 text-xs cursor-pointer ${
                                                            marcado
                                                                ? "border-marca bg-marca-suave/30 font-semibold text-navegacion"
                                                                : "border-borde hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={marcado}
                                                                disabled={!marcado && sinAsientoLibre}
                                                                onChange={() => alternarPersonal(g.idpersonal)}
                                                                className="h-4 w-4 rounded border-borde text-marca disabled:opacity-40"
                                                            />
                                                            {g.nombreCompleto}
                                                        </span>
                                                        <span className="text-texto-suave font-normal">
                                                            {g.salidasEnElMes}{" "}
                                                            {g.salidasEnElMes === 1 ? "salida" : "salidas"} este mes
                                                        </span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* Porteadores */}
                            <div className="rounded-control border border-borde p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-borde pb-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-navegacion">
                                            Porteadores libres
                                        </h3>
                                        <p className="text-xs text-texto-suave">
                                            Mínimo para {opciones.tamanoMaximo} pax: {opciones.dotacion.porteadores}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                            porteadoresSeleccionadosIds.length >= opciones.dotacion.porteadores
                                                ? "bg-emerald-100 text-emerald-900"
                                                : "bg-amber-100 text-amber-900"
                                        }`}
                                    >
                                        {porteadoresSeleccionadosIds.length} / {opciones.dotacion.porteadores}
                                    </span>
                                </div>
                                {opciones.personal.porteadores.length === 0 ? (
                                    <p className="text-xs text-texto-suave">
                                        {opciones.dotacion.porteadores === 0
                                            ? "Este circuito no requiere porteadores."
                                            : "No hay porteadores libres para estas fechas."}
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                                        {opciones.personal.porteadores.map((p) => {
                                            const marcado = personalSeleccionadoIds.includes(p.idpersonal);
                                            return (
                                                <li key={p.idpersonal}>
                                                    <label
                                                        className={`flex items-center justify-between rounded-control border px-3 py-2 text-xs cursor-pointer ${
                                                            marcado
                                                                ? "border-marca bg-marca-suave/30 font-semibold text-navegacion"
                                                                : "border-borde hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={marcado}
                                                                disabled={!marcado && sinAsientoLibre}
                                                                onChange={() => alternarPersonal(p.idpersonal)}
                                                                className="h-4 w-4 rounded border-borde text-marca disabled:opacity-40"
                                                            />
                                                            {p.nombreCompleto}
                                                        </span>
                                                        <span className="text-texto-suave font-normal">
                                                            {p.salidasEnElMes}{" "}
                                                            {p.salidasEnElMes === 1 ? "salida" : "salidas"} este mes
                                                        </span>
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* PASO 4: Revisión y stock proyectado */}
                {pasoActual === 3 && opciones ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 rounded-control border border-borde bg-fondo/40 p-4 text-xs">
                            <div>
                                <span className="text-texto-suave">Paquete</span>
                                <p className="font-bold text-sm text-navegacion">
                                    {opciones.paquete.nombrePaquete}
                                </p>
                            </div>
                            <div>
                                <span className="text-texto-suave">Fechas y cierre de venta</span>
                                <p className="font-bold text-sm text-navegacion">
                                    {formatearRangoFechasUtc(valorFechaInicio, opciones.fechaFin)}
                                </p>
                                <p className="text-texto-suave">
                                    Cierra {diasCierreVenta} días antes (último día:{" "}
                                    {formatearFechaUtcCorta(sumarDiasIso(valorFechaInicio, -(diasCierreVenta + 1)))})
                                </p>
                            </div>
                            <div>
                                <span className="text-texto-suave">Grupo y bloqueo autoridad</span>
                                <p className="font-semibold text-texto">
                                    {opciones.tamanoMaximo} pasajeros + {personalSeleccionadoIds.length} personal ={" "}
                                    <strong>{totalLugaresConPersonalElegido} lugares</strong>
                                </p>
                            </div>
                            <div>
                                <label className="text-texto-suave" htmlFor="precio-salida">
                                    Precio por pasajero (se congela al guardar)
                                </label>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <span className="font-semibold text-texto">USD</span>
                                    <input
                                        id="precio-salida"
                                        type="number"
                                        min={1}
                                        step="0.01"
                                        value={precioAjustado === "" ? opciones.tarifa.monto : precioAjustado}
                                        onChange={(e) => setPrecioAjustado(e.target.value)}
                                        className="w-28 rounded-control border border-borde bg-white px-2 py-1 text-sm font-semibold text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                    />
                                </div>
                                <p className="text-xs text-texto-suave">
                                    Tarifa del paquete: USD {opciones.tarifa.monto} ({opciones.tarifa.temporada})
                                </p>
                                {extraLogistica > 0 ? (
                                    <p className="mt-1 text-xs text-amber-800">
                                        La logística elegida cuesta {formatearMonto(extraLogistica)} más por pasajero que la referencia del paquete
                                        {extraHotel > 0 && extraTransporte > 0
                                            ? ` (hotel ${formatearMonto(extraHotel)}, transporte ${formatearMonto(extraTransporte)})`
                                            : extraHotel > 0
                                              ? " (por el hotel)"
                                              : " (por el transporte)"}
                                        .{" "}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPrecioAjustado(String(Math.round((opciones.tarifa!.monto + extraLogistica) * 100) / 100))
                                            }
                                            className="font-semibold text-marca underline hover:text-marca-oscura"
                                        >
                                            Sumar al precio
                                        </button>
                                    </p>
                                ) : null}
                                {!precioValido ? (
                                    <p className="text-xs font-semibold text-peligro">El precio tiene que ser mayor a 0.</p>
                                ) : null}
                                <p className="text-xs text-texto-suave">
                                    Si se llena: {opciones.tamanoMaximo} × {formatearMonto(precioFinal)} ={" "}
                                    <strong className="text-texto">{formatearMonto(opciones.tamanoMaximo * precioFinal)}</strong>
                                </p>
                            </div>
                            <div>
                                <span className="text-texto-suave">Hoteles</span>
                                <p className="font-semibold text-texto">
                                    {hotelesElegidosObjetos.length > 0
                                        ? hotelesElegidosObjetos.map((h) => h.nombreServicio).join(", ")
                                        : "Sin noches de hotel"}
                                </p>
                            </div>
                            <div>
                                <span className="text-texto-suave">Transporte</span>
                                <p className="font-semibold text-texto">
                                    {transporteElegido
                                        ? `${transporteElegido.nombreServicio} (${transporteElegido.capacidadVehiculo} asientos)`
                                        : "—"}
                                </p>
                            </div>
                            {opciones.tren ? (
                                <div className="sm:col-span-2 border-t border-borde/60 pt-2">
                                    <span className="text-texto-suave">Tren incluido</span>
                                    <p className="font-semibold text-texto">
                                        {opciones.tren.nombreServicio} · Sale {opciones.tren.horarioSalida}, llega{" "}
                                        {opciones.tren.horarioLlegada}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        {/* Control proyectado de equipo (B3) */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-navegacion">
                                Stock proyectado de equipamiento
                            </h3>
                            <p className="text-xs text-texto-suave">
                                El equipo no se descuenta ahora: se descontará día por día a medida que ingresen compras.
                            </p>

                            {opciones.equipo.length === 0 ? (
                                <p className="text-xs text-texto-suave">
                                    Este paquete no declara equipamiento propio.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-control border border-borde">
                                    <table className="min-w-full divide-y divide-borde text-left text-xs">
                                        <thead className="bg-slate-50 font-semibold text-texto-suave">
                                            <tr>
                                                <th className="px-3 py-2">Equipo</th>
                                                <th className="px-3 py-2">Regla</th>
                                                <th className="px-3 py-2 text-right">Salida completa</th>
                                                <th className="px-3 py-2 text-right">Libre proyectado</th>
                                                <th className="px-3 py-2">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-borde bg-white">
                                            {opciones.equipo.map((eq) => (
                                                <tr key={eq.idservicio}>
                                                    <td className="px-3 py-2 font-semibold text-texto">
                                                        {eq.nombreServicio}
                                                    </td>
                                                    <td className="px-3 py-2 text-texto-suave">
                                                        {eq.cadaPasajeros ? `${eq.cantidad} cada ${eq.cadaPasajeros} pax` : `${eq.cantidad} por salida`}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold">
                                                        {eq.necesitaCompleta}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {eq.libre}
                                                        {eq.fechaCritica ? (
                                                            <span className="block text-[11px] text-texto-suave">
                                                                mín. el {formatearFechaUtcCorta(eq.fechaCritica)}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {eq.nivel === "OK" ? (
                                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                                                                Alcanza
                                                            </span>
                                                        ) : eq.nivel === "RIESGO" ? (
                                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                                                                Justo (50–100%)
                                                            </span>
                                                        ) : (
                                                            <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-900">
                                                                No alcanza (&lt; 50%)
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {equipoBloqueante.length > 0 ? (
                                <Alerta tipo="error" titulo="No alcanza el equipo para crear la salida">
                                    Al menos un ítem de equipamiento está por debajo del 50 % proyectado. Volvé al paso 1 y reducí el tamaño máximo o elegí otra fecha.
                                </Alerta>
                            ) : equipoEnRiesgo.length > 0 ? (
                                <Alerta tipo="advertencia" titulo="Equipo justo si se vende completa">
                                    Podés crear la salida, pero si se completa el cupo faltará stock de{" "}
                                    {equipoEnRiesgo.map((e) => e.nombreServicio).join(", ")}.
                                </Alerta>
                            ) : null}

                            {errorDetalleEquipo ? (
                                <Alerta tipo="error" titulo="Sugerencia de cupo máximo por equipamiento">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs">
                                            Con el stock proyectado actual podés crear la salida con hasta{" "}
                                            <strong>{errorDetalleEquipo.tamanoMaximoSugerido} pasajeros</strong>.
                                        </p>
                                        <Boton
                                            type="button"
                                            variante="secundario"
                                            className="px-3 py-1 text-xs"
                                            onClick={() => {
                                                setValue(
                                                    "tamanoMaximo",
                                                    errorDetalleEquipo.tamanoMaximoSugerido,
                                                );
                                                setPasoActual(0);
                                            }}
                                        >
                                            Usar máximo de {errorDetalleEquipo.tamanoMaximoSugerido} pasajeros
                                        </Boton>
                                    </div>
                                </Alerta>
                            ) : null}
                        </div>

                        {valorTamanoMaximo !== opciones.tamanoMaximo ? (
                            <p className="text-xs text-amber-800">
                                El tamaño del grupo se modificó: volvé al paso 1 para recalcular las opciones.
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </AsistentePasos>
        </form>
    );
}

export default FormularioCrearSalida;
