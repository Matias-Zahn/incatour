import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import Modal from "../../components/Modal";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
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
    PESO_MAXIMO_DECLARADO_KG,
    TARJETA_VACIA,
    type DatosCompra,
    type FormularioCompra,
} from "./esquemaCompra";

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

type PasajeroFormulario = PasajeroReservaInput & {
    pesoDeclarado: number;
};

const PASAJEROS_PRUEBA: Array<{
    nombreCompleto: string;
    nroPasaporteBase: string;
    nacionalidad: string;
    fechaVencimientoPasaporte: string;
    pesoDeclarado: number;
}> = [
    {
        nombreCompleto: "Juan Ignacio Pérez",
        nroPasaporteBase: "ARG-401298",
        nacionalidad: "Argentina",
        fechaVencimientoPasaporte: "2031-08-15",
        pesoDeclarado: 14,
    },
    {
        nombreCompleto: "María Sol Gómez",
        nroPasaporteBase: "ARG-428910",
        nacionalidad: "Argentina",
        fechaVencimientoPasaporte: "2032-04-20",
        pesoDeclarado: 17,
    },
    {
        nombreCompleto: "Lucas Martín Rojas",
        nroPasaporteBase: "CHL-991042",
        nacionalidad: "Chilena",
        fechaVencimientoPasaporte: "2030-11-10",
        pesoDeclarado: 12,
    },
    {
        nombreCompleto: "Camila Andrea Torres",
        nroPasaporteBase: "URU-552319",
        nacionalidad: "Uruguaya",
        fechaVencimientoPasaporte: "2033-02-28",
        pesoDeclarado: 15,
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

function formatearFechaCorta(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

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
            ? `${formatearFechaCorta(sumarDiasIso(fechaInicioIso, -nochesPrevias))} al ${formatearFechaCorta(fechaInicioIso)} (${nochesPrevias} ${nochesPrevias === 1 ? "noche" : "noches"})`
            : null;
    const estadiaPosterior =
        nochesPosteriores > 0
            ? `${formatearFechaCorta(fechaFinIso)} al ${formatearFechaCorta(sumarDiasIso(fechaFinIso, nochesPosteriores))} (${nochesPosteriores} ${nochesPosteriores === 1 ? "noche" : "noches"})`
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
        pesoDeclarado: 12,
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
                    salidaActiva ? formatearFechaCorta(salidaActiva.fechaFin) : "fin del recorrido",
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
                (s) => s.stockLocal > 0 && s.precioPersona != null,
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

    // Cálculo en tiempo real de tarifa + exceso de equipaje (idéntico a ReservaService.calcularPrecio)
    const sinTarifa = salidaActiva?.precioPersona == null;
    const precioUnitario = salidaActiva?.precioPersona ?? 0;
    const monedaActiva = salidaActiva?.moneda ?? "USD";
    const subtotalPasajeros = precioUnitario * pasajeros.length;

    const infoEquipaje = paqueteVendido?.equipajeTransporte ?? null;
    const recargoEquipajeTotal = infoEquipaje
        ? pasajeros.reduce((acum, p) => {
              const exceso =
                  (Number(p.pesoDeclarado) || 0) -
                  infoEquipaje.pesoEquipajeIncluido;
              return exceso > 0
                  ? acum + exceso * infoEquipaje.costoPorKgExcedente
                  : acum;
          }, 0)
        : 0;

    const totalPagar =
        Math.round((subtotalPasajeros + recargoEquipajeTotal) * 100) / 100;

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
                equipaje: datos.pasajeros.map((p) => ({
                    pesoDeclarado: p.pesoDeclarado,
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
            const salidasRango = (p.salidasDisponibles ?? []).filter((s) => {
                const fechaIsoDia = s.fechaInicio.slice(0, 10);
                if (fechaDesde && fechaIsoDia < fechaDesde) return false;
                if (fechaHasta && fechaIsoDia > fechaHasta) return false;
                return true;
            });
            if (salidasRango.length === 0) return false;
        }
        if (
            soloConSalidas &&
            (!p.salidasDisponibles ||
                p.salidasDisponibles.every((s) => s.stockLocal <= 0))
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

            {/* ENCABEZADO DEL PORTAL COMERCIAL */}
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-marca-activa px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-marca-oscura">
                            {esAdmin
                                ? paqueteEnCompra || reservaConfirmada
                                    ? "Compra de Paquete"
                                    : "Catálogo Público"
                                : paqueteEnCompra || reservaConfirmada
                                  ? "Reserva de Paquete"
                                  : "Catálogo de Paquetes"}
                        </span>
                        {esVistaPreviaAdmin ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                                👁 Vista previa de lo que ve el cliente
                            </span>
                        ) : null}
                    </div>
                    <h1 className="mt-2 text-3xl font-bold text-navegacion">
                        {reservaConfirmada
                            ? "¡Reserva confirmada exitosamente!"
                            : paqueteEnCompra
                              ? `Reservar paquete: ${paqueteEnCompra.nombre}`
                              : "Catálogo de paquetes turísticos"}
                    </h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        {reservaConfirmada
                            ? "Tu pago fue aprobado y los cupos quedaron reservados a tu nombre."
                            : paqueteEnCompra
                              ? "Seleccioná tu fecha de salida, completá los datos de los pasajeros y aboná con tarjeta para confirmar tu lugar al instante."
                              : "Explorá nuestros circuitos guiados por el Camino del Inca, revisá el itinerario día por día y reservá tu próxima salida online."}
                    </p>
                </div>

                {paqueteEnCompra || reservaConfirmada ? (
                    <div className="flex flex-wrap gap-2">
                        <Boton
                            variante="secundario"
                            onClick={volverAlEscaparate}
                        >
                            ← Volver al catálogo de paquetes
                        </Boton>
                    </div>
                ) : null}
            </header>

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
                                        {reservaConfirmada.salida.nroSalida}
                                    </p>
                                    <p className="mt-1 text-xs text-texto">
                                        <strong>Inicio del recorrido:</strong>{" "}
                                        {formatearFechaCorta(
                                            reservaConfirmada.salida.fechaInicio,
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-xs text-texto">
                                        <strong>Fin del recorrido:</strong>{" "}
                                        {formatearFechaCorta(
                                            reservaConfirmada.salida.fechaFin,
                                        )}
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
                                        {reservaConfirmada.resultado.moneda}{" "}
                                        {reservaConfirmada.resultado.precioCongelado.toFixed(
                                            2,
                                        )}
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
                                        <p className="mt-2 border-t border-borde pt-1.5 text-[11px] text-texto-suave">
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
                                    <span className="rounded-full bg-marca-suave px-2.5 py-1 text-xs font-semibold text-marca-oscura">
                                        Equipaje: {p.pesoDeclarado} kg
                                    </span>
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
                                        const sinCupo =
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
                                                    <span className="rounded bg-marca-activa px-2 py-0.5 text-xs font-bold text-marca-oscura">
                                                        {salida.nroSalida}
                                                    </span>
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                            salida.stockLocal >
                                                            3
                                                                ? "bg-green-50 text-exito"
                                                                : salida.stockLocal >
                                                                    0
                                                                  ? "bg-amber-50 text-advertencia"
                                                                  : "bg-red-50 text-peligro"
                                                        }`}
                                                    >
                                                        {salida.stockLocal > 0
                                                            ? `${salida.stockLocal} de ${salida.tamanoMaximo} lugares libres`
                                                            : "Agotada"}
                                                    </span>
                                                </div>

                                                <div className="mt-3">
                                                    <p className="text-sm font-bold text-navegacion">
                                                        Salida:{" "}
                                                        {formatearFechaCorta(
                                                            salida.fechaInicio,
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-texto-suave">
                                                        Regreso:{" "}
                                                        {formatearFechaCorta(
                                                            salida.fechaFin,
                                                        )}{" "}
                                                        ·{" "}
                                                        {salida.temporadaNombre ??
                                                            "Sin temporada"}
                                                    </p>
                                                </div>

                                                <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-2.5">
                                                    <span className="text-xs text-texto-suave">
                                                        Tarifa por pasajero
                                                    </span>
                                                    <span className="text-base font-bold text-navegacion">
                                                        {sinTarifaSalida
                                                            ? "Sin tarifa para esta fecha"
                                                            : `${salida.moneda} ${salida.precioPersona}`}
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
                                            Pasajeros y declaración de equipaje (
                                            {pasajeros.length})
                                        </h2>
                                        <p className="text-xs text-texto-suave">
                                            Cada pasaporte debe ser único y
                                            vencer después del{" "}
                                            {salidaActiva
                                                ? formatearFechaCorta(
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

                            {infoEquipaje ? (
                                <div className="rounded-control border border-marca/30 bg-marca-suave/50 px-3.5 py-2.5 text-xs text-texto">
                                    <strong>Franquicia de transporte incluida:</strong>{" "}
                                    hasta{" "}
                                    <strong>
                                        {infoEquipaje.pesoEquipajeIncluido} kg
                                    </strong>{" "}
                                    por pasajero sin cargo adicional. Excedente:{" "}
                                    <strong>
                                        {monedaActiva}{" "}
                                        {infoEquipaje.costoPorKgExcedente.toFixed(
                                            2,
                                        )}{" "}
                                        por kg extra
                                    </strong>
                                    .
                                </div>
                            ) : null}

                            {errorNomina ? (
                                <p role="alert" className="text-xs text-peligro">
                                    {errorNomina}
                                </p>
                            ) : null}

                            <div className="space-y-4">
                                {camposPasajeros.map((campo, idx) => {
                                    const pasajero = pasajeros[idx] ?? campo;
                                    const errorPasajero = errors.pasajeros?.[idx];
                                    const excesoKg = infoEquipaje
                                        ? Math.max(
                                              0,
                                              (Number(pasajero.pesoDeclarado) ||
                                                  0) -
                                                  infoEquipaje.pesoEquipajeIncluido,
                                          )
                                        : 0;
                                    const costoExceso = infoEquipaje
                                        ? excesoKg *
                                          infoEquipaje.costoPorKgExcedente
                                        : 0;

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

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                                                <CampoCompra
                                                    etiqueta="Equipaje declarado (kg)"
                                                    id={`pasajero-${idx}-equipaje`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={PESO_MAXIMO_DECLARADO_KG}
                                                    step={0.5}
                                                    error={errorPasajero?.pesoDeclarado?.message}
                                                    {...register(`pasajeros.${idx}.pesoDeclarado`, { valueAsNumber: true })}
                                                    ayuda={
                                                        <>
                                                            {excesoKg > 0 ? (
                                                                <span className="text-[11px] font-semibold text-advertencia">
                                                                    +{excesoKg} kg extra ({monedaActiva}{" "}
                                                                    {costoExceso.toFixed(2)})
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-normal text-exito">
                                                                    Dentro de franquicia
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] font-normal text-texto-suave">
                                                                Máximo {PESO_MAXIMO_DECLARADO_KG} kg por pasajero
                                                            </span>
                                                        </>
                                                    }
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
                                            <p className="mt-0.5 text-[11px] text-texto-suave">
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
                                        ? `${salidaActiva.nroSalida} (${formatearFechaCorta(salidaActiva.fechaInicio)})`
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
                                              <p className="text-[11px] text-texto-suave">
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
                                <p className="rounded-control border border-borde bg-fondo/50 p-2 text-[11px] text-texto">
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
                                    × {sinTarifa ? "sin tarifa" : `${monedaActiva} ${precioUnitario}`})
                                </span>
                                <span className="font-semibold text-texto">
                                    {sinTarifa
                                        ? "—"
                                        : `${monedaActiva} ${subtotalPasajeros.toFixed(2)}`}
                                </span>
                            </div>

                            <div className="flex justify-between text-xs">
                                <span className="text-texto-suave">
                                    Exceso de equipaje
                                </span>
                                <span className="font-semibold text-texto">
                                    {recargoEquipajeTotal > 0
                                        ? `${monedaActiva} ${recargoEquipajeTotal.toFixed(2)}`
                                        : "Sin recargo"}
                                </span>
                            </div>

                            <div className="flex items-baseline justify-between border-t border-borde pt-3">
                                <span className="text-sm font-bold text-navegacion">
                                    Total a abonar
                                </span>
                                <span className="text-2xl font-bold text-navegacion">
                                    {sinTarifa
                                        ? "—"
                                        : `${monedaActiva} ${totalPagar.toFixed(2)}`}
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

                        <Boton
                            type="submit"
                            className="w-full py-3"
                            cargando={mutacionReserva.isPending}
                            disabled={
                                !salidaActiva ||
                                salidaActiva.stockLocal <= 0 ||
                                sinTarifa
                            }
                        >
                            {mutacionReserva.isPending
                                ? "Procesando pago y cupos..."
                                : !salidaActiva
                                  ? "Elegí una salida"
                                  : sinTarifa
                                    ? "Salida sin tarifa vigente"
                                  : `Confirmar y pagar ${monedaActiva} ${totalPagar.toFixed(2)}`}
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
                                    {sinTarifa ? "—" : `${monedaActiva} ${totalPagar.toFixed(2)}`}
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
                    {/* BARRA DE BÚSQUEDA Y FILTROS */}
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                        <div className="relative min-w-0 basis-64 flex-1">
                            <label
                                htmlFor="buscar-catalogo"
                                className="sr-only"
                            >
                                Buscar en el catálogo de paquetes
                            </label>
                            <input
                                id="buscar-catalogo"
                                type="search"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar paquete, circuito o código…"
                                className="w-full rounded-control border border-borde bg-fondo/50 px-3.5 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:bg-white focus:ring-2 focus:ring-marca/20"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-semibold text-texto-suave">
                                    Dificultad:
                                </span>
                                {[
                                    "TODAS",
                                    "BAJA",
                                    "MODERADA",
                                    "ALTA",
                                    "EXTREMA",
                                ].map((dif) => (
                                    <button
                                        key={dif}
                                        type="button"
                                        onClick={() => setFiltroDificultad(dif)}
                                        className={`rounded-full px-2.5 py-1 font-semibold transition ${
                                            filtroDificultad === dif
                                                ? "bg-marca text-white"
                                                : "bg-fondo text-texto-suave hover:bg-marca-suave hover:text-marca-oscura"
                                        }`}
                                    >
                                        {dif === "TODAS"
                                            ? "Todas"
                                            : dif.charAt(0) +
                                              dif.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 rounded-control border border-borde bg-fondo/60 px-3 py-1.5 text-xs font-semibold text-texto">
                                <input
                                    type="checkbox"
                                    checked={soloConSalidas}
                                    onChange={(e) =>
                                        setSoloConSalidas(e.target.checked)
                                    }
                                    className="size-4 accent-marca"
                                />
                                Solo con salidas abiertas
                            </label>
                        </div>

                        <div className="flex w-full flex-wrap items-end gap-3 border-t border-borde pt-3 text-xs">
                            <label className="grid gap-1 font-semibold text-texto-suave">
                                Duración del circuito
                                <select
                                    value={filtroDuracion}
                                    onChange={(e) =>
                                        setFiltroDuracion(e.target.value)
                                    }
                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-xs font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value="TODAS">Todas</option>
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
                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-xs font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
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
                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-xs font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                            </label>
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
                                    className="rounded-control px-3 py-1.5 font-semibold text-marca-oscura hover:underline"
                                >
                                    Limpiar filtros
                                </button>
                            ) : null}
                        </div>
                    </div>

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
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {paquetesFiltrados.map((paquete) => {
                                const galeria =
                                    obtenerImagenesPaqueteCatalogo(paquete);
                                const urlPortada = resolverUrlImagenPaquete(
                                    galeria[0],
                                );
                                const tarifaMinima = paquete.precios.reduce(
                                    (min, actual) =>
                                        actual.precio < min.precio
                                            ? actual
                                            : min,
                                    paquete.precios[0],
                                );
                                const salidasConCupo = (
                                    paquete.salidasDisponibles ?? []
                                ).filter((s) => s.stockLocal > 0 && s.precioPersona != null);
                                const diasTotales =
                                    paquete.circuito.dias +
                                    paquete.nochesAlojamiento.previas +
                                    paquete.nochesAlojamiento.posteriores;

                                const esPreseleccionado =
                                    idPaquetePreseleccionado > 0 &&
                                    paquete.id === idPaquetePreseleccionado;

                                return (
                                    <article
                                        key={paquete.id}
                                        className={`flex flex-col overflow-hidden rounded-tarjeta border bg-white shadow-tarjeta transition hover:shadow-md ${
                                            esPreseleccionado
                                                ? "border-marca ring-2 ring-marca/40"
                                                : "border-borde"
                                        }`}
                                    >
                                        <div className="relative h-56 overflow-hidden bg-fondo">
                                            <img
                                                src={urlPortada}
                                                alt={paquete.nombre}
                                                className="h-full w-full object-cover"
                                            />
                                            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                                <span className="rounded bg-navegacion/90 px-2.5 py-1 text-xs font-bold text-white">
                                                    {paquete.codigo}
                                                </span>
                                                <span className="rounded bg-marca px-2.5 py-1 text-xs font-bold text-white">
                                                    {diasTotales} días totales ·
                                                    Dif.{" "}
                                                    {
                                                        paquete.circuito
                                                            .dificultad
                                                    }
                                                </span>
                                                {esPreseleccionado ? (
                                                    <span className="rounded bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-navegacion">
                                                        ★ Previsualizando
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirDetallePaquete(paquete)
                                                }
                                                className="absolute right-3 bottom-3 rounded-full bg-navegacion/85 px-3 py-1 text-xs font-bold text-white hover:bg-navegacion"
                                            >
                                                📷 {galeria.length}{" "}
                                                {galeria.length === 1
                                                    ? "foto"
                                                    : "fotos"}{" "}
                                                · Ver galería
                                            </button>
                                        </div>

                                        <div className="flex flex-1 flex-col justify-between space-y-4 p-6">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-marca-oscura">
                                                            {
                                                                paquete.circuito
                                                                    .nombre
                                                            }
                                                        </p>
                                                        <h2 className="text-xl font-bold text-navegacion">
                                                            {paquete.nombre}
                                                        </h2>
                                                    </div>

                                                    {tarifaMinima ? (
                                                        <div className="text-right">
                                                            <p className="text-[11px] text-texto-suave">
                                                                Desde
                                                            </p>
                                                            <p className="text-xl font-bold text-navegacion">
                                                                {
                                                                    tarifaMinima.moneda
                                                                }{" "}
                                                                {
                                                                    tarifaMinima.precio
                                                                }
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <p className="text-xs text-texto-suave">
                                                    <strong className="text-texto">
                                                        Recorrido:
                                                    </strong>{" "}
                                                    {paquete.circuito
                                                        .recorrido ||
                                                        "Cusco -> Camino del Inca -> Machu Picchu"}
                                                </p>

                                                <div className="grid grid-cols-2 gap-2 rounded-control border border-borde bg-fondo/50 p-3 text-xs">
                                                    <div>
                                                        <p className="text-texto-suave">
                                                            Alojamiento
                                                            garantizado
                                                        </p>
                                                        <p className="font-semibold text-texto">
                                                            {
                                                                paquete
                                                                    .nochesAlojamiento
                                                                    .garantia
                                                            }
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-texto-suave">
                                                            Noches de hotel
                                                        </p>
                                                        <p className="font-semibold text-texto">
                                                            {textoNoches(
                                                                paquete.nochesAlojamiento.previas,
                                                                paquete.nochesAlojamiento.posteriores,
                                                            )}
                                                            {paquete.diasDisponibles
                                                                ? ` · ${formatearDiasLegibles(paquete.diasDisponibles)}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>

                                                {paquete.serviciosAdicionales
                                                    .length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {paquete.serviciosAdicionales.map(
                                                            (serv) => (
                                                                <span
                                                                    key={serv}
                                                                    className="rounded-full border border-borde bg-fondo px-2.5 py-0.5 text-[11px] font-medium text-texto"
                                                                >
                                                                    ✓ {serv}
                                                                </span>
                                                            ),
                                                        )}
                                                        {paquete.equipajeTransporte ? (
                                                            <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-[11px] font-semibold text-marca-oscura">
                                                                🎒{" "}
                                                                {
                                                                    paquete
                                                                        .equipajeTransporte
                                                                        .pesoEquipajeIncluido
                                                                }{" "}
                                                                kg incluidos
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="space-y-3 border-t border-borde pt-4">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-texto-suave">
                                                        Salidas disponibles para
                                                        compra:
                                                    </span>
                                                    {salidasConCupo.length >
                                                    0 ? (
                                                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 font-bold text-exito">
                                                            {
                                                                salidasConCupo.length
                                                            }{" "}
                                                            {salidasConCupo.length ===
                                                            1
                                                                ? "salida abierta"
                                                                : "salidas abiertas"}{" "}
                                                            (
                                                            {
                                                                salidasConCupo[0]
                                                                    .stockLocal
                                                            }{" "}
                                                            cupos en{" "}
                                                            {formatearFechaCorta(
                                                                salidasConCupo[0]
                                                                    .fechaInicio,
                                                            )}
                                                            )
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-texto-suave">
                                                            Sin salidas abiertas
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <Boton
                                                        variante="secundario"
                                                        className="flex-1"
                                                        onClick={() =>
                                                            abrirDetallePaquete(
                                                                paquete,
                                                            )
                                                        }
                                                    >
                                                        Ver itinerario y detalle
                                                    </Boton>
                                                    <Boton
                                                        className="flex-1"
                                                        disabled={salidasConCupo.length === 0}
                                                        onClick={() =>
                                                            iniciarCompraPaquete(
                                                                paquete,
                                                            )
                                                        }
                                                    >
                                                        {salidasConCupo.length === 0
                                                            ? "Sin salidas disponibles"
                                                            : "Comprar paquete"}
                                                    </Boton>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
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
                                    <div className="flex items-start justify-between gap-4 border-b border-borde p-6">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="flex items-center gap-1 rounded bg-marca px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                                                    🏔️ {paqueteDetalle.circuito.nombre}
                                                </span>
                                                <span className="rounded border border-borde bg-fondo px-2 py-0.5 font-mono text-[11px] font-semibold text-texto-suave">
                                                    {paqueteDetalle.codigo}
                                                </span>
                                                <span className="text-xs font-semibold text-texto-suave">
                                                    · {diasTotalesDetalle} días totales · Dificultad{" "}
                                                    {paqueteDetalle.circuito.dificultad}
                                                </span>
                                            </div>
                                            <h2 className="mt-1.5 text-2xl font-bold text-navegacion">
                                                {paqueteDetalle.nombre}
                                            </h2>
                                            <p className="mt-1 text-xs text-texto-suave">
                                                <strong className="text-texto">Recorrido:</strong>{" "}
                                                {paqueteDetalle.circuito.recorrido ||
                                                    "Cusco -> Camino del Inca -> Machu Picchu"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {tarifaMinimaDetalle ? (
                                                <div className="text-right max-sm:hidden">
                                                    <p className="text-[11px] text-texto-suave">Tarifa desde</p>
                                                    <p className="text-2xl font-bold text-navegacion">
                                                        {tarifaMinimaDetalle.moneda} {tarifaMinimaDetalle.precio}
                                                    </p>
                                                </div>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPaqueteDetalle(null)
                                                }
                                                className="rounded-control border border-borde px-3 py-1.5 text-xs font-semibold text-texto-suave hover:bg-fondo"
                                            >
                                                ✕ Cerrar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr]">
                                        <div className="space-y-4">
                                            <div className="relative overflow-hidden rounded-tarjeta border border-borde bg-fondo">
                                                <img
                                                    src={resolverUrlImagenPaquete(
                                                        galeria[idxSeguro],
                                                    )}
                                                    alt={paqueteDetalle.nombre}
                                                    className="h-72 w-full object-cover"
                                                />
                                                <span className="absolute top-3 left-3 rounded-full bg-navegacion/85 px-3 py-1 text-xs font-bold text-white">
                                                    Foto {idxSeguro + 1} de{" "}
                                                    {galeria.length}
                                                </span>
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
                                                            className={`overflow-hidden rounded-control border ${
                                                                idx ===
                                                                idxSeguro
                                                                    ? "border-marca ring-2 ring-marca/30"
                                                                    : "border-borde opacity-75"
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
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4 text-xs space-y-2">
                                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                                    Duración y salidas programadas
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 text-texto">
                                                    <div className="rounded border border-borde bg-white p-2.5">
                                                        <p className="text-texto-suave">Duración total</p>
                                                        <p className="font-bold text-navegacion">
                                                            {diasTotalesDetalle} días ({paqueteDetalle.circuito.dias} de trekking + {paqueteDetalle.nochesAlojamiento.previas + paqueteDetalle.nochesAlojamiento.posteriores} noches hotel)
                                                        </p>
                                                    </div>
                                                    {paqueteDetalle.diasDisponibles ? (
                                                        <div className="rounded border border-borde bg-white p-2.5">
                                                            <p className="text-texto-suave">Salidas habituales</p>
                                                            <p className="font-bold text-navegacion">
                                                                {formatearDiasLegibles(paqueteDetalle.diasDisponibles)}
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {etapas.length > 0 ? (
                                                <div className="space-y-2 rounded-control border border-borde bg-fondo/40 p-4">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                                        Itinerario por etapas (
                                                        {etapas.length})
                                                    </p>
                                                    <div className="space-y-2">
                                                        {etapas.map((etapa) => (
                                                            <div
                                                                key={
                                                                    etapa.numeroOrden
                                                                }
                                                                className="rounded border border-borde bg-white p-2.5 text-xs"
                                                            >
                                                                <p className="font-bold text-navegacion">
                                                                    Etapa #
                                                                    {
                                                                        etapa.numeroOrden
                                                                    }
                                                                    :{" "}
                                                                    {
                                                                        etapa.puntoInicio
                                                                    }{" "}
                                                                    →{" "}
                                                                    {
                                                                        etapa.puntoFin
                                                                    }
                                                                </p>
                                                                {etapa.campamentoPrevisto ? (
                                                                    <p className="mt-0.5 text-texto-suave">
                                                                        ⛺
                                                                        Campamento:{" "}
                                                                        {
                                                                            etapa.campamentoPrevisto
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="space-y-4">
                                            {/* SERVICIOS INCLUIDOS Y EQUIPAJE */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4 text-xs space-y-2">
                                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                                    Servicios y equipaje incluidos
                                                </p>
                                                {paqueteDetalle.serviciosAdicionales &&
                                                paqueteDetalle.serviciosAdicionales.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {paqueteDetalle.serviciosAdicionales.map((serv) => (
                                                            <span
                                                                key={serv}
                                                                className="rounded-full border border-borde bg-white px-2.5 py-1 text-[11px] font-medium text-texto"
                                                            >
                                                                ✓ {serv}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-texto-suave">
                                                        Servicios base de trekking guiado incluidos.
                                                    </p>
                                                )}
                                                {paqueteDetalle.equipajeTransporte ? (
                                                    <div className="mt-2 rounded-control border border-marca/30 bg-marca-suave/60 p-2.5 text-xs text-marca-oscura">
                                                        <p className="font-bold">🎒 Franquicia de equipaje:</p>
                                                        <p className="mt-0.5">
                                                            Hasta <strong>{paqueteDetalle.equipajeTransporte.pesoEquipajeIncluido} kg</strong> incluidos por pasajero en el transporte. (Excedente: {tarifaMinimaDetalle?.moneda ?? "USD"} {paqueteDetalle.equipajeTransporte.costoPorKgExcedente}/kg).
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* ALOJAMIENTO Y CONDICIONES */}
                                            <div className="rounded-control border border-borde bg-fondo/40 p-4 text-xs space-y-2">
                                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                                    Alojamiento y condiciones
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 text-texto">
                                                    <div className="rounded border border-borde bg-white p-2.5">
                                                        <p className="text-texto-suave">Garantía hotelera</p>
                                                        <p className="font-semibold text-texto">
                                                            {paqueteDetalle.nochesAlojamiento.garantia}
                                                        </p>
                                                    </div>
                                                    <div className="rounded border border-borde bg-white p-2.5">
                                                        <p className="text-texto-suave">Estadía</p>
                                                        <p className="font-semibold text-texto">
                                                            {textoNoches(paqueteDetalle.nochesAlojamiento.previas, paqueteDetalle.nochesAlojamiento.posteriores)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {paqueteDetalle.condiciones ? (
                                                    <p className="pt-1 text-texto-suave">
                                                        <strong className="text-texto">Políticas y condiciones:</strong> {paqueteDetalle.condiciones}
                                                    </p>
                                                ) : null}
                                            </div>

                                            {/* MATRIZ DE PRECIOS POR TEMPORADA */}
                                            {paqueteDetalle.precios && paqueteDetalle.precios.length > 0 ? (
                                                <div className="rounded-control border border-borde bg-fondo/40 p-4 text-xs space-y-2">
                                                    <p className="font-bold uppercase tracking-wide text-navegacion">
                                                        Tarifas vigentes según temporada
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {paqueteDetalle.precios.map((t) => (
                                                            <div
                                                                key={t.idtemporada}
                                                                className="flex items-center justify-between rounded border border-borde bg-white p-2.5 text-xs"
                                                            >
                                                                <div>
                                                                    <p className="font-bold text-navegacion">{t.temporada}</p>
                                                                    <p className="text-[11px] text-texto-suave">
                                                                        {formatearFechaCorta(t.fechaInicio)} al {formatearFechaCorta(t.fechaFin)}
                                                                    </p>
                                                                </div>
                                                                <span className="font-bold text-navegacion">
                                                                    {t.moneda} {t.precio}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* SALIDAS DISPONIBLES */}
                                            <div className="space-y-2 rounded-control border border-borde bg-fondo/40 p-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                                        Próximas salidas disponibles
                                                    </p>
                                                    {salidas.length > 0 ? (
                                                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-exito">
                                                            {salidas.length} {salidas.length === 1 ? "salida abierta" : "salidas abiertas"}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {salidas.length === 0 ? (
                                                    <p className="text-xs text-texto-suave">
                                                        Actualmente no hay
                                                        salidas abiertas para
                                                        este paquete.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {salidas.map((s) => (
                                                            <div
                                                                key={s.idsalida}
                                                                className="flex items-center justify-between rounded border border-borde bg-white p-3 text-xs"
                                                            >
                                                                <div>
                                                                    <p className="font-bold text-navegacion">
                                                                        {
                                                                            s.nroSalida
                                                                        }{" "}
                                                                        ·{" "}
                                                                        {formatearFechaCorta(
                                                                            s.fechaInicio,
                                                                        )}
                                                                    </p>
                                                                    <p className="text-texto-suave">
                                                                        {
                                                                            s.stockLocal
                                                                        }{" "}
                                                                        cupos
                                                                        disponibles
                                                                        ·{" "}
                                                                        {s.precioPersona ==
                                                                        null
                                                                            ? "Sin tarifa para esta fecha"
                                                                            : `${s.moneda} ${s.precioPersona}`}
                                                                    </p>
                                                                    {s.garantia &&
                                                                    s.garantia !==
                                                                        paqueteDetalle
                                                                            .nochesAlojamiento
                                                                            .garantia ? (
                                                                        // CAT-29: la salida conserva la garantía con la que se publicó
                                                                        <p className="font-semibold text-advertencia">
                                                                            Alojamiento de esta salida:{" "}
                                                                            {s.garantia}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                                <Boton
                                                                    className="px-3 py-1.5 text-xs"
                                                                    disabled={
                                                                        s.stockLocal <=
                                                                            0 ||
                                                                        s.precioPersona ==
                                                                            null
                                                                    }
                                                                    onClick={() =>
                                                                        iniciarCompraPaquete(
                                                                            paqueteDetalle,
                                                                            s.idsalida,
                                                                        )
                                                                    }
                                                                >
                                                                    Elegir y
                                                                    comprar
                                                                </Boton>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 border-t border-borde bg-fondo/40 px-6 py-4">
                                        <Boton
                                            variante="fantasma"
                                            onClick={() =>
                                                setPaqueteDetalle(null)
                                            }
                                        >
                                            Cerrar
                                        </Boton>
                                        <Boton
                                            onClick={() =>
                                                iniciarCompraPaquete(
                                                    paqueteDetalle,
                                                )
                                            }
                                        >
                                            Continuar a la compra →
                                        </Boton>
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
