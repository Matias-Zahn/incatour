import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import Modal from "../../components/Modal";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import portadaMachuPicchu from "../../assets/portada-machu-picchu.jpg";
import {
    paqueteDeSalida,
    useCatalogoPublico,
    useCrearReservaPaquete,
    type PaqueteCatalogoPublico,
    type PasajeroReservaInput,
    type ResultadoReservaConfirmada,
    type SalidaDisponibleCatalogo,
} from "../../services/catalogoCompraService";
import {
    formatearDiasLegibles,
    resolverUrlImagenPaquete,
} from "../../services/paqueteService";
import { ErrorApi } from "../../services/clienteApi";
import { obtenerComprobanteMiReserva } from "../../services/clientePortalService";
import { descargarComprobantePdf } from "../../services/pdf";
import { obtenerToken, obtenerUsuario } from "../../services/sesionService";
import {
    crearEsquemaCompra,
    TARJETA_VACIA,
    type DatosCompra,
    type FormularioCompra,
} from "./esquemaCompra";
import { formatearFechaUtcCorta, formatearMonto } from "../../services/formato";

// FE-48: compra en curso guardada en la pestaña (sessionStorage) mientras se vuelve a iniciar sesión
const CLAVE_COMPRA_GUARDADA = "incatour.cliente.compra_en_curso";
type CompraGuardada = {
    // Solo la retoma el mismo cliente: otro que entre en la pestaña no ve nombres ni pasaportes ajenos
    idusuario: number | undefined;
    paqueteEnCompraId: number | null;
    idSalidaSeleccionada: number | null;
    pasajeros: PasajeroFormulario[];
};

function leerCompraGuardada(): CompraGuardada | null {
    try {
        const crudo = sessionStorage.getItem(CLAVE_COMPRA_GUARDADA);
        const compra = crudo ? (JSON.parse(crudo) as CompraGuardada) : null;
        if (compra && compra.idusuario !== obtenerUsuario()?.idusuario) {
            sessionStorage.removeItem(CLAVE_COMPRA_GUARDADA);
            return null;
        }
        return compra;
    } catch {
        return null;
    }
}

function guardarCompra(compra: CompraGuardada) {
    try {
        sessionStorage.setItem(CLAVE_COMPRA_GUARDADA, JSON.stringify(compra));
    } catch {
        // sin sessionStorage la compra simplemente no se recupera
    }
}

function borrarCompraGuardada() {
    try {
        sessionStorage.removeItem(CLAVE_COMPRA_GUARDADA);
    } catch {
        // nada que borrar
    }
}

type PasajeroFormulario = PasajeroReservaInput;

const PASAJEROS_PRUEBA: Array<{
    nombreCompleto: string;
    nroPasaporteBase: string;
    nacionalidad: string;
    fechaVencimientoPasaporte: string;
}> = [
    {
        nombreCompleto: "Juan Ignacio Pérez",
        nroPasaporteBase: "ARG-401298",
        nacionalidad: "Argentina",
        fechaVencimientoPasaporte: "2031-08-15",
    },
    {
        nombreCompleto: "María Sol Gómez",
        nroPasaporteBase: "ARG-428910",
        nacionalidad: "Argentina",
        fechaVencimientoPasaporte: "2032-04-20",
    },
    {
        nombreCompleto: "Lucas Martín Rojas",
        nroPasaporteBase: "CHL-991042",
        nacionalidad: "Chilena",
        fechaVencimientoPasaporte: "2030-11-10",
    },
    {
        nombreCompleto: "Camila Andrea Torres",
        nroPasaporteBase: "URU-552319",
        nacionalidad: "Uruguaya",
        fechaVencimientoPasaporte: "2033-02-28",
    },
];

const TARJETAS_PRUEBA = [
    {
        etiqueta: "✓ Tarjeta aprobada",
        descripcion: "Pago exitoso y emisión de reserva",
        tono: "exito" as const,
        numero: "4532 8910 2234 8899",
        titular: "JUAN I PEREZ",
        vencimiento: "11/29",
        cvv: "482",
    },
    {
        etiqueta: "✕ Fondos insuficientes (0000)",
        descripcion: "Rechaza el cobro y revierte los cupos",
        tono: "error" as const,
        numero: "4532 8910 2234 0000",
        titular: "JUAN I PEREZ",
        vencimiento: "11/29",
        cvv: "482",
    },
    {
        etiqueta: "✕ Tarjeta robada (1111)",
        descripcion: "Simula rechazo por alerta del emisor",
        tono: "error" as const,
        numero: "4532 8910 2234 1111",
        titular: "JUAN I PEREZ",
        vencimiento: "11/29",
        cvv: "482",
    },
    {
        etiqueta: "✕ Falla de seguridad (CVV 999)",
        descripcion: "Simula error de validación CVV",
        tono: "error" as const,
        numero: "4532 8910 2234 8899",
        titular: "JUAN I PEREZ",
        vencimiento: "11/29",
        cvv: "999",
    },
];


function sumarDiasIso(iso: string, dias: number): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    const copia = new Date(fecha.getTime());
    copia.setUTCDate(copia.getUTCDate() + dias);
    return copia.toISOString();
}

function derivarFechasAlojamiento(
    fechaInicioIso: string,
    fechaFinIso: string,
    nochesPrevias: number,
    nochesPosteriores: number,
): {
    estadiaPrevia: string | null;
    estadiaPosterior: string | null;
} {
    const estadiaPrevia =
        nochesPrevias > 0
            ? `${formatearFechaUtcCorta(sumarDiasIso(fechaInicioIso, -nochesPrevias))} al ${formatearFechaUtcCorta(fechaInicioIso)} (${nochesPrevias} ${nochesPrevias === 1 ? "noche" : "noches"})`
            : null;
    const estadiaPosterior =
        nochesPosteriores > 0
            ? `${formatearFechaUtcCorta(fechaFinIso)} al ${formatearFechaUtcCorta(sumarDiasIso(fechaFinIso, nochesPosteriores))} (${nochesPosteriores} ${nochesPosteriores === 1 ? "noche" : "noches"})`
            : null;
    return { estadiaPrevia, estadiaPosterior };
}

function obtenerImagenesPaqueteCatalogo(
    paquete: PaqueteCatalogoPublico,
): string[] {
    if (paquete.imagenes && paquete.imagenes.length > 0) {
        return paquete.imagenes;
    }
    if (paquete.imagenPrincipal) {
        return [paquete.imagenPrincipal];
    }
    return ["/imagenes/catalogo/machu-picchu.jpg"];
}

// FE-13: el pasajero inicial arranca vacío; los datos de prueba solo se ofrecen en DEV
function textoNoches(previas: number, posteriores: number): string {
    if (previas + posteriores === 0) return "Sin noches de hotel extra";
    return `${previas} ${previas === 1 ? "noche" : "noches"} antes y ${posteriores} después`;
}

function crearPasajeroInicial(): PasajeroFormulario {
    return {
        nombreCompleto: "",
        nroPasaporte: "",
        nacionalidad: "Argentina",
        fechaVencimientoPasaporte: "",
    };
}


type CampoCompraProps = ComponentProps<"input"> & {
    etiqueta: string;
    error?: string;
    // Texto de ayuda debajo del campo
    ayuda?: ReactNode;
};

// Un campo del formulario de compra: el error va debajo, marcado para los lectores de pantalla (PR 4.2)
function CampoCompra({ etiqueta, error, ayuda, id, className = "", ...input }: CampoCompraProps) {
    return (
        <label className="grid min-w-0 grid-cols-1 gap-1 text-xs font-semibold text-texto">
            {etiqueta}
            <input
                id={id}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                {...input}
                className={`min-h-11 w-full min-w-0 rounded-control border bg-white px-3 py-2 text-base font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 md:text-sm ${error ? "border-peligro" : "border-borde"} ${className}`}
            />
            {error ? (
                <span id={`${id}-error`} className="font-normal text-peligro">
                    {error}
                </span>
            ) : null}
            {ayuda}
        </label>
    );
}

// Sufijo de dos dígitos para los pasaportes de prueba (solo en el autocompletado de desarrollo)
const sufijoAleatorio = () => Math.floor(10 + Math.random() * 89);

function pasajeroDePrueba(indice: number): PasajeroFormulario {
    const { nroPasaporteBase, ...plantilla } = PASAJEROS_PRUEBA[indice % PASAJEROS_PRUEBA.length];
    return { ...plantilla, nroPasaporte: `${nroPasaporteBase}${sufijoAleatorio()}` };
}

function estiloDificultad(dificultad: string): string {
    const norm = dificultad.trim().toUpperCase();
    if (norm === "BAJA") return "bg-emerald-500/90 text-white";
    if (norm === "MEDIA") return "bg-amber-500/90 text-white";
    return "bg-rose-600/90 text-white";
}

function IconoBuscar() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

function IconoPin() {
    return (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function IconoHotel() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
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

function IconoCheck() {
    return (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function IconoFiltros() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    );
}

function CatalogoCompraPage() {
    const navegar = useNavigate();
    const [parametrosUrl] = useSearchParams();
    const esVistaPreviaAdmin = parametrosUrl.get("vista") === "admin";
    const idPaquetePreseleccionado = Number(parametrosUrl.get("paquete") ?? 0);
    const usuarioSesion = obtenerToken() ? obtenerUsuario() : null;
    const esSesionCliente = usuarioSesion?.rol === "CLIENTE";
    const esAdmin = esVistaPreviaAdmin || usuarioSesion?.rol === "ADMIN";

    const {
        data: paquetes = [],
        isPending,
        isError,
        error,
    } = useCatalogoPublico();
    const mutacionReserva = useCrearReservaPaquete();
    const errorBannerRef = useRef<HTMLDivElement>(null);

    // Filtros del escaparate (CU-26 · RF-27: duración, dificultad y rango de fechas)
    const [busqueda, setBusqueda] = useState("");
    const [filtroDificultad, setFiltroDificultad] = useState("TODAS");
    const [filtroDuracion, setFiltroDuracion] = useState("TODAS");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [soloConSalidas, setSoloConSalidas] = useState(false);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

    // Modal de detalle e itinerario (CU-26)
    const [paqueteDetalle, setPaqueteDetalle] =
        useState<PaqueteCatalogoPublico | null>(null);
    const [indiceFotoDetalle, setIndiceFotoDetalle] = useState(0);
    const [preseleccionProcesada, setPreseleccionProcesada] = useState<
        number | null
    >(null);

    // Paquete preseleccionado por la URL: se abre una sola vez, cuando llegan los paquetes.
    // Se ajusta el estado durante el render (sin efecto) para no encadenar renders
    if (
        idPaquetePreseleccionado > 0 &&
        paquetes.length > 0 &&
        preseleccionProcesada !== idPaquetePreseleccionado
    ) {
        const encontrado = paquetes.find(
            (p) => p.id === idPaquetePreseleccionado,
        );
        setPreseleccionProcesada(idPaquetePreseleccionado);
        if (encontrado) {
            setPaqueteDetalle(encontrado);
            setIndiceFotoDetalle(0);
        }
    }

    // Flujo de compra (CU-30). FE-48: si la sesión venció al pagar, se retoma la compra guardada (sin la tarjeta)
    const [compraGuardada] = useState(leerCompraGuardada);
    useEffect(() => {
        if (compraGuardada) borrarCompraGuardada();
    }, [compraGuardada]);
    const [paqueteEnCompraId, setPaqueteEnCompraId] = useState<number | null>(
        compraGuardada?.paqueteEnCompraId ?? null,
    );
    const [idSalidaSeleccionada, setIdSalidaSeleccionada] = useState<
        number | null
    >(compraGuardada?.idSalidaSeleccionada ?? null);
    const [errorCompra, setErrorCompra] = useState(() =>
        compraGuardada
            ? "Tu sesión había vencido: recuperamos la salida y los pasajeros. Volvé a cargar la tarjeta para pagar."
            : "",
    );

    useEffect(() => {
        if (errorCompra && errorBannerRef.current) {
            errorBannerRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [errorCompra]);

    // Comprobante de reserva exitosa
    const [errorComprobante, setErrorComprobante] = useState("");
    const [descargandoComprobante, setDescargandoComprobante] = useState(false);
    const [reservaConfirmada, setReservaConfirmada] = useState<{
        resultado: ResultadoReservaConfirmada;
        paquete: PaqueteCatalogoPublico;
        salida: SalidaDisponibleCatalogo;
        pasajeros: PasajeroFormulario[];
    } | null>(null);

    const paqueteEnCompra =
        paquetes.find((p) => p.id === paqueteEnCompraId) ?? null;

    const salidasDelPaquete = paqueteEnCompra?.salidasDisponibles ?? [];
    const salidaActiva =
        salidasDelPaquete.find((s) => s.idsalida === idSalidaSeleccionada) ??
        salidasDelPaquete[0] ??
        null;
    // CAT-30: lo que se compra es la salida elegida (su foto), no el paquete tal como está hoy
    const paqueteVendido =
        paqueteEnCompra && salidaActiva ? paqueteDeSalida(paqueteEnCompra, salidaActiva) : paqueteEnCompra;

    const cupoMaximo = salidaActiva?.stockLocal ?? 10;
    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        clearErrors,
        formState: { errors },
    } = useForm<FormularioCompra, unknown, DatosCompra>({
        // El esquema depende de la salida elegida: se arma en cada validación
        resolver: (valores, contexto, opciones) =>
            zodResolver(
                crearEsquemaCompra(
                    salidaActiva?.fechaFin ?? "",
                    cupoMaximo,
                    salidaActiva ? formatearFechaUtcCorta(salidaActiva.fechaFin) : "fin del recorrido",
                ),
            )(valores, contexto, opciones),
        defaultValues: {
            pasajeros: compraGuardada?.pasajeros ?? [crearPasajeroInicial()],
            tarjeta: TARJETA_VACIA,
        },
    });
    const { fields: camposPasajeros, append, remove } = useFieldArray({ control, name: "pasajeros" });
    const pasajeros = useWatch({ control, name: "pasajeros" });
    const tarjetaCargada = useWatch({ control, name: "tarjeta" });
    const errorNomina = errors.pasajeros?.root?.message ?? errors.pasajeros?.message;

    function abrirDetallePaquete(paquete: PaqueteCatalogoPublico) {
        setPaqueteDetalle(paquete);
        setIndiceFotoDetalle(0);
    }

    // FE-46: los datos de la tarjeta no quedan cargados de una compra a otra
    function vaciarTarjeta() {
        setValue("tarjeta", TARJETA_VACIA);
        clearErrors("tarjeta");
    }

    function iniciarCompraPaquete(
        paquete: PaqueteCatalogoPublico,
        idSalidaInicial?: number,
    ) {
        vaciarTarjeta();
        setPaqueteDetalle(null);
        setReservaConfirmada(null);
        setErrorCompra("");
        setPaqueteEnCompraId(paquete.id);
        const primeraSalida =
            idSalidaInicial ??
            paquete.salidasDisponibles?.find(
                (s) =>
                    s.ventaAbierta !== false &&
                    s.stockLocal > 0 &&
                    s.precioPersona != null,
            )?.idsalida ??
            paquete.salidasDisponibles?.[0]?.idsalida ??
            null;
        setIdSalidaSeleccionada(primeraSalida);
        reset({ pasajeros: [crearPasajeroInicial()], tarjeta: TARJETA_VACIA });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function volverAlEscaparate() {
        vaciarTarjeta();
        borrarCompraGuardada();
        setPaqueteEnCompraId(null);
        setIdSalidaSeleccionada(null);
        setErrorCompra("");
        setReservaConfirmada(null);
    }

    function agregarPasajero(autocompletar = false) {
        setErrorCompra("");
        if (pasajeros.length >= cupoMaximo) return;
        append(
            autocompletar ? pasajeroDePrueba(pasajeros.length) : crearPasajeroInicial(),
            { shouldFocus: false },
        );
    }

    function autocompletarPasajeroExistente(indice: number) {
        setErrorCompra("");
        setValue(`pasajeros.${indice}`, pasajeroDePrueba(indice));
        clearErrors(`pasajeros.${indice}`);
    }

    function quitarPasajero(indice: number) {
        if (pasajeros.length <= 1) return;
        setErrorCompra("");
        remove(indice);
    }

    function aplicarTarjetaPrueba(tarjeta: (typeof TARJETAS_PRUEBA)[number]) {
        setErrorCompra("");
        const { numero, titular, vencimiento, cvv } = tarjeta;
        setValue("tarjeta", { numero, titular, vencimiento, cvv });
        clearErrors("tarjeta");
    }

    // Cálculo en tiempo real de la tarifa por cantidad de pasajeros (idéntico a ReservaService.calcularPrecio)
    const sinTarifa = salidaActiva?.precioPersona == null;
    const precioUnitario = salidaActiva?.precioPersona ?? 0;
    const monedaActiva = salidaActiva?.moneda ?? "USD";
    const subtotalPasajeros = precioUnitario * pasajeros.length;
    const totalPagar = Math.round(subtotalPasajeros * 100) / 100;

    // Las reglas de cada campo están en esquemaCompra.ts: acá solo llegan datos válidos
    async function confirmarCompra(datos: DatosCompra) {
        if (!obtenerToken() || obtenerUsuario()?.rol !== "CLIENTE") {
            setErrorCompra(
                "Para confirmar la compra debés iniciar sesión con una cuenta de perfil CLIENTE.",
            );
            return;
        }

        if (!paqueteEnCompra || !salidaActiva) {
            setErrorCompra(
                "Seleccioná una salida programada disponible para continuar con la compra.",
            );
            return;
        }

        // FE-48: si el token venció, clienteApi recarga en /login; la compra se retoma al volver
        guardarCompra({
            idusuario: usuarioSesion?.idusuario,
            paqueteEnCompraId,
            idSalidaSeleccionada,
            pasajeros: datos.pasajeros,
        });
        try {
            const respuesta = await mutacionReserva.mutateAsync({
                idsalida: salidaActiva.idsalida,
                medioPago: "TARJETA",
                pasajeros: datos.pasajeros.map((p) => ({
                    nombreCompleto: p.nombreCompleto,
                    nroPasaporte: p.nroPasaporte,
                    nacionalidad: p.nacionalidad,
                    fechaVencimientoPasaporte: p.fechaVencimientoPasaporte,
                })),
                tarjeta: datos.tarjeta,
            });

            vaciarTarjeta();
            borrarCompraGuardada();
            setReservaConfirmada({
                resultado: respuesta.reserva,
                paquete: paqueteDeSalida(paqueteEnCompra, salidaActiva),
                salida: salidaActiva,
                pasajeros: datos.pasajeros,
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            // Solo un 401 deja la compra guardada (se retoma después del login)
            if (!(err instanceof ErrorApi && err.estado === 401)) borrarCompraGuardada();
            setErrorCompra(
                err instanceof Error
                    ? err.message
                    : "No se pudo procesar la compra del paquete.",
            );
        }
    }

    async function descargarComprobanteReserva() {
        if (!reservaConfirmada) return;
        try {
            setErrorComprobante("");
            setDescargandoComprobante(true);
            await descargarComprobantePdf(
                await obtenerComprobanteMiReserva(reservaConfirmada.resultado.idreserva),
            );
        } catch (err) {
            setErrorComprobante(
                err instanceof Error
                    ? err.message
                    : "No se pudo descargar el comprobante de la reserva.",
            );
        } finally {
            setDescargandoComprobante(false);
        }
    }

    // Filtrado del catálogo (RF-27: duración, dificultad y rango de fechas)
    const termino = busqueda.trim().toLowerCase();
    const hayFiltrosActivos =
        termino !== "" ||
        filtroDificultad !== "TODAS" ||
        filtroDuracion !== "TODAS" ||
        fechaDesde !== "" ||
        fechaHasta !== "" ||
        soloConSalidas;

    const hoyIsoLocal = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const salidaEnRango = (s: { fechaInicio: string }) => {
        const dia = s.fechaInicio.slice(0, 10);
        return (!fechaDesde || dia >= fechaDesde) && (!fechaHasta || dia <= fechaHasta);
    };
    const esVentaAbierta = (s: { ventaAbierta?: boolean }) =>
        s.ventaAbierta !== false;
    const salidaSinReintegro = (s: { fechaLimiteReintegro?: string | null }) =>
        Boolean(s.fechaLimiteReintegro && hoyIsoLocal > s.fechaLimiteReintegro);
    const salidaComprable = (s: {
        stockLocal: number;
        precioPersona?: number | null;
        ventaAbierta?: boolean;
    }) => esVentaAbierta(s) && s.stockLocal > 0 && s.precioPersona != null;

    const paquetesFiltrados = paquetes.filter((p) => {
        if (
            filtroDificultad !== "TODAS" &&
            p.circuito.dificultad.toUpperCase() !== filtroDificultad
        ) {
            return false;
        }
        if (filtroDuracion === "HASTA_3" && p.circuito.dias > 3) {
            return false;
        }
        if (
            filtroDuracion === "4_A_5" &&
            (p.circuito.dias < 4 || p.circuito.dias > 5)
        ) {
            return false;
        }
        if (filtroDuracion === "6_O_MAS" && p.circuito.dias < 6) {
            return false;
        }
        if (fechaDesde || fechaHasta) {
            if (!(p.salidasDisponibles ?? []).some(salidaEnRango)) return false;
        }
        if (
            soloConSalidas &&
            !(p.salidasDisponibles ?? []).some(salidaComprable)
        ) {
            return false;
        }
        if (!termino) return true;
        return (
            p.nombre.toLowerCase().includes(termino) ||
            p.codigo.toLowerCase().includes(termino) ||
            p.circuito.nombre.toLowerCase().includes(termino) ||
            p.circuito.recorrido.toLowerCase().includes(termino) ||
            p.nochesAlojamiento.garantia.toLowerCase().includes(termino)
        );
    });

    const estadoCarga = isPending ? "cargando" : isError ? "error" : "exito";
    const totalSalidasAbiertas = paquetes.reduce(
        (acc, p) => acc + (p.salidasDisponibles ?? []).filter(salidaComprable).length,
        0,
    );
    const paquetePreseleccionadoNoActivo =
        idPaquetePreseleccionado > 0 &&
        estadoCarga === "exito" &&
        !paquetes.some((p) => p.id === idPaquetePreseleccionado);

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            {paquetePreseleccionadoNoActivo ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Paquete no publicado en el escaparate"
                >
                    El paquete que intentaste previsualizar desde Gestión no
                    figura en la tienda pública porque su estado actual es{" "}
                    <strong>BORRADOR</strong> o <strong>INACTIVO</strong>. Solo
                    los paquetes en estado <strong>ACTIVO</strong> son visibles
                    para los clientes.
                </Alerta>
            ) : null}

            {/* ENCABEZADO: HERO EDITORIAL EN ESCAPARATE / HEADER ENFOCADO EN COMPRA */}
            {!paqueteEnCompra && !reservaConfirmada ? (
                <header className="relative overflow-hidden rounded-3xl bg-navegacion text-white shadow-[0_20px_50px_-18px_rgba(18,61,112,0.45)]">
                    <img
                        src={portadaMachuPicchu}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 size-full object-cover object-center opacity-55"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-r from-[#081c36]/95 via-[#0d2d54]/80 to-[#081c36]/40"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#081c36]/80 via-transparent to-transparent"
                    />

                    <div className="relative z-10 px-6 pb-14 pt-8 sm:px-10 sm:pb-16 sm:pt-10">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-marca/25 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100 backdrop-blur-md">
                                <span className="size-1.5 rounded-full bg-[#16d6dc]" aria-hidden="true" />
                                Expediciones guiadas · Cusco y Machu Picchu
                            </span>
                            {esVistaPreviaAdmin ? (
                                <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur-md">
                                    Vista previa de lo que ve el cliente
                                </span>
                            ) : null}
                        </div>

                        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[42px]">
                            Descubrí el Camino Inca con salidas confirmadas.
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-[15px]">
                            Compará recorridos día por día, elegí tu fecha con cupos en tiempo real y reservá online con guías habilitados, alojamiento y equipamiento incluidos.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white/95 backdrop-blur-md">
                                <strong className="font-bold text-cyan-200">{paquetes.length}</strong>{" "}
                                {paquetes.length === 1 ? "expedición activa" : "expediciones activas"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white/95 backdrop-blur-md">
                                <strong className="font-bold text-emerald-300">{totalSalidasAbiertas}</strong>{" "}
                                {totalSalidasAbiertas === 1 ? "salida abierta" : "salidas abiertas"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white/90 backdrop-blur-md">
                                Precio final sin cargos ocultos de equipaje
                            </span>
                        </div>
                    </div>
                </header>
            ) : (
                <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-borde bg-white p-6 shadow-tarjeta">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-marca-activa px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-marca-oscura">
                                {esAdmin ? "Compra de Paquete" : "Reserva de Paquete"}
                            </span>
                            {esVistaPreviaAdmin ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                                    Vista previa de lo que ve el cliente
                                </span>
                            ) : null}
                        </div>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navegacion sm:text-3xl">
                            {reservaConfirmada
                                ? "¡Reserva confirmada exitosamente!"
                                : `Reservar: ${paqueteEnCompra?.nombre}`}
                        </h1>
                        <p className="mt-1 text-sm text-texto-suave">
                            {reservaConfirmada
                                ? "Tu pago fue aprobado y los cupos quedaron reservados a tu nombre."
                                : "Seleccioná tu fecha de salida, completá los datos de los pasajeros y aboná con tarjeta para confirmar tu lugar al instante."}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Boton
                            variante="secundario"
                            onClick={volverAlEscaparate}
                        >
                            ← Volver al catálogo
                        </Boton>
                    </div>
                </header>
            )}

            {/* VISTA A: COMPROBANTE DE RESERVA CONFIRMADA (CU-30 EXITOSO) */}
            {reservaConfirmada ? (
                <div className="space-y-6 rounded-tarjeta border border-exito/30 bg-white p-6 shadow-tarjeta">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borde pb-5">
                        <div className="flex items-center gap-3">
                            <span className="grid size-12 place-items-center rounded-full bg-green-50 text-2xl font-bold text-exito">
                                ✓
                            </span>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-exito">
                                    {esAdmin
                                        ? "Comprobante oficial de pago y resumen de reserva"
                                        : "Comprobante oficial de pago y reserva"}
                                </p>
                                <h2 className="text-2xl font-bold text-navegacion">
                                    Reserva #{reservaConfirmada.resultado.nroReserva}
                                </h2>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-exito">
                                Estado: {reservaConfirmada.resultado.estado}
                            </span>
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    reservaConfirmada.resultado
                                        .estadoAlojamiento === "CONFIRMADO"
                                        ? "bg-green-50 text-exito"
                                        : "bg-amber-50 text-advertencia"
                                }`}
                            >
                                Alojamiento:{" "}
                                {reservaConfirmada.resultado.estadoAlojamiento}
                            </span>
                        </div>
                    </div>

                    {(() => {
                        const fechasAlojConfirmadas = derivarFechasAlojamiento(
                            reservaConfirmada.salida.fechaInicio,
                            reservaConfirmada.salida.fechaFin,
                            reservaConfirmada.paquete.nochesAlojamiento.previas,
                            reservaConfirmada.paquete.nochesAlojamiento
                                .posteriores,
                        );
                        return (
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="rounded-control border border-borde bg-fondo/50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                        Paquete y Alojamiento
                                    </p>
                                    <p className="mt-1 text-base font-bold text-navegacion">
                                        {reservaConfirmada.paquete.nombre} (
                                        {reservaConfirmada.paquete.codigo})
                                    </p>
                                    <p className="mt-1 text-xs text-texto-suave">
                                        {
                                            reservaConfirmada.paquete.circuito
                                                .nombre
                                        }{" "}
                                        ·{" "}
                                        {reservaConfirmada.paquete.circuito.dias}{" "}
                                        días · Dificultad{" "}
                                        {
                                            reservaConfirmada.paquete.circuito
                                                .dificultad
                                        }
                                    </p>
                                    <p className="mt-2 text-xs text-texto">
                                        <strong>Garantía hotelera:</strong>{" "}
                                        {reservaConfirmada.salida.garantia ??
                                            reservaConfirmada.paquete
                                                .nochesAlojamiento.garantia}
                                    </p>
                                    {reservaConfirmada.resultado.hotel ? (
                                        <p className="mt-1 text-xs text-texto">
                                            <strong>Hotel asignado:</strong>{" "}
                                            {reservaConfirmada.resultado.hotel.nombreServicio}
                                        </p>
                                    ) : null}
                                    {fechasAlojConfirmadas.estadiaPrevia ? (
                                        <p className="mt-1 text-xs text-texto">
                                            <strong>Alojamiento previo:</strong>{" "}
                                            {fechasAlojConfirmadas.estadiaPrevia}
                                        </p>
                                    ) : null}
                                    {fechasAlojConfirmadas.estadiaPosterior ? (
                                        <p className="mt-0.5 text-xs text-texto">
                                            <strong>
                                                Alojamiento posterior:
                                            </strong>{" "}
                                            {
                                                fechasAlojConfirmadas.estadiaPosterior
                                            }
                                        </p>
                                    ) : null}
                                </div>

                                <div className="rounded-control border border-borde bg-fondo/50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                        Salida Programada
                                    </p>
                                    <p className="mt-1 text-base font-bold text-navegacion">
                                        {formatearFechaUtcCorta(reservaConfirmada.salida.fechaInicio)} al{" "}
                                        {formatearFechaUtcCorta(reservaConfirmada.salida.fechaFin)}
                                    </p>
                                    <p className="mt-2 text-xs text-texto-suave">
                                        Temporada aplicada:{" "}
                                        <strong>
                                            {
                                                reservaConfirmada.salida
                                                    .temporadaNombre
                                            }
                                        </strong>
                                    </p>
                                </div>

                                <div className="rounded-control border border-borde bg-fondo/50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                                        Transacción y Total Congelado
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-navegacion">
                                        {formatearMonto(reservaConfirmada.resultado.precioCongelado, reservaConfirmada.resultado.moneda)}
                                    </p>
                                    <p className="mt-1 text-xs text-texto-suave">
                                        Transacción pasarela:{" "}
                                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-texto">
                                            {
                                                reservaConfirmada.resultado
                                                    .transaccionPasarela
                                            }
                                        </code>
                                    </p>
                                    <p className="mt-1 text-xs text-texto-suave">
                                        Pasajeros confirmados:{" "}
                                        <strong>
                                            {
                                                reservaConfirmada.resultado
                                                    .cantidadPasajeros
                                            }
                                        </strong>
                                    </p>
                                    {reservaConfirmada.paquete.condiciones ? (
                                        <p className="mt-2 border-t border-borde pt-1.5 text-xs text-texto-suave">
                                            <strong>
                                                Condiciones congeladas:
                                            </strong>{" "}
                                            {
                                                reservaConfirmada.paquete
                                                    .condiciones
                                            }
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })()}

                    {reservaConfirmada.resultado.estadoAlojamiento ===
                    "PENDIENTE" ? (
                        <Alerta
                            tipo="informacion"
                            titulo={
                                esAdmin
                                    ? "Alojamiento sujeto a confirmación del proveedor"
                                    : "Alojamiento sujeto a confirmación hotelera"
                            }
                        >
                            {esAdmin ? (
                                <>
                                    Las noches de alojamiento de tu reserva quedan
                                    sujetas a la confirmación del proveedor hotelero,
                                    que se obtendrá antes de la fecha de salida. El
                                    sistema generó automáticamente la solicitud
                                    pendiente (
                                    <code>
                                        SOL-{reservaConfirmada.resultado.nroReserva}
                                    </code>
                                    ) con la localidad, categoría y tipo de habitación
                                    garantizados para su gestión.
                                </>
                            ) : (
                                <>
                                    Las noches de alojamiento incluidas en tu reserva quedan
                                    sujetas a la confirmación del establecimiento hotelero,
                                    la cual será gestionada por nuestro equipo antes de la fecha
                                    de tu salida. Te mantendremos informado por correo electrónico.
                                </>
                            )}
                        </Alerta>
                    ) : null}

                    <div>
                        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navegacion">
                            Nómina de pasajeros registrados
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {reservaConfirmada.pasajeros.map((p, idx) => (
                                <div
                                    key={`${p.nroPasaporte}-${idx}`}
                                    className="flex items-center justify-between rounded-control border border-borde bg-fondo/30 px-4 py-3 text-sm"
                                >
                                    <div>
                                        <p className="font-bold text-texto">
                                            {idx + 1}. {p.nombreCompleto}
                                        </p>
                                        <p className="text-xs text-texto-suave">
                                            Pasaporte: {p.nroPasaporte} ·{" "}
                                            {p.nacionalidad} · Vence:{" "}
                                            {p.fechaVencimientoPasaporte}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {errorComprobante ? <Alerta tipo="error">{errorComprobante}</Alerta> : null}

                    <div className="flex flex-wrap justify-end gap-3 border-t border-borde pt-4">
                        <Boton
                            variante="secundario"
                            onClick={descargarComprobanteReserva}
                            cargando={descargandoComprobante}
                        >
                            ⬇ Descargar comprobante (PDF)
                        </Boton>
                        {esAdmin &&
                        reservaConfirmada.resultado.estadoAlojamiento ===
                            "PENDIENTE" ? (
                            <Boton
                                variante="secundario"
                                onClick={() => navegar("/gestion/solicitudes")}
                            >
                                Ver solicitud generada en Gestión
                            </Boton>
                        ) : null}
                        <Boton onClick={volverAlEscaparate}>
                            Explorar más paquetes turísticos
                        </Boton>
                    </div>
                </div>
            ) : null}

            {/* VISTA B: CHECKOUT / COMPRA DE PAQUETE (CU-30) */}
            {!reservaConfirmada && paqueteEnCompra ? (
                <form
                    onSubmit={(evento) => {
                        setErrorCompra("");
                        void handleSubmit(confirmarCompra)(evento);
                    }}
                    onChange={() => setErrorCompra("")}
                    noValidate
                    className="grid items-start gap-6 max-md:pb-24 lg:grid-cols-[1.65fr_1fr]"
                >
                    <div className="space-y-6">
                        {/* PASO 1: SELECCIONAR SALIDA PROGRAMADA */}
                        <div className="space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                                    1
                                </span>
                                <div>
                                    <h2 className="text-base font-bold uppercase tracking-wide text-navegacion">
                                        Seleccioná la fecha de salida
                                    </h2>
                                    <p className="text-xs text-texto-suave">
                                        Elegí la fecha en que querés viajar.
                                    </p>
                                </div>
                            </div>

                            {salidasDelPaquete.length === 0 ? (
                                <Alerta titulo="Este paquete todavía no tiene fechas disponibles">
                                    Mirá otros paquetes del catálogo.
                                    <div className="mt-3">
                                        <Boton type="button" variante="secundario" onClick={volverAlEscaparate}>
                                            Volver al catálogo
                                        </Boton>
                                    </div>
                                </Alerta>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {salidasDelPaquete.map((salida) => {
                                        const seleccionada =
                                            salidaActiva?.idsalida ===
                                            salida.idsalida;
                                        const sinTarifaSalida = salida.precioPersona == null;
                                        const ventaCerrada = !esVentaAbierta(salida);
                                        const sinCupo =
                                            ventaCerrada ||
                                            salida.stockLocal <= 0 ||
                                            sinTarifaSalida;
                                        return (
                                            <button
                                                key={salida.idsalida}
                                                type="button"
                                                disabled={sinCupo}
                                                onClick={() => {
                                                    setErrorCompra("");
                                                    setIdSalidaSeleccionada(
                                                        salida.idsalida,
                                                    );
                                                }}
                                                className={`flex flex-col justify-between rounded-control border p-4 text-left transition ${
                                                    sinCupo
                                                        ? "cursor-not-allowed border-borde bg-fondo opacity-60"
                                                        : seleccionada
                                                          ? "border-marca bg-marca-activa/40 ring-2 ring-marca/25"
                                                          : "border-borde bg-white hover:border-marca/60 hover:bg-fondo/50"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                            ventaCerrada
                                                                ? "bg-slate-200 text-slate-700"
                                                                : salida.stockLocal > 3
                                                                  ? "bg-green-50 text-exito"
                                                                  : salida.stockLocal > 0
                                                                    ? "bg-amber-50 text-advertencia"
                                                                    : "bg-red-50 text-peligro"
                                                        }`}
                                                    >
                                                        {ventaCerrada
                                                            ? "Venta cerrada"
                                                            : salida.stockLocal > 0
                                                              ? `${salida.stockLocal} de ${salida.tamanoMaximo} lugares libres`
                                                              : "Agotada"}
                                                    </span>
                                                </div>

                                                <div className="mt-3">
                                                    <p className="text-sm font-bold text-navegacion">
                                                        Salida:{" "}
                                                        {formatearFechaUtcCorta(
                                                            salida.fechaInicio,
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-texto-suave">
                                                        Regreso:{" "}
                                                        {formatearFechaUtcCorta(
                                                            salida.fechaFin,
                                                        )}{" "}
                                                        ·{" "}
                                                        {salida.temporadaNombre ??
                                                            "Sin temporada"}
                                                    </p>
                                                    {salidaSinReintegro(salida) ? (
                                                        <p className="mt-1 text-xs font-semibold text-amber-800">
                                                            Esta fecha ya no tiene reintegro si cancelás
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-2.5">
                                                    <span className="text-xs text-texto-suave">
                                                        Tarifa por pasajero
                                                    </span>
                                                    <span className="text-base font-bold text-navegacion">
                                                        {sinTarifaSalida
                                                            ? "Sin tarifa para esta fecha"
                                                            : formatearMonto(salida.precioPersona, salida.moneda)}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Sin salidas no hay nada que cargar: se ocultan los pasos 2 y 3 */}
                        {salidasDelPaquete.length > 0 ? (<>
                        {/* PASO 2: NÓMINA DE PASAJEROS Y EQUIPAJE */}
                        <div className="space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                                        2
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold uppercase tracking-wide text-navegacion">
                                            Pasajeros ({pasajeros.length})
                                        </h2>
                                        <p className="text-xs text-texto-suave">
                                            Cada pasaporte debe ser único y
                                            vencer después del{" "}
                                            {salidaActiva
                                                ? formatearFechaUtcCorta(
                                                      salidaActiva.fechaFin,
                                                  )
                                                : "fin del recorrido"}
                                            .
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {import.meta.env.DEV ? (
                                        <Boton
                                            type="button"
                                            variante="secundario"
                                            className="px-3 py-1.5 text-xs"
                                            disabled={pasajeros.length >= cupoMaximo}
                                            onClick={() => agregarPasajero(true)}
                                        >
                                            + Agregar pasajero de prueba
                                        </Boton>
                                    ) : null}
                                    <Boton
                                        type="button"
                                        variante="fantasma"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={pasajeros.length >= cupoMaximo}
                                        onClick={() => agregarPasajero(false)}
                                    >
                                        + Agregar pasajero vacío
                                    </Boton>
                                </div>
                            </div>

                            {errorNomina ? (
                                <p role="alert" className="text-xs text-peligro">
                                    {errorNomina}
                                </p>
                            ) : null}

                            <div className="space-y-4">
                                {camposPasajeros.map((campo, idx) => {
                                    const errorPasajero = errors.pasajeros?.[idx];

                                    return (
                                        <div
                                            key={campo.id}
                                            className="space-y-3 rounded-control border border-borde bg-fondo/40 p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                                    Pasajero #{idx + 1}
                                                </span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    {import.meta.env.DEV ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                autocompletarPasajeroExistente(
                                                                    idx,
                                                                )
                                                            }
                                                            className="font-semibold text-marca-oscura hover:underline"
                                                        >
                                                            Autocompletar datos
                                                        </button>
                                                    ) : null}
                                                    {pasajeros.length > 1 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                quitarPasajero(
                                                                    idx,
                                                                )
                                                            }
                                                            className="font-semibold text-peligro hover:underline"
                                                        >
                                                            Quitar pasajero
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <CampoCompra
                                                    etiqueta="Nombre y apellido completo *"
                                                    id={`pasajero-${idx}-nombre`}
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder="Ej. Juan Ignacio Pérez"
                                                    error={errorPasajero?.nombreCompleto?.message}
                                                    {...register(`pasajeros.${idx}.nombreCompleto`)}
                                                />
                                                <CampoCompra
                                                    etiqueta="Número de pasaporte *"
                                                    id={`pasajero-${idx}-pasaporte`}
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder="Ej. ARG-40129845"
                                                    error={errorPasajero?.nroPasaporte?.message}
                                                    {...register(`pasajeros.${idx}.nroPasaporte`)}
                                                />
                                                <CampoCompra
                                                    etiqueta="Nacionalidad *"
                                                    id={`pasajero-${idx}-nacionalidad`}
                                                    type="text"
                                                    placeholder="Ej. Argentina"
                                                    error={errorPasajero?.nacionalidad?.message}
                                                    {...register(`pasajeros.${idx}.nacionalidad`)}
                                                />
                                                <CampoCompra
                                                    etiqueta="Vencimiento pasaporte *"
                                                    id={`pasajero-${idx}-vencimiento`}
                                                    type="date"
                                                    error={errorPasajero?.fechaVencimientoPasaporte?.message}
                                                    {...register(`pasajeros.${idx}.fechaVencimientoPasaporte`)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* PASO 3: DATOS DE PAGO Y SIMULADOR DE PASARELA */}
                        <div className="space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
                                    3
                                </span>
                                <div>
                                    <h2 className="text-base font-bold uppercase tracking-wide text-navegacion">
                                        Pago con tarjeta (Pasarela de Pagos)
                                    </h2>
                                    <p className="text-xs text-texto-suave">
                                        Los datos de tarjeta solo viajan hasta
                                        la pasarela y nunca se persisten. Si el
                                        pago es rechazado, los cupos se liberan
                                        automáticamente.
                                    </p>
                                </div>
                            </div>

                            {/* ATAJOS DE TARJETAS DE PRUEBA DEL CONTRATO (solo DEV) */}
                            {import.meta.env.DEV ? (
                            <div className="space-y-2 rounded-control border border-borde bg-fondo/50 p-3.5">
                                <p className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                    Tarjetas de prueba en 1 clic (según Contrato
                                    API):
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {TARJETAS_PRUEBA.map((t) => (
                                        <button
                                            key={t.etiqueta}
                                            type="button"
                                            onClick={() =>
                                                aplicarTarjetaPrueba(t)
                                            }
                                            className={`rounded-control border p-2.5 text-left text-xs transition ${
                                                tarjetaCargada.numero === t.numero &&
                                                tarjetaCargada.cvv === t.cvv
                                                    ? "border-marca bg-white ring-2 ring-marca/25"
                                                    : "border-borde bg-white/80 hover:bg-white"
                                            }`}
                                        >
                                            <p
                                                className={`font-bold ${
                                                    t.tono === "exito"
                                                        ? "text-exito"
                                                        : "text-peligro"
                                                }`}
                                            >
                                                {t.etiqueta}
                                            </p>
                                            <p className="mt-0.5 text-xs text-texto-suave">
                                                {t.descripcion}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            ) : null}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <CampoCompra
                                    etiqueta="Número de tarjeta *"
                                    id="tarjeta-numero"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="cc-number"
                                    placeholder="4532 8910 2234 8899"
                                    className="font-mono"
                                    error={errors.tarjeta?.numero?.message}
                                    {...register("tarjeta.numero")}
                                />
                                <CampoCompra
                                    etiqueta="Titular de la tarjeta *"
                                    id="tarjeta-titular"
                                    type="text"
                                    autoComplete="cc-name"
                                    placeholder="JUAN I PEREZ"
                                    className="uppercase"
                                    error={errors.tarjeta?.titular?.message}
                                    {...register("tarjeta.titular")}
                                />
                                <CampoCompra
                                    etiqueta="Vencimiento (MM/AA) *"
                                    id="tarjeta-vencimiento"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="cc-exp"
                                    placeholder="11/29"
                                    maxLength={5}
                                    className="font-mono"
                                    error={errors.tarjeta?.vencimiento?.message}
                                    {...register("tarjeta.vencimiento")}
                                />
                                <CampoCompra
                                    etiqueta="Código de seguridad (CVV) *"
                                    id="tarjeta-cvv"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="cc-csc"
                                    placeholder="482"
                                    maxLength={4}
                                    className="font-mono"
                                    error={errors.tarjeta?.cvv?.message}
                                    {...register("tarjeta.cvv")}
                                />
                            </div>
                        </div>
                        </>) : null}
                    </div>

                    {/* COLUMNA LATERAL: RESUMEN DE COMPRA EN TIEMPO REAL */}
                    <aside className="sticky top-6 space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                        <div className="overflow-hidden rounded-control border border-borde">
                            <img
                                src={resolverUrlImagenPaquete(
                                    obtenerImagenesPaqueteCatalogo(
                                        paqueteEnCompra,
                                    )[0],
                                )}
                                alt={paqueteEnCompra.nombre}
                                className="h-44 w-full object-cover"
                            />
                        </div>

                        <div>
                            <span className="rounded bg-marca-activa px-2 py-0.5 text-xs font-bold text-marca-oscura">
                                {paqueteEnCompra.codigo}
                            </span>
                            <h3 className="mt-1.5 text-lg font-bold text-navegacion">
                                {paqueteEnCompra.nombre}
                            </h3>
                            <p className="text-xs text-texto-suave">
                                {paqueteEnCompra.circuito.nombre} ·{" "}
                                {paqueteEnCompra.circuito.dias} días de
                                trekking +{" "}
                                {(paqueteVendido ?? paqueteEnCompra).nochesAlojamiento.previas +
                                    (paqueteVendido ?? paqueteEnCompra).nochesAlojamiento
                                        .posteriores}{" "}
                                noches de hotel
                            </p>
                        </div>

                        <div className="space-y-2 border-t border-borde pt-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-texto-suave">
                                    Salida seleccionada:
                                </span>
                                <span className="font-semibold text-texto">
                                    {salidaActiva
                                        ? formatearFechaUtcCorta(salidaActiva.fechaInicio)
                                        : "Sin salida"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-texto-suave">
                                    Garantía alojamiento:
                                </span>
                                <span className="text-right font-semibold text-texto">
                                    {salidaActiva?.garantia ??
                                        (paqueteVendido ?? paqueteEnCompra).nochesAlojamiento.garantia}
                                </span>
                            </div>
                            {salidaActiva
                                ? (() => {
                                      const fechas = derivarFechasAlojamiento(
                                          salidaActiva.fechaInicio,
                                          salidaActiva.fechaFin,
                                          (paqueteVendido ?? paqueteEnCompra).nochesAlojamiento
                                              .previas,
                                          (paqueteVendido ?? paqueteEnCompra).nochesAlojamiento
                                              .posteriores,
                                      );
                                      return (
                                          <>
                                              <div className="flex justify-between gap-2">
                                                  <span className="text-texto-suave">
                                                      Alojamiento previo:
                                                  </span>
                                                  <span className="text-right font-semibold text-texto">
                                                      {fechas.estadiaPrevia ??
                                                          "No incluido"}
                                                  </span>
                                              </div>
                                              <div className="flex justify-between gap-2">
                                                  <span className="text-texto-suave">
                                                      Alojamiento posterior:
                                                  </span>
                                                  <span className="text-right font-semibold text-texto">
                                                      {fechas.estadiaPosterior ??
                                                          "No incluido"}
                                                  </span>
                                              </div>
                                              <p className="text-xs text-texto-suave">
                                                  Las noches de alojamiento las
                                                  define el paquete y no se
                                                  pueden modificar durante la
                                                  compra.
                                              </p>
                                          </>
                                      );
                                  })()
                                : null}
                            {(paqueteVendido ?? paqueteEnCompra).condiciones ? (
                                <p className="rounded-control border border-borde bg-fondo/50 p-2 text-xs text-texto">
                                    <strong>Condiciones comerciales:</strong>{" "}
                                    {(paqueteVendido ?? paqueteEnCompra).condiciones}
                                    <span className="block text-texto-suave">
                                        Quedan congeladas en tu reserva al
                                        confirmar el pago.
                                    </span>
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-2 border-t border-borde pt-3 text-sm">
                            <div className="flex justify-between text-xs">
                                <span className="text-texto-suave">
                                    Tarifa base ({pasajeros.length}{" "}
                                    {pasajeros.length === 1
                                        ? "pasajero"
                                        : "pasajeros"}{" "}
                                    × {sinTarifa ? "sin tarifa" : formatearMonto(precioUnitario, monedaActiva)})
                                </span>
                                <span className="font-semibold text-texto">
                                    {sinTarifa
                                        ? "—"
                                        : formatearMonto(subtotalPasajeros, monedaActiva)}
                                </span>
                            </div>

                            <div className="flex items-baseline justify-between border-t border-borde pt-3">
                                <span className="text-sm font-bold text-navegacion">
                                    Total a abonar
                                </span>
                                <span className="text-2xl font-bold text-navegacion">
                                    {sinTarifa
                                        ? "—"
                                        : formatearMonto(totalPagar, monedaActiva)}
                                </span>
                            </div>
                        </div>

                        {!esSesionCliente ? (
                            <div className="space-y-2 rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                                <p className="font-semibold">
                                    Sesión de cliente requerida para abonar
                                </p>
                                <p>
                                    Ingresá con tu cuenta de cliente para emitir la reserva.
                                </p>
                                <Boton
                                    type="button"
                                    variante="secundario"
                                    className="w-full"
                                    onClick={() =>
                                        navegar("/login", {
                                            state: { desde: "/catalogo" },
                                        })
                                    }
                                >
                                    Iniciar sesión como cliente →
                                </Boton>
                            </div>
                        ) : null}

                        {/* Un solo aviso, junto al botón de pago */}
                        {errorCompra ? (
                            <div
                                ref={errorBannerRef}
                                role="alert"
                                className="rounded-control border border-peligro/40 bg-red-50 p-3 text-xs text-peligro shadow-sm"
                            >
                                <p className="font-bold flex items-center gap-1.5">
                                    <span>⚠️</span> No se pudo completar la compra
                                </p>
                                <p className="mt-1 font-medium leading-relaxed text-peligro/95">
                                    {errorCompra}
                                </p>
                            </div>
                        ) : null}

                        {salidaActiva && salidaSinReintegro(salidaActiva) ? (
                            <Alerta tipo="advertencia" titulo="Sin reintegro por cancelación">
                                Esta fecha ya no tiene reintegro si cancelás.
                            </Alerta>
                        ) : null}

                        <Boton
                            type="submit"
                            className="w-full py-3"
                            cargando={mutacionReserva.isPending}
                            disabled={
                                !salidaActiva ||
                                !esVentaAbierta(salidaActiva) ||
                                salidaActiva.stockLocal <= 0 ||
                                sinTarifa
                            }
                        >
                            {mutacionReserva.isPending
                                ? "Procesando pago y cupos..."
                                : !salidaActiva
                                  ? "Elegí una salida"
                                  : !esVentaAbierta(salidaActiva)
                                    ? "Venta cerrada"
                                    : sinTarifa
                                      ? "Salida sin tarifa vigente"
                                      : `Confirmar y pagar ${formatearMonto(totalPagar, monedaActiva)}`}
                        </Boton>
                        {salidaActiva && sinTarifa ? (
                            <p className="text-center text-xs text-peligro">
                                Esta salida no tiene una tarifa vigente para su
                                fecha. Elegí otra salida para continuar.
                            </p>
                        ) : null}
                    </aside>

                    {/* En celular el total y el pago quedan siempre a la vista */}
                    {salidasDelPaquete.length > 0 ? (
                        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-borde bg-white px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.1)] md:hidden">
                            <div className="min-w-0">
                                <p className="text-xs text-texto-suave">Total</p>
                                <p className="truncate text-lg font-bold text-navegacion">
                                    {sinTarifa ? "—" : formatearMonto(totalPagar, monedaActiva)}
                                </p>
                            </div>
                            <Boton
                                type="submit"
                                className="min-h-11 shrink-0 px-6"
                                cargando={mutacionReserva.isPending}
                                disabled={!salidaActiva || salidaActiva.stockLocal <= 0 || sinTarifa}
                            >
                                Pagar
                            </Boton>
                        </div>
                    ) : null}
                </form>
            ) : null}

            {/* VISTA C: ESCAPARATE DEL CATÁLOGO PÚBLICO (CU-26) */}
            {!reservaConfirmada && !paqueteEnCompra ? (
                <>
                    {/* DOCK FLOTANTE DE BÚSQUEDA Y FILTROS */}
                    <div className="relative z-10 -mt-12 mx-2 rounded-2xl border border-borde/80 bg-white/95 p-4 shadow-[0_18px_40px_-14px_rgba(18,61,112,0.16)] backdrop-blur-xl sm:mx-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* BUSCADOR */}
                            <div className="relative min-w-0 basis-64 flex-1">
                                <label
                                    htmlFor="buscar-catalogo"
                                    className="sr-only"
                                >
                                    Buscar en el catálogo de paquetes
                                </label>
                                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-texto-suave">
                                    <IconoBuscar />
                                </span>
                                <input
                                    id="buscar-catalogo"
                                    type="search"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar por destino, circuito, paquete o código…"
                                    className="w-full rounded-xl border border-borde bg-fondo/50 py-2.5 pl-10 pr-3.5 text-sm text-navegacion outline-none placeholder:text-texto-suave/70 transition focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15"
                                />
                            </div>

                            <button
                                type="button"
                                aria-expanded={filtrosAbiertos}
                                onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 py-2.5 text-xs font-semibold text-navegacion transition hover:bg-fondo md:hidden"
                            >
                                <IconoFiltros />
                                <span>Filtros</span>
                                {hayFiltrosActivos ? (
                                    <span className="size-1.5 rounded-full bg-marca" />
                                ) : null}
                            </button>

                            {/* PÍLDORA SEGMENTADA DE DIFICULTAD */}
                            <div
                                className={`flex flex-wrap items-center gap-2.5 ${filtrosAbiertos ? "" : "max-md:hidden"}`}
                            >
                                <div
                                    role="group"
                                    aria-label="Filtrar por dificultad"
                                    className="inline-flex items-center gap-0.5 rounded-full bg-fondo p-1 ring-1 ring-borde/80 text-xs"
                                >
                                    {(["TODAS", "BAJA", "MEDIA", "ALTA"] as const).map(
                                        (dif) => (
                                            <button
                                                key={dif}
                                                type="button"
                                                onClick={() => setFiltroDificultad(dif)}
                                                className={`cursor-pointer rounded-full px-3 py-1 font-semibold transition ${
                                                    filtroDificultad === dif
                                                        ? "bg-white text-navegacion shadow-2xs ring-1 ring-navegacion/[0.06]"
                                                        : "text-texto-suave hover:text-navegacion"
                                                }`}
                                            >
                                                {dif === "TODAS"
                                                    ? "Todas"
                                                    : dif.charAt(0) +
                                                      dif.slice(1).toLowerCase()}
                                            </button>
                                        ),
                                    )}
                                </div>

                                <label
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                                        soloConSalidas
                                            ? "border-marca/40 bg-marca-suave text-navegacion"
                                            : "border-borde bg-white text-texto hover:bg-fondo"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={soloConSalidas}
                                        onChange={(e) =>
                                            setSoloConSalidas(e.target.checked)
                                        }
                                        className="size-3.5 accent-marca"
                                    />
                                    Solo salidas abiertas
                                </label>
                            </div>
                        </div>

                        {/* FILA SECUNDARIA: DURACIÓN Y FECHAS */}
                        <div
                            className={`mt-3.5 flex flex-wrap items-end justify-between gap-3 border-t border-borde/70 pt-3.5 text-xs ${filtrosAbiertos ? "" : "max-md:hidden"}`}
                        >
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="grid gap-1 font-semibold text-texto-suave">
                                    Duración del circuito
                                    <select
                                        value={filtroDuracion}
                                        onChange={(e) =>
                                            setFiltroDuracion(e.target.value)
                                        }
                                        className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs font-medium text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                                    >
                                        <option value="TODAS">Cualquier duración</option>
                                        <option value="HASTA_3">Hasta 3 días</option>
                                        <option value="4_A_5">4 a 5 días</option>
                                        <option value="6_O_MAS">6 días o más</option>
                                    </select>
                                </label>
                                <label className="grid gap-1 font-semibold text-texto-suave">
                                    Salidas desde
                                    <input
                                        type="date"
                                        value={fechaDesde}
                                        max={fechaHasta || undefined}
                                        onChange={(e) =>
                                            setFechaDesde(e.target.value)
                                        }
                                        className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs font-medium text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                                    />
                                </label>
                                <label className="grid gap-1 font-semibold text-texto-suave">
                                    Salidas hasta
                                    <input
                                        type="date"
                                        value={fechaHasta}
                                        min={fechaDesde || undefined}
                                        onChange={(e) =>
                                            setFechaHasta(e.target.value)
                                        }
                                        className="rounded-xl border border-borde bg-white px-3 py-1.5 text-xs font-medium text-navegacion outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                                    />
                                </label>
                            </div>

                            {hayFiltrosActivos ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBusqueda("");
                                        setFiltroDificultad("TODAS");
                                        setFiltroDuracion("TODAS");
                                        setFechaDesde("");
                                        setFechaHasta("");
                                        setSoloConSalidas(false);
                                    }}
                                    className="cursor-pointer rounded-full bg-fondo px-3 py-1.5 text-xs font-semibold text-marca-oscura transition hover:bg-marca-suave"
                                >
                                    Limpiar filtros ✕
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* BARRA DE RESULTADOS */}
                    {estadoCarga === "exito" && paquetes.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-texto-suave">
                            <p>
                                Mostrando{" "}
                                <strong className="font-semibold text-navegacion">
                                    {paquetesFiltrados.length}
                                </strong>{" "}
                                {paquetesFiltrados.length === 1
                                    ? "paquete turístico"
                                    : "paquetes turísticos"}
                                {hayFiltrosActivos
                                    ? ` de ${paquetes.length} disponibles`
                                    : ""}
                            </p>
                        </div>
                    ) : null}

                    {estadoCarga !== "exito" ? (
                        <EstadoListado
                            estado={estadoCarga}
                            mensaje={
                                estadoCarga === "error"
                                    ? error?.message
                                    : undefined
                            }
                        />
                    ) : paquetesFiltrados.length === 0 ? (
                        <EstadoListado
                            estado="vacio"
                            mensaje="No se encontraron paquetes turísticos con los filtros seleccionados."
                        />
                    ) : (() => {
                        const paquetesDisponibles = paquetesFiltrados.filter(
                            (p) =>
                                (p.salidasDisponibles ?? [])
                                    .filter(salidaEnRango)
                                    .some(salidaComprable),
                        );
                        const paquetesProximamente = paquetesFiltrados.filter(
                            (p) =>
                                !(p.salidasDisponibles ?? [])
                                    .filter(salidaEnRango)
                                    .some(salidaComprable),
                        );

                        const renderTarjetaPaquete = (
                            paquete: PaqueteCatalogoPublico,
                            esProximamente: boolean,
                        ) => {
                            const galeria =
                                obtenerImagenesPaqueteCatalogo(paquete);
                            const urlPortada = resolverUrlImagenPaquete(
                                galeria[0],
                            );
                            const tarifaMinima = paquete.precios.reduce(
                                (min, actual) =>
                                    actual.precio < min.precio ? actual : min,
                                paquete.precios[0],
                            );
                            const salidasEnRango = (
                                paquete.salidasDisponibles ?? []
                            ).filter(salidaEnRango);
                            const salidasConCupo =
                                salidasEnRango.filter(salidaComprable);
                            const diasTotales =
                                paquete.circuito.dias +
                                paquete.nochesAlojamiento.previas +
                                paquete.nochesAlojamiento.posteriores;
                            const proximaSalida = salidasConCupo[0] ?? null;
                            const tieneSalidasCerradas =
                                esProximamente && salidasEnRango.length > 0;

                            const esPreseleccionado =
                                idPaquetePreseleccionado > 0 &&
                                paquete.id === idPaquetePreseleccionado;

                            return (
                                <article
                                    key={paquete.id}
                                    className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_6px_24px_-8px_rgba(18,61,112,0.09)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-16px_rgba(18,61,112,0.20)] ${
                                        esPreseleccionado
                                            ? "border-marca ring-2 ring-marca/40"
                                            : esProximamente
                                              ? "border-borde/75 bg-white/95"
                                              : "border-borde/80"
                                    }`}
                                >
                                    {/* FOTOGRAFÍA DE PORTADA */}
                                    <div
                                        onClick={() =>
                                            abrirDetallePaquete(paquete)
                                        }
                                        className="relative h-64 cursor-pointer overflow-hidden bg-navegacion/10"
                                    >
                                        <img
                                            src={urlPortada}
                                            alt={paquete.nombre}
                                            loading="lazy"
                                            className={`size-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${
                                                esProximamente
                                                    ? "saturate-[0.78] group-hover:saturate-100"
                                                    : ""
                                            }`}
                                        />
                                        <div
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-gradient-to-t from-[#081c36]/80 via-[#081c36]/15 to-[#081c36]/25"
                                        />

                                        {/* BADGES SUPERIORES */}
                                        <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {esProximamente ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-navegacion/90 px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow-xs backdrop-blur-md">
                                                        <span
                                                            className="size-1.5 rounded-full bg-cyan-300"
                                                            aria-hidden="true"
                                                        />
                                                        Próximamente
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-xs backdrop-blur-md ${estiloDificultad(paquete.circuito.dificultad)}`}
                                                >
                                                    Dificultad{" "}
                                                    {paquete.circuito.dificultad}
                                                </span>
                                                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-navegacion shadow-xs backdrop-blur-md">
                                                    {diasTotales} días ·{" "}
                                                    {paquete.circuito.dias} de
                                                    trekking
                                                </span>
                                                {esPreseleccionado ? (
                                                    <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-navegacion shadow-xs">
                                                        ★ Previsualizando
                                                    </span>
                                                ) : null}
                                            </div>

                                            <span className="shrink-0 rounded-full bg-black/35 px-2.5 py-1 font-mono text-[11px] font-semibold text-white/90 backdrop-blur-md">
                                                {paquete.codigo}
                                            </span>
                                        </div>

                                        {/* PIE DE PORTADA: SALE DESDE + GALERÍA */}
                                        <div className="absolute inset-x-3.5 bottom-3.5 flex items-end justify-between gap-2">
                                            {paquete.saleDesde ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                                                    <IconoPin />
                                                    Sale desde {paquete.saleDesde}
                                                </span>
                                            ) : (
                                                <span />
                                            )}

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    abrirDetallePaquete(paquete);
                                                }}
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/25"
                                            >
                                                <IconoCamara />
                                                <span>
                                                    {galeria.length}{" "}
                                                    {galeria.length === 1
                                                        ? "foto"
                                                        : "fotos"}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* CUERPO DE LA TARJETA */}
                                    <div className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
                                        <div className="space-y-4">
                                            {/* TÍTULO + PRECIO */}
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-marca-oscura">
                                                        {paquete.circuito.nombre}
                                                    </p>
                                                    <h2 className="mt-0.5 text-xl font-bold tracking-tight text-navegacion transition-colors group-hover:text-marca-oscura">
                                                        {paquete.nombre}
                                                    </h2>
                                                    <p className="mt-1 text-xs leading-relaxed text-texto-suave">
                                                        {paquete.circuito.recorrido ||
                                                            "Cusco → Camino del Inca → Machu Picchu"}
                                                    </p>
                                                </div>

                                                {tarifaMinima ? (
                                                    <div className="shrink-0 rounded-xl bg-fondo/80 px-3 py-2 text-right ring-1 ring-borde/70">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-texto-suave">
                                                            Desde
                                                        </p>
                                                        <p className="whitespace-nowrap text-xl font-bold leading-tight tracking-tight text-navegacion">
                                                            {formatearMonto(
                                                                tarifaMinima.precio,
                                                                tarifaMinima.moneda,
                                                            )}
                                                        </p>
                                                        <p className="text-[10px] text-texto-suave">
                                                            por persona
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* ALOJAMIENTO GARANTIZADO */}
                                            <div className="flex items-start gap-2.5 rounded-xl border border-borde/70 bg-fondo/50 px-3.5 py-2.5 text-xs">
                                                <span className="mt-0.5 shrink-0 text-marca-oscura">
                                                    <IconoHotel />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-navegacion">
                                                        {
                                                            paquete
                                                                .nochesAlojamiento
                                                                .garantia
                                                        }
                                                    </p>
                                                    <p className="mt-0.5 text-texto-suave">
                                                        {textoNoches(
                                                            paquete
                                                                .nochesAlojamiento
                                                                .previas,
                                                            paquete
                                                                .nochesAlojamiento
                                                                .posteriores,
                                                        )}
                                                        {paquete.diasDisponibles
                                                            ? ` · Salidas: ${formatearDiasLegibles(paquete.diasDisponibles)}`
                                                            : ""}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* INCLUYE */}
                                            {paquete.serviciosAdicionales.length >
                                            0 ? (
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                                                        Incluye
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {paquete.serviciosAdicionales.map(
                                                            (serv) => (
                                                                <span
                                                                    key={serv}
                                                                    className="inline-flex items-center gap-1 rounded-lg border border-borde/70 bg-white px-2.5 py-1 text-[11.5px] font-medium text-texto"
                                                                >
                                                                    <span className="shrink-0 text-exito">
                                                                        <IconoCheck />
                                                                    </span>
                                                                    <span>
                                                                        {serv}
                                                                    </span>
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* PIE DE TARJETA: DISPONIBILIDAD + ACCIONES */}
                                        <div className="space-y-3 border-t border-borde/70 pt-4">
                                            {!esProximamente && proximaSalida ? (
                                                <>
                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                        <span className="inline-flex items-center gap-1.5 font-semibold text-exito">
                                                            <span
                                                                className="size-2 rounded-full bg-exito"
                                                                aria-hidden="true"
                                                            />
                                                            {salidasConCupo.length}{" "}
                                                            {salidasConCupo.length ===
                                                            1
                                                                ? "salida abierta"
                                                                : "salidas abiertas"}
                                                        </span>
                                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
                                                            Próxima:{" "}
                                                            {formatearFechaUtcCorta(
                                                                proximaSalida.fechaInicio,
                                                            )}{" "}
                                                            ·{" "}
                                                            {
                                                                proximaSalida.stockLocal
                                                            }{" "}
                                                            cupos
                                                        </span>
                                                    </div>

                                                    {salidaSinReintegro(
                                                        proximaSalida,
                                                    ) ? (
                                                        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-900 ring-1 ring-inset ring-amber-500/20">
                                                            Aviso: la próxima fecha ya no tiene reintegro por cancelación.
                                                        </p>
                                                    ) : null}

                                                    <div className="flex items-center gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirDetallePaquete(
                                                                    paquete,
                                                                )
                                                            }
                                                            className="flex-1 cursor-pointer rounded-xl border border-borde bg-white px-4 py-2.5 text-sm font-semibold text-navegacion transition hover:border-navegacion/30 hover:bg-fondo"
                                                        >
                                                            Ver itinerario
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                iniciarCompraPaquete(
                                                                    paquete,
                                                                )
                                                            }
                                                            className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:brightness-110"
                                                        >
                                                            Reservar →
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between gap-2 text-xs">
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-navegacion/[0.06] px-2.5 py-1 font-medium text-navegacion/80">
                                                            <span
                                                                className="size-1.5 rounded-full bg-marca"
                                                                aria-hidden="true"
                                                            />
                                                            {tieneSalidasCerradas
                                                                ? "Fechas recientes cerradas o agotadas · nuevas fechas próximamente"
                                                                : "Nuevas fechas de salida próximamente"}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirDetallePaquete(
                                                                paquete,
                                                            )
                                                        }
                                                        className="w-full cursor-pointer rounded-xl border border-borde bg-fondo/50 px-4 py-2.5 text-sm font-semibold text-navegacion transition hover:border-marca/45 hover:bg-marca-suave/50"
                                                    >
                                                        Ver itinerario y detalles →
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        };

                        return (
                            <div className="space-y-12">
                                {paquetesDisponibles.length > 0 ? (
                                    <div className="space-y-5">
                                        {paquetesProximamente.length > 0 ? (
                                            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                                                <div>
                                                    <h2 className="text-xl font-bold tracking-tight text-navegacion">
                                                        Disponibles para reservar
                                                    </h2>
                                                    <p className="text-xs text-texto-suave">
                                                        Expediciones con salidas abiertas y cupos confirmables online.
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-exito ring-1 ring-inset ring-emerald-600/15">
                                                    {paquetesDisponibles.length}{" "}
                                                    {paquetesDisponibles.length === 1
                                                        ? "paquete disponible"
                                                        : "paquetes disponibles"}
                                                </span>
                                            </div>
                                        ) : null}

                                        <div className="grid gap-7 md:grid-cols-2">
                                            {paquetesDisponibles.map((p) =>
                                                renderTarjetaPaquete(p, false),
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                {paquetesProximamente.length > 0 ? (
                                    <section
                                        aria-labelledby="titulo-proximamente"
                                        className={`space-y-5 ${
                                            paquetesDisponibles.length > 0
                                                ? "border-t border-borde/80 pt-10"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                                            <div>
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-navegacion/[0.07] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navegacion">
                                                    <span
                                                        className="size-1.5 rounded-full bg-marca"
                                                        aria-hidden="true"
                                                    />
                                                    Próximamente
                                                </span>
                                                <h2
                                                    id="titulo-proximamente"
                                                    className="mt-2 text-xl font-bold tracking-tight text-navegacion"
                                                >
                                                    Próximas expediciones
                                                </h2>
                                                <p className="mt-0.5 text-xs text-texto-suave">
                                                    Todavía no tienen fechas abiertas para compra, pero podés explorar el recorrido, el alojamiento y lo que incluyen.
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-fondo px-3 py-1 text-xs font-semibold text-texto-suave ring-1 ring-borde/80">
                                                {paquetesProximamente.length}{" "}
                                                {paquetesProximamente.length === 1
                                                    ? "expedición"
                                                    : "expediciones"}
                                            </span>
                                        </div>

                                        <div className="grid gap-7 md:grid-cols-2">
                                            {paquetesProximamente.map((p) =>
                                                renderTarjetaPaquete(p, true),
                                            )}
                                        </div>
                                    </section>
                                ) : null}
                            </div>
                        );
                    })()}
                </>
            ) : null}

            {/* MODAL DE DETALLE COMPLETO E ITINERARIO DEL PAQUETE (CU-26) */}
            {paqueteDetalle ? (
                <Modal
                    onCerrar={() => setPaqueteDetalle(null)}
                    etiqueta={paqueteDetalle.nombre}
                    tamano="xl"
                >
                        {(() => {
                            const galeria =
                                obtenerImagenesPaqueteCatalogo(paqueteDetalle);
                            const idxSeguro =
                                indiceFotoDetalle < galeria.length
                                    ? indiceFotoDetalle
                                    : 0;
                            const etapas = paqueteDetalle.circuito.etapas ?? [];
                            const salidas =
                                paqueteDetalle.salidasDisponibles ?? [];
                            const comprables = salidas.filter(salidaComprable);
                            const diasTotalesDetalle =
                                paqueteDetalle.circuito.dias +
                                paqueteDetalle.nochesAlojamiento.previas +
                                paqueteDetalle.nochesAlojamiento.posteriores;
                            const tarifaMinimaDetalle =
                                paqueteDetalle.precios &&
                                paqueteDetalle.precios.length > 0
                                    ? paqueteDetalle.precios.reduce(
                                          (min, p) =>
                                              p.precio < min.precio ? p : min,
                                          paqueteDetalle.precios[0],
                                      )
                                    : null;

                            return (
                                <>
                                    <div className="flex items-start justify-between gap-4 border-b border-borde/80 bg-white px-6 py-5">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-bold text-navegacion">
                                                    {paqueteDetalle.circuito.nombre}
                                                </span>
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${estiloDificultad(paqueteDetalle.circuito.dificultad)}`}
                                                >
                                                    Dificultad{" "}
                                                    {paqueteDetalle.circuito.dificultad}
                                                </span>
                                                <span className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold text-texto-suave">
                                                    {diasTotalesDetalle} días totales
                                                </span>
                                                <span className="font-mono text-xs text-texto-suave">
                                                    {paqueteDetalle.codigo}
                                                </span>
                                            </div>
                                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-navegacion">
                                                {paqueteDetalle.nombre}
                                            </h2>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
                                                {paqueteDetalle.saleDesde ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-marca-oscura">
                                                        <IconoPin />
                                                        Sale desde {paqueteDetalle.saleDesde}
                                                    </span>
                                                ) : null}
                                                <span>
                                                    {paqueteDetalle.circuito.recorrido ||
                                                        "Cusco → Camino del Inca → Machu Picchu"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-4">
                                            {tarifaMinimaDetalle ? (
                                                <div className="rounded-xl bg-fondo/80 px-3.5 py-2 text-right ring-1 ring-borde/70 max-sm:hidden">
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-texto-suave">
                                                        Desde
                                                    </p>
                                                    <p className="text-xl font-bold leading-tight text-navegacion">
                                                        {formatearMonto(
                                                            tarifaMinimaDetalle.precio,
                                                            tarifaMinimaDetalle.moneda,
                                                        )}
                                                    </p>
                                                </div>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaqueteDetalle(null)
                                                }
                                                aria-label="Cerrar detalle"
                                                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-borde bg-white text-sm font-semibold text-texto-suave transition hover:bg-fondo hover:text-navegacion"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr]">
                                        <div className="space-y-5">
                                            {/* GALERÍA */}
                                            <div className="relative overflow-hidden rounded-2xl border border-borde/80 bg-fondo">
                                                <img
                                                    src={resolverUrlImagenPaquete(
                                                        galeria[idxSeguro],
                                                    )}
                                                    alt={paqueteDetalle.nombre}
                                                    className="h-72 w-full object-cover"
                                                />
                                                <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                                                    Foto {idxSeguro + 1} de{" "}
                                                    {galeria.length}
                                                </span>
                                                {galeria.length > 1 ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            aria-label="Foto anterior"
                                                            onClick={() =>
                                                                setIndiceFotoDetalle(
                                                                    (idxSeguro - 1 + galeria.length) %
                                                                        galeria.length,
                                                                )
                                                            }
                                                            className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/85 text-navegacion shadow-md backdrop-blur-sm transition hover:bg-white"
                                                        >
                                                            ‹
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-label="Foto siguiente"
                                                            onClick={() =>
                                                                setIndiceFotoDetalle(
                                                                    (idxSeguro + 1) % galeria.length,
                                                                )
                                                            }
                                                            className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/85 text-navegacion shadow-md backdrop-blur-sm transition hover:bg-white"
                                                        >
                                                            ›
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>

                                            {galeria.length > 1 ? (
                                                <div className="grid grid-cols-5 gap-2">
                                                    {galeria.map((url, idx) => (
                                                        <button
                                                            key={`${url}-${idx}`}
                                                            type="button"
                                                            onClick={() =>
                                                                setIndiceFotoDetalle(
                                                                    idx,
                                                                )
                                                            }
                                                            className={`cursor-pointer overflow-hidden rounded-xl border transition ${
                                                                idx === idxSeguro
                                                                    ? "border-marca ring-2 ring-marca/30"
                                                                    : "border-borde opacity-70 hover:opacity-100"
                                                            }`}
                                                        >
                                                            <img
                                                                src={resolverUrlImagenPaquete(
                                                                    url,
                                                                )}
                                                                alt={`Miniatura ${idx + 1}`}
                                                                className="h-14 w-full object-cover"
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {/* DURACIÓN Y SALIDAS HABITUALES */}
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="rounded-xl border border-borde/80 bg-fondo/50 p-3.5">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
                                                        Duración total
                                                    </p>
                                                    <p className="mt-1 font-bold text-navegacion">
                                                        {diasTotalesDetalle} días ({paqueteDetalle.circuito.dias} de trekking +{" "}
                                                        {paqueteDetalle.nochesAlojamiento.previas +
                                                            paqueteDetalle.nochesAlojamiento.posteriores}{" "}
                                                        noches hotel)
                                                    </p>
                                                </div>
                                                {paqueteDetalle.diasDisponibles ? (
                                                    <div className="rounded-xl border border-borde/80 bg-fondo/50 p-3.5">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
                                                            Salidas habituales
                                                        </p>
                                                        <p className="mt-1 font-bold text-navegacion">
                                                            {formatearDiasLegibles(
                                                                paqueteDetalle.diasDisponibles,
                                                            )}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* ITINERARIO CON LÍNEA DE TIEMPO */}
                                            {etapas.length > 0 ? (
                                                <div className="space-y-3 rounded-2xl border border-borde/80 bg-fondo/40 p-4">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                                                        Itinerario día a día ({etapas.length} etapas)
                                                    </p>
                                                    <ol className="relative ml-3 space-y-3 border-l-2 border-marca/25 pl-5">
                                                        {etapas.map((etapa) => (
                                                            <li
                                                                key={etapa.numeroOrden}
                                                                className="relative rounded-xl border border-borde/80 bg-white p-3 text-xs shadow-2xs"
                                                            >
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="absolute -left-[31px] top-3 grid size-5 place-items-center rounded-full bg-navegacion text-[10px] font-bold text-white ring-4 ring-fondo"
                                                                >
                                                                    {etapa.numeroOrden}
                                                                </span>
                                                                <p className="font-bold text-navegacion">
                                                                    {etapa.puntoInicio} → {etapa.puntoFin}
                                                                </p>
                                                                {etapa.campamentoPrevisto ? (
                                                                    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-fondo px-2 py-0.5 text-[11px] font-medium text-texto-suave">
                                                                        Campamento: {etapa.campamentoPrevisto}
                                                                    </p>
                                                                ) : null}
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-4 max-lg:order-first">
                                            {/* SALIDAS DISPONIBLES */}
                                            <div className="space-y-3 rounded-2xl border border-borde/80 bg-fondo/40 p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                                                        Próximas salidas disponibles
                                                    </p>
                                                    {comprables.length > 0 ? (
                                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-exito ring-1 ring-inset ring-emerald-600/15">
                                                            {comprables.length}{" "}
                                                            {comprables.length === 1
                                                                ? "abierta"
                                                                : "abiertas"}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {salidas.length === 0 ? (
                                                    <p className="text-xs text-texto-suave">
                                                        Actualmente no hay salidas abiertas para este paquete.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {salidas.map((s) => {
                                                            const abierta = esVentaAbierta(s);
                                                            const disponible =
                                                                abierta &&
                                                                s.stockLocal > 0 &&
                                                                s.precioPersona != null;
                                                            return (
                                                                <div
                                                                    key={s.idsalida}
                                                                    className="flex items-center justify-between gap-3 rounded-xl border border-borde/80 bg-white p-3 text-xs transition hover:border-marca/40"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-bold text-navegacion">
                                                                            {formatearFechaUtcCorta(
                                                                                s.fechaInicio,
                                                                            )}
                                                                        </p>
                                                                        <p className="mt-0.5 text-texto-suave">
                                                                            {!abierta ? (
                                                                                <span className="font-semibold text-slate-600">
                                                                                    Venta cerrada
                                                                                </span>
                                                                            ) : s.stockLocal <= 0 ? (
                                                                                <span className="font-semibold text-peligro">
                                                                                    Agotada
                                                                                </span>
                                                                            ) : (
                                                                                <span className="font-medium text-exito">
                                                                                    {s.stockLocal} cupos disponibles
                                                                                </span>
                                                                            )}{" "}
                                                                            ·{" "}
                                                                            <strong className="font-semibold text-navegacion">
                                                                                {s.precioPersona == null
                                                                                    ? "Sin tarifa"
                                                                                    : formatearMonto(
                                                                                          s.precioPersona,
                                                                                          s.moneda,
                                                                                      )}
                                                                            </strong>
                                                                        </p>
                                                                        {salidaSinReintegro(s) ? (
                                                                            <p className="mt-1 text-[11px] font-semibold text-amber-800">
                                                                                Esta fecha ya no tiene reintegro si cancelás
                                                                            </p>
                                                                        ) : null}
                                                                        {s.garantia &&
                                                                        s.garantia !==
                                                                            paqueteDetalle
                                                                                .nochesAlojamiento
                                                                                .garantia ? (
                                                                            // CAT-29: la salida conserva la garantía con la que se publicó
                                                                            <p className="mt-0.5 font-semibold text-advertencia">
                                                                                Alojamiento de esta salida:{" "}
                                                                                {s.garantia}
                                                                            </p>
                                                                        ) : null}
                                                                        {s.nochesPrevias !== undefined &&
                                                                        s.nochesPosteriores !== undefined &&
                                                                        (s.nochesPrevias !==
                                                                            paqueteDetalle
                                                                                .nochesAlojamiento
                                                                                .previas ||
                                                                            s.nochesPosteriores !==
                                                                                paqueteDetalle
                                                                                    .nochesAlojamiento
                                                                                    .posteriores) ? (
                                                                            // CAT-05: la salida conserva las noches con las que se publicó
                                                                            <p className="mt-0.5 font-semibold text-advertencia">
                                                                                Noches de hotel de esta salida:{" "}
                                                                                {s.nochesPrevias} previas ·{" "}
                                                                                {s.nochesPosteriores} posteriores
                                                                            </p>
                                                                        ) : null}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        disabled={!disponible}
                                                                        onClick={() =>
                                                                            iniciarCompraPaquete(
                                                                                paqueteDetalle,
                                                                                s.idsalida,
                                                                            )
                                                                        }
                                                                        className="shrink-0 cursor-pointer rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:bg-none disabled:text-texto-suave"
                                                                    >
                                                                        {!abierta
                                                                            ? "Venta cerrada"
                                                                            : s.stockLocal <= 0
                                                                              ? "Agotada"
                                                                              : "Elegir →"}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* SERVICIOS INCLUIDOS */}
                                            <div className="space-y-2.5 rounded-2xl border border-borde/80 bg-fondo/40 p-4 text-xs">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                                                    Qué incluye este paquete
                                                </p>
                                                {paqueteDetalle.serviciosAdicionales &&
                                                paqueteDetalle.serviciosAdicionales.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {paqueteDetalle.serviciosAdicionales.map(
                                                            (serv) => (
                                                                <span
                                                                    key={serv}
                                                                    className="inline-flex items-center gap-1 rounded-lg border border-borde/80 bg-white px-2.5 py-1 text-xs font-medium text-texto"
                                                                >
                                                                    <span className="shrink-0 text-exito">
                                                                        <IconoCheck />
                                                                    </span>
                                                                    {serv}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-texto-suave">
                                                        Servicios base de trekking guiado incluidos.
                                                    </p>
                                                )}
                                            </div>

                                            {/* ALOJAMIENTO Y CONDICIONES */}
                                            <div className="space-y-3 rounded-2xl border border-borde/80 bg-fondo/40 p-4 text-xs">
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-navegacion">
                                                    Alojamiento y políticas
                                                </p>
                                                <div className="grid grid-cols-2 gap-2.5 text-texto">
                                                    <div className="rounded-xl border border-borde/80 bg-white p-3">
                                                        <p className="text-[11px] text-texto-suave">
                                                            Garantía hotelera
                                                        </p>
                                                        <p className="mt-0.5 font-semibold text-navegacion">
                                                            {paqueteDetalle.nochesAlojamiento.garantia}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-borde/80 bg-white p-3">
                                                        <p className="text-[11px] text-texto-suave">
                                                            Estadía
                                                        </p>
                                                        <p className="mt-0.5 font-semibold text-navegacion">
                                                            {textoNoches(
                                                                paqueteDetalle.nochesAlojamiento.previas,
                                                                paqueteDetalle.nochesAlojamiento.posteriores,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                {paqueteDetalle.condiciones ? (
                                                    <p className="leading-relaxed text-texto-suave">
                                                        <strong className="text-texto">
                                                            Políticas y condiciones:
                                                        </strong>{" "}
                                                        {paqueteDetalle.condiciones}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 border-t border-borde/80 bg-fondo/40 px-6 py-4">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPaqueteDetalle(null)
                                            }
                                            className="cursor-pointer rounded-xl border border-borde bg-white px-4 py-2 text-sm font-semibold text-navegacion transition hover:bg-fondo"
                                        >
                                            Cerrar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={comprables.length === 0}
                                            onClick={() =>
                                                iniciarCompraPaquete(
                                                    paqueteDetalle,
                                                )
                                            }
                                            className="cursor-pointer rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            Continuar a la reserva →
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                </Modal>
            ) : null}

            {/* MODAL / LOADER PROMINENTE DURANTE EL PAGO */}
            {mutacionReserva.isPending ? (
                <Modal
                    onCerrar={() => {}}
                    bloqueado
                    etiqueta="Procesando compra y reserva"
                    tamano="sm"
                    className="flex flex-col items-center gap-4 p-6 text-center"
                >
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-marca border-t-transparent" />
                        <div>
                            <h3 className="text-base font-bold text-navegacion">
                                Procesando compra y reserva
                            </h3>
                            <p className="mt-1 text-xs text-texto-suave">
                                Estamos registrando tu transacción con la pasarela de pagos y reservando tus cupos oficiales. Por favor no cierres esta ventana.
                            </p>
                        </div>
                </Modal>
            ) : null}
        </section>
    );
}

export default CatalogoCompraPage;
