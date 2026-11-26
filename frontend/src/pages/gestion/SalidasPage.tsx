import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Modal from "../../components/Modal";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import MenuAccionesSalida, {
    type AccionMenuSalida,
} from "../../components/MenuAccionesSalida";
import FormularioCrearSalida from "../../components/FormularioCrearSalida";
import FormularioAsignarRecursos from "../../components/FormularioAsignarRecursos";
import FormularioReemplazarPersonal from "../../components/FormularioReemplazarPersonal";
import FormularioModificarLogistica from "../../components/FormularioModificarLogistica";
import ModalCancelarSalida from "../../components/ModalCancelarSalida";
import ModalDevolucionEquipamiento from "../../components/ModalDevolucionEquipamiento";
import { ErrorApi } from "../../services/clienteApi";
import { useCircuitos } from "../../services/circuitoService";
import {
    estilosEstadoSalida,
    fechaLocalHoy,
    formatearEstadoSalida,
    formatearFechaHora,
} from "../../services/guiaService";
import {
    formatearFechaUtcCorta,
    formatearMonto,
    formatearRangoFechasUtc,
} from "../../services/formato";
import { usePaquetes } from "../../services/paqueteService";
import { usePersonal } from "../../services/personalService";
import {
    clavesSalidas,
    contarSolicitudesPendientesPorSalida,
    dotacionDeSalida,
    nombresGuiasDeSalida,
    useConfirmarAsignacion,
    useConfirmarReemplazo,
    useCrearSalida,
    useLiberarSobrantes,
    useModificarLogistica,
    usePanelAsignacion,
    usePanelLogistica,
    usePersonalSalida,
    useSalidas,
    useCancelarSalida,
    type DatosCrearSalida,
    type DetalleConflictoConfirmacion,
    type DetalleFaltaEquipo,
    type FiltrosSalidas,
    type PayloadConfirmarAsignacion,
    type PayloadConfirmarReemplazo,
    type PayloadModificarLogistica,
    type PermisoRechazadoAsignacion,
    type ResultadoCancelarSalida,
    type ResultadoDevolucionEquipamiento,
    type Salida,
} from "../../services/salidaService";
import { formatearMontoUsd } from "../../services/clientePortalService";
import { obtenerUsuario } from "../../services/sesionService";
import { listarSolicitudesPendientes } from "../../services/solicitudService";

const ELEMENTOS_POR_PAGINA = 5;

const ESTADOS_HISTORIAL = ["FINALIZADA", "CANCELADA"];

// Alertas del recorrido: dependen del guía, no de la preparación de la salida
const ALERTAS_RECORRIDO: Record<string, string> = {
    SIN_INICIAR: "Sin iniciar",
    SIN_AVANCES: "Sin avances del guía",
    SIN_FINALIZAR: "Vencida sin cerrar",
};

// Alertas de preparación y recursos (B4, 12.3 — §6)
const ALERTAS_OPERATIVAS_NUEVAS: Record<string, { etiqueta: string; estilo: string }> = {
    FALTA_RECURSO: {
        etiqueta: "Falta equipo o transporte",
        estilo: "bg-rose-100 border-rose-300 text-rose-900",
    },
    RIESGO_STOCK: {
        etiqueta: "Equipo justo",
        estilo: "bg-amber-100 border-amber-300 text-amber-900",
    },
    PERSONAL_NO_APTO: {
        etiqueta: "Personal no apto",
        estilo: "bg-rose-100 border-rose-300 text-rose-900",
    },
    PENDIENTE_CONFIRMAR: {
        etiqueta: "Para confirmar",
        estilo: "bg-indigo-100 border-indigo-300 text-indigo-900",
    },
};

function extraerDetalleEquipo(error: unknown): DetalleFaltaEquipo | null {
    if (!(error instanceof ErrorApi) || !error.detalle || typeof error.detalle !== "object") {
        return null;
    }
    const det = error.detalle as Partial<DetalleFaltaEquipo>;
    if (Array.isArray(det.faltantes) && typeof det.tamanoMaximoSugerido === "number") {
        return det as DetalleFaltaEquipo;
    }
    return null;
}

function extraerDetalleConfirmacion(error: unknown): DetalleConflictoConfirmacion | null {
    if (!(error instanceof ErrorApi) || !error.detalle || typeof error.detalle !== "object") {
        return null;
    }
    const det = error.detalle as Partial<DetalleConflictoConfirmacion>;
    if (Array.isArray(det.reservasSinAlojamiento) || Array.isArray(det.faltantes)) {
        return {
            reservasSinAlojamiento: Array.isArray(det.reservasSinAlojamiento)
                ? det.reservasSinAlojamiento
                : [],
            faltantes: Array.isArray(det.faltantes) ? det.faltantes : [],
        };
    }
    return null;
}

const DIA_MS = 1000 * 60 * 60 * 24;
const diaLocal = (iso: string) => {
    const f = new Date(iso);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};
const diasEntre = (desde: string, hasta: string) => Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / DIA_MS);

type VistaSalidas = "vigentes" | "alertas" | "confirmar" | "historial";

function salidaRequiereAtencion(s: Salida): boolean {
    return (
        (Array.isArray(s.alertas) && s.alertas.length > 0) ||
        s.etapaDesfasada === true
    );
}

/** Lo que está en curso va arriba y después lo más cercano; en el historial, lo más reciente primero */
function ordenarSalidas(salidas: Salida[], vista: VistaSalidas) {
    return [...salidas].sort((a, b) => {
        if (vista === "historial") return b.fechaInicio.localeCompare(a.fechaInicio);
        return (
            Number(b.estado === "EN_CURSO") - Number(a.estado === "EN_CURSO") ||
            a.fechaInicio.localeCompare(b.fechaInicio)
        );
    });
}

const ESTADOS_SALIDA = [
    { valor: "PUBLICADA", etiqueta: "Publicada" },
    { valor: "CERRADA", etiqueta: "Confirmada" },
    { valor: "EN_CURSO", etiqueta: "En curso" },
    { valor: "FINALIZADA", etiqueta: "Finalizada" },
    { valor: "CANCELADA", etiqueta: "Cancelada" },
] as const;

function SalidasPage() {
    const usuario = obtenerUsuario();
    const esAdmin = !usuario || usuario.rol === "ADMIN";
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Estados para la creación de salidas (CU-36)
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [errorCreacion, setErrorCreacion] = useState("");
    const [errorDetalleEquipo, setErrorDetalleEquipo] = useState<DetalleFaltaEquipo | null>(null);
    const [mensajeExito, setMensajeExito] = useState<{
        titulo: string;
        numeroSalida?: string;
        fechaInicio?: string;
        advertencias?: string[];
    } | null>(null);

    const crearSalidaMutation = useCrearSalida();

    // Estados para la asignación de recursos (CU-40)
    const [salidaParaAsignar, setSalidaParaAsignar] = useState<Salida | null>(null);
    const [payloadConfirmarAsignacion, setPayloadConfirmarAsignacion] =
        useState<PayloadConfirmarAsignacion | null>(null);
    const [errorConfirmacion, setErrorConfirmacion] = useState("");
    const [detalleErrorConfirmacion, setDetalleErrorConfirmacion] =
        useState<DetalleConflictoConfirmacion | null>(null);
    const [errorLiberacionSobrantes, setErrorLiberacionSobrantes] = useState("");
    const [mensajeExitoLiberacion, setMensajeExitoLiberacion] = useState<{
        nroSalida: string;
        lugaresLiberados: number;
    } | null>(null);
    const [idSalidaLiberando, setIdSalidaLiberando] = useState<number | null>(null);
    const [mensajeSalidaYaAsignada, setMensajeSalidaYaAsignada] = useState<string | null>(null);
    const [resultadoAsignacion, setResultadoAsignacion] = useState<{
        idsalida: number;
        nroSalida: string;
        permisosEmitidos: number;
        rechazados: PermisoRechazadoAsignacion[];
        lugaresLiberados: number;
        estado: string;
        advertencia?: string;
    } | null>(null);

    const {
        data: datosAsignacion,
        isPending: cargandoAsignacion,
        isFetching: recargandoAsignacion,
        error: errorAsignacion,
    } = usePanelAsignacion(salidaParaAsignar?.idsalida ?? null);

    const confirmarAsignacionMutation = useConfirmarAsignacion();
    const liberarSobrantesMutation = useLiberarSobrantes();

    // Estados para el reemplazo de personal (CU-38)
    const [salidaParaReemplazarEstado, setSalidaParaReemplazar] = useState<Salida | null>(null);
    const idReemplazarDesdeUrl = Number(searchParams.get("reemplazarSalida") ?? 0);
    const idSalidaReemplazoActivo =
        salidaParaReemplazarEstado?.idsalida ??
        (idReemplazarDesdeUrl > 0 ? idReemplazarDesdeUrl : null);
    const [errorReemplazo, setErrorReemplazo] = useState("");
    const [resultadoReemplazo, setResultadoReemplazo] = useState<{
        nroSalida: string;
        sale: { idpersonal: number; nombreCompleto: string };
        entra: { idpersonal: number; nombreCompleto: string };
        permisoDadoDeBaja: string | null;
        permisoNuevo: string | null;
    } | null>(null);

    const {
        data: datosPersonalSalida,
        isPending: cargandoPersonalSalida,
        error: errorPersonalSalida,
        refetch: recargarPersonalSalida,
    } = usePersonalSalida(idSalidaReemplazoActivo);

    const confirmarReemplazoMutation = useConfirmarReemplazo();

    // Estados para la modificación de logística (CU-39)
    const [salidaParaModificarLogistica, setSalidaParaModificarLogistica] = useState<Salida | null>(null);
    const [errorModificarLogistica, setErrorModificarLogistica] = useState("");
    const [resultadoModificarLogistica, setResultadoModificarLogistica] = useState<{
        nroSalida: string;
        advertencias: string[];
    } | null>(null);

    const {
        data: datosLogisticaSalida,
        isPending: cargandoLogisticaSalida,
        error: errorLogisticaSalida,
        refetch: recargarLogisticaSalida,
    } = usePanelLogistica(salidaParaModificarLogistica?.idsalida ?? null);

    const modificarLogisticaMutation = useModificarLogistica();

    // Estados para la cancelación de salidas (CU-37)
    const [salidaParaCancelar, setSalidaParaCancelar] = useState<Salida | null>(null);
    const [resultadoCancelacion, setResultadoCancelacion] =
        useState<ResultadoCancelarSalida | null>(null);
    const [advertenciaCancelacion503, setAdvertenciaCancelacion503] = useState<{
        idsalida: number;
        nroSalida: string;
        mensaje: string;
    } | null>(null);
    const [idSalidaReintentandoCupos, setIdSalidaReintentandoCupos] = useState<number | null>(null);

    const cancelarSalidaMutation = useCancelarSalida();

    // Estados para la devolución de equipamiento (CU-41)
    const [salidaParaDevolverEquipamiento, setSalidaParaDevolverEquipamiento] =
        useState<Salida | null>(null);
    const [resultadoDevolucion, setResultadoDevolucion] =
        useState<ResultadoDevolucionEquipamiento | null>(null);

    function abrirFormulario() {
        setFormularioAbierto(true);
        setSalidaParaAsignar(null);
        setSalidaParaReemplazar(null);
        setSalidaParaModificarLogistica(null);
        setSalidaParaCancelar(null);
        setSalidaParaDevolverEquipamiento(null);
        setErrorCreacion("");
        setErrorDetalleEquipo(null);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        if (!resultadoAsignacion?.advertencia) {
            setResultadoAsignacion(null);
        }
        setPayloadConfirmarAsignacion(null);
    }

    function cerrarFormulario() {
        setFormularioAbierto(false);
        setErrorCreacion("");
        setErrorDetalleEquipo(null);
    }

    function abrirAsignacion(salida: Salida) {
        setSalidaParaAsignar(salida);
        setSalidaParaReemplazar(null);
        setSalidaParaModificarLogistica(null);
        setSalidaParaCancelar(null);
        setSalidaParaDevolverEquipamiento(null);
        setFormularioAbierto(false);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        if (!resultadoAsignacion?.advertencia) {
            setResultadoAsignacion(null);
        }
        setPayloadConfirmarAsignacion(null);
    }

    function cerrarAsignacion() {
        setSalidaParaAsignar(null);
        setPayloadConfirmarAsignacion(null);
        setErrorConfirmacion("");
        setDetalleErrorConfirmacion(null);
    }

    function abrirReemplazo(salida: Salida) {
        setSalidaParaReemplazar(salida);
        setSalidaParaAsignar(null);
        setSalidaParaModificarLogistica(null);
        setSalidaParaCancelar(null);
        setSalidaParaDevolverEquipamiento(null);
        setFormularioAbierto(false);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        setResultadoReemplazo(null);
        if (!resultadoAsignacion?.advertencia) {
            setResultadoAsignacion(null);
        }
        setPayloadConfirmarAsignacion(null);
    }

    function cerrarReemplazo() {
        setSalidaParaReemplazar(null);
        setErrorReemplazo("");
        if (searchParams.has("reemplazarSalida")) {
            const copia = new URLSearchParams(searchParams);
            copia.delete("reemplazarSalida");
            setSearchParams(copia, { replace: true });
        }
    }

    function abrirModificarLogistica(salida: Salida) {
        setSalidaParaModificarLogistica(salida);
        setSalidaParaAsignar(null);
        setSalidaParaReemplazar(null);
        setSalidaParaCancelar(null);
        setSalidaParaDevolverEquipamiento(null);
        setFormularioAbierto(false);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        setResultadoModificarLogistica(null);
        if (!resultadoAsignacion?.advertencia) {
            setResultadoAsignacion(null);
        }
        setPayloadConfirmarAsignacion(null);
    }

    function cerrarModificarLogistica() {
        setSalidaParaModificarLogistica(null);
        setErrorModificarLogistica("");
    }

    function abrirCancelarSalida(salida: Salida) {
        setSalidaParaCancelar(salida);
        setFormularioAbierto(false);
        setSalidaParaAsignar(null);
        setSalidaParaReemplazar(null);
        setSalidaParaModificarLogistica(null);
        setSalidaParaDevolverEquipamiento(null);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        setResultadoCancelacion(null);
    }

    function cerrarCancelarSalida() {
        setSalidaParaCancelar(null);
    }

    function abrirDevolucionEquipamiento(salida: Salida) {
        setSalidaParaDevolverEquipamiento(salida);
        setFormularioAbierto(false);
        setSalidaParaAsignar(null);
        setSalidaParaReemplazar(null);
        setSalidaParaModificarLogistica(null);
        setSalidaParaCancelar(null);
        setMensajeExito(null);
        setErrorConfirmacion("");
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setMensajeSalidaYaAsignada(null);
        setErrorReemplazo("");
        setErrorModificarLogistica("");
        setResultadoCancelacion(null);
        setResultadoDevolucion(null);
    }

    function cerrarDevolucionEquipamiento() {
        setSalidaParaDevolverEquipamiento(null);
    }

    function manejarDevolucionExitosa(resultado: ResultadoDevolucionEquipamiento) {
        setResultadoDevolucion(resultado);
        setSalidaParaDevolverEquipamiento(null);
    }

    function manejarCancelacionExitosa(resultado: ResultadoCancelarSalida) {
        setResultadoCancelacion(resultado);
        setAdvertenciaCancelacion503(null);
        setSalidaParaCancelar(null);
    }

    function manejarCancelacionConAdvertencia(
        idsalida: number,
        nroSalida: string,
        mensaje: string,
    ) {
        setAdvertenciaCancelacion503({ idsalida, nroSalida, mensaje });
        setResultadoCancelacion(null);
        setSalidaParaCancelar(null);
    }

    function manejarReintentarLiberacionCupos(idsalida: number, nroSalida: string) {
        setIdSalidaReintentandoCupos(idsalida);
        cancelarSalidaMutation.mutate(
            {
                idsalida,
                datos: { motivo: "Reintento de liberación ante la autoridad" },
            },
            {
                onSuccess: (resultado) => {
                    setResultadoCancelacion({
                        idsalida,
                        nroSalida,
                        estado: "CANCELADA",
                        nota: resultado.nota ?? "Cupos liberados ante la autoridad.",
                    });
                    setAdvertenciaCancelacion503(null);
                    setIdSalidaReintentandoCupos(null);
                },
                onError: (error) => {
                    setIdSalidaReintentandoCupos(null);
                    if (error instanceof ErrorApi) {
                        setAdvertenciaCancelacion503({
                            idsalida,
                            nroSalida,
                            mensaje: error.message,
                        });
                    }
                },
            },
        );
    }

    function manejarConfirmarModificacionLogistica(payload: PayloadModificarLogistica) {
        if (!salidaParaModificarLogistica || modificarLogisticaMutation.isPending) return;

        setErrorModificarLogistica("");
        const nroSalida = salidaParaModificarLogistica.nroSalida;
        const idsalida = salidaParaModificarLogistica.idsalida;

        modificarLogisticaMutation.mutate(
            { idsalida, datos: payload },
            {
                onSuccess: (resultado) => {
                    setResultadoModificarLogistica({
                        nroSalida,
                        advertencias: resultado.advertencias ?? [],
                    });
                    setSalidaParaModificarLogistica(null);
                    setErrorModificarLogistica("");
                },
                onError: (error) => {
                    const mensaje =
                        error?.message || "Ocurrió un error al modificar la logística de la salida.";
                    setErrorModificarLogistica(mensaje);
                },
            },
        );
    }

    function manejarConfirmarReemplazo(payload: PayloadConfirmarReemplazo) {
        if (!salidaParaReemplazar || confirmarReemplazoMutation.isPending) return;

        setErrorReemplazo("");
        const nroSalida = salidaParaReemplazar.nroSalida;
        const idsalida = salidaParaReemplazar.idsalida;

        confirmarReemplazoMutation.mutate(
            { idsalida, datos: payload },
            {
                onSuccess: (resultado) => {
                    setResultadoReemplazo({
                        nroSalida,
                        sale: resultado.sale,
                        entra: resultado.entra,
                        permisoDadoDeBaja: resultado.permisoDadoDeBaja,
                        permisoNuevo: resultado.permisoNuevo,
                    });
                    cerrarReemplazo();
                },
                onError: (error) => {
                    const mensaje =
                        error?.message || "Ocurrió un error al realizar el reemplazo de personal.";
                    setErrorReemplazo(mensaje);
                },
            },
        );
    }

    function manejarSolicitarConfirmacionAsignacion(payload: PayloadConfirmarAsignacion) {
        setErrorConfirmacion("");
        setDetalleErrorConfirmacion(null);
        setPayloadConfirmarAsignacion(payload);
    }

    function manejarConfirmarAsignacionDefinitiva() {
        if (
            !salidaParaAsignar ||
            !payloadConfirmarAsignacion ||
            confirmarAsignacionMutation.isPending
        ) {
            return;
        }

        const idsalida = salidaParaAsignar.idsalida;
        const nroSalida = salidaParaAsignar.nroSalida;
        setErrorConfirmacion("");

        confirmarAsignacionMutation.mutate(
            {
                idsalida,
                datos: payloadConfirmarAsignacion,
            },
            {
                onSuccess: (resultado) => {
                    setPayloadConfirmarAsignacion(null);
                    setSalidaParaAsignar(null);
                    setResultadoAsignacion({
                        idsalida,
                        nroSalida: resultado.salida?.nroSalida ?? nroSalida,
                        permisosEmitidos: resultado.permisosEmitidos,
                        rechazados: resultado.rechazados,
                        lugaresLiberados: resultado.lugaresLiberados,
                        estado: resultado.salida?.estado ?? "CERRADA",
                        advertencia: resultado.advertencia,
                    });
                },
                onError: (err: Error) => {
                    setPayloadConfirmarAsignacion(null);
                    const mensaje = err.message || "";
                    const esYaAsignada =
                        mensaje.toLowerCase().includes("ya tiene personal") ||
                        mensaje.toLowerCase().includes("no está activa");

                    if (esYaAsignada) {
                        setSalidaParaAsignar(null);
                        setErrorConfirmacion("");
                        setMensajeSalidaYaAsignada(
                            `La salida ${nroSalida} ya cuenta con personal asignado o se encuentra cerrada. Se actualizó el listado de salidas.`,
                        );
                        queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
                        return;
                    }

                    const esErrorRed =
                        mensaje.toLowerCase().includes("network") ||
                        mensaje.toLowerCase().includes("fetch") ||
                        mensaje.toLowerCase().includes("failed to fetch") ||
                        mensaje.toLowerCase().includes("conexión");

                    if (esErrorRed) {
                        setErrorConfirmacion(
                            "Ocurrió un error de conexión al comunicarse con el servidor. Es posible que la solicitud se haya procesado. Por favor, actualizá los datos o verificá el listado antes de volver a confirmar.",
                        );
                        queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
                        queryClient.invalidateQueries({
                            queryKey: clavesSalidas.asignacion(idsalida),
                        });
                        return;
                    }

                    setErrorConfirmacion(
                        mensaje ||
                            "Ocurrió un error al confirmar la asignación de recursos.",
                    );
                    setDetalleErrorConfirmacion(extraerDetalleConfirmacion(err));
                    queryClient.invalidateQueries({
                        queryKey: clavesSalidas.asignacion(idsalida),
                    });
                },
            },
        );
    }

    function manejarReintentarLiberacion(idsalida: number, nroSalida?: string) {
        setErrorLiberacionSobrantes("");
        setMensajeExitoLiberacion(null);
        setIdSalidaLiberando(idsalida);

        liberarSobrantesMutation.mutate(idsalida, {
            onSuccess: (resultado) => {
                setIdSalidaLiberando(null);
                setResultadoAsignacion((prev) =>
                    prev && prev.idsalida === idsalida
                        ? {
                              ...prev,
                              lugaresLiberados: resultado.lugaresLiberados,
                              advertencia: undefined,
                          }
                        : prev,
                );
                setErrorLiberacionSobrantes("");
                const numero = nroSalida ?? resultadoAsignacion?.nroSalida ?? `ID ${idsalida}`;
                setMensajeExitoLiberacion({
                    nroSalida: numero,
                    lugaresLiberados: resultado.lugaresLiberados,
                });
            },
            onError: (err: Error) => {
                setIdSalidaLiberando(null);
                setErrorLiberacionSobrantes(
                    err.message ||
                        "No fue posible liberar los lugares sobrantes ante la autoridad. Reintentá más tarde.",
                );
            },
        });
    }

    const descripcionDialogoConfirmacion = useMemo(() => {
        if (!salidaParaAsignar || !payloadConfirmarAsignacion) {
            return "";
        }
        const cantPersonal =
            payloadConfirmarAsignacion.personalIds?.length ??
            datosAsignacion?.personal.length ??
            salidaParaAsignar.cantidadPersonal ??
            0;
        const pasajeros =
            datosAsignacion?.pasajerosConfirmados ??
            salidaParaAsignar.pasajerosConfirmados ??
            0;
        const totalNomina = pasajeros + cantPersonal;
        return `¿Confirmás la salida ${salidaParaAsignar.nroSalida}? Se solicitará la emisión de ${totalNomina} permisos nominales ante la autoridad (${pasajeros} pasajeros y ${cantPersonal} de personal asignado), se liberarán los lugares sobrantes del bloqueo y la salida pasará al estado Cerrada.`;
    }, [salidaParaAsignar, payloadConfirmarAsignacion, datosAsignacion]);

    function manejarConfirmarCreacion(datos: DatosCrearSalida) {
        setErrorCreacion("");
        setErrorDetalleEquipo(null);
        crearSalidaMutation.mutate(datos, {
            onSuccess: (resultado) => {
                const numero = resultado.numeroSalida ?? resultado.salida?.nroSalida;
                setMensajeExito({
                    titulo: resultado.mensaje || "Salida creada exitosamente",
                    numeroSalida: numero,
                    fechaInicio: resultado.salida?.fechaInicio,
                    advertencias: resultado.advertencias,
                });
                cerrarFormulario();
            },
            onError: (err: Error) => {
                setErrorCreacion(err.message || "Ocurrió un error al crear la salida.");
                setErrorDetalleEquipo(extraerDetalleEquipo(err));
            },
        });
    }

    // Estos paneles se abren arriba del listado: sin esto, quien tocó el botón más abajo no ve que se abrieron
    const anclaPaneles = useRef<HTMLDivElement>(null);
    const idPanelAbierto =
        salidaParaAsignar?.idsalida ??
        idSalidaReemplazoActivo ??
        salidaParaModificarLogistica?.idsalida;
    const tipoPanelAbierto = salidaParaAsignar ? "asignar" : idSalidaReemplazoActivo ? "reemplazar" : "logistica";
    useEffect(() => {
        if (idPanelAbierto !== undefined) anclaPaneles.current?.scrollIntoView();
    }, [idPanelAbierto, tipoPanelAbierto]);

    const [filtroCircuito, setFiltroCircuito] = useState<number | "">("");
    const [filtroPaquete, setFiltroPaquete] = useState<number | "">("");
    const [filtroEstado, setFiltroEstado] = useState<string>("");
    const [filtroDesde, setFiltroDesde] = useState<string>("");
    const [filtroHasta, setFiltroHasta] = useState<string>("");
    const [filtroGuia, setFiltroGuia] = useState<number | "">("");
    const [vista, setVista] = useState<VistaSalidas>("vigentes");
    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);

    // Opciones para los selectores de filtros
    // FE-50: los filtros también ofrecen circuitos y paquetes dados de baja; para crear salidas, solo los activos
    const { data: circuitos = [], isPending: cargandoCircuitos } = useCircuitos({ estado: "TODOS" });
    const { data: paquetes = [], isPending: cargandoPaquetes } = usePaquetes();
    const { data: paquetesFiltro = [] } = usePaquetes({ estado: "TODOS" });
    const { data: personalGuias = [], isPending: cargandoGuias } = usePersonal({
        rol: "Guía",
    });

    const rangoFechasInvalido = Boolean(
        filtroDesde && filtroHasta && filtroDesde > filtroHasta,
    );

    const filtrosConsulta: FiltrosSalidas = {
        ...(filtroCircuito !== "" ? { idcircuito: Number(filtroCircuito) } : {}),
        ...(filtroPaquete !== "" ? { idpaquete: Number(filtroPaquete) } : {}),
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(!rangoFechasInvalido && filtroDesde ? { desde: filtroDesde } : {}),
        ...(!rangoFechasInvalido && filtroHasta ? { hasta: filtroHasta } : {}),
        ...(filtroGuia !== "" ? { idguia: Number(filtroGuia) } : {}),
    };

    // Mantiene estables los contadores KPI cuando se aplican filtros en la tabla
    const { data: todasLasSalidas = [] } = useSalidas();
    const {
        data: salidas = [],
        isPending,
        isError,
        error,
    } = useSalidas(filtrosConsulta);

    // 12.8: abrir reemplazo automáticamente si se navegó desde PersonalPage (?reemplazarSalida=ID)
    const salidaParaReemplazar =
        salidaParaReemplazarEstado ??
        (idReemplazarDesdeUrl > 0
            ? salidas.find((s) => s.idsalida === idReemplazarDesdeUrl) ?? null
            : null);

    // Consulta de solicitudes de alojamiento para enriquecer con el conteo exacto de solicitudes pendientes
    const { data: solicitudesPendientes = [] } = useQuery({
        queryKey: ["solicitudes"],
        queryFn: listarSolicitudesPendientes,
        retry: 1,
    });

    const solicitudesPorSalida = useMemo(() => {
        return contarSolicitudesPendientesPorSalida(solicitudesPendientes);
    }, [solicitudesPendientes]);

    const hoyActual = fechaLocalHoy();

    const esListaParaConfirmar = useCallback(
        (s: Salida) => {
            const fechaFutura = s.fechaInicio.slice(0, 10) > hoyActual;
            const tieneAdvertenciaPendiente =
                resultadoAsignacion?.advertencia !== undefined &&
                resultadoAsignacion?.idsalida === s.idsalida;
            return (
                esAdmin &&
                s.estado === "PUBLICADA" &&
                fechaFutura &&
                !tieneAdvertenciaPendiente &&
                (s.puedeConfirmar === true ||
                    (s.ventaAbierta === false && s.pasajerosConfirmados > 0))
            );
        },
        [hoyActual, esAdmin, resultadoAsignacion],
    );

    // Contadores KPI clicables sobre todas las salidas (reemplazan el banner ruidoso)
    const metricas = useMemo(() => {
        const base = todasLasSalidas.length > 0 ? todasLasSalidas : salidas;
        const enCurso = base.filter((s) => s.estado === "EN_CURSO");
        const desfasadas = enCurso.filter((s) => s.etapaDesfasada === true).length;
        const conAlertas = base.filter(salidaRequiereAtencion).length;
        const paraConfirmar = base.filter(esListaParaConfirmar).length;
        const publicadasAbiertas = base.filter(
            (s) => s.estado === "PUBLICADA" && s.ventaAbierta !== false,
        ).length;
        return {
            enCurso: enCurso.length,
            desfasadas,
            conAlertas,
            paraConfirmar,
            publicadasAbiertas,
        };
    }, [todasLasSalidas, salidas, esListaParaConfirmar]);

    const hayFiltrosActivos =
        filtroCircuito !== "" ||
        filtroPaquete !== "" ||
        Boolean(filtroEstado) ||
        Boolean(filtroDesde) ||
        Boolean(filtroHasta) ||
        filtroGuia !== "" ||
        Boolean(busqueda) ||
        vista === "confirmar";

    function limpiarFiltros() {
        setFiltroCircuito("");
        setFiltroPaquete("");
        setFiltroEstado("");
        setFiltroDesde("");
        setFiltroHasta("");
        setFiltroGuia("");
        setBusqueda("");
        if (vista === "confirmar") setVista("vigentes");
        setPaginaActual(1);
    }

    // El filtro de estado y la búsqueda piden algo puntual: miran todas las salidas, no solo las de la vista
    const buscaEnTodas = Boolean(filtroEstado) || Boolean(busqueda.trim());
    const salidasVisibles = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();
        const elegidas = salidas.filter((s) => {
            if (termino) {
                const coincideNumero = s.nroSalida.toLowerCase().includes(termino);
                const coincidePaquete = (s.paquete?.nombrePaquete ?? "")
                    .toLowerCase()
                    .includes(termino);
                if (!coincideNumero && !coincidePaquete) return false;
            }
            if (buscaEnTodas) return true;
            if (vista === "alertas") return salidaRequiereAtencion(s);
            if (vista === "confirmar") return esListaParaConfirmar(s);
            return ESTADOS_HISTORIAL.includes(s.estado) === (vista === "historial");
        });
        return ordenarSalidas(elegidas, vista);
    }, [salidas, vista, busqueda, buscaEnTodas, esListaParaConfirmar]);

    const estadoListado = isPending ? "cargando" : isError ? "error" : "exito";
    const totalPaginas = Math.max(1, Math.ceil(salidasVisibles.length / ELEMENTOS_POR_PAGINA));
    const paginaValida = Math.min(paginaActual, totalPaginas);
    const salidasPaginadas = salidasVisibles.slice(
        (paginaValida - 1) * ELEMENTOS_POR_PAGINA,
        paginaValida * ELEMENTOS_POR_PAGINA,
    );
    const sinResultados = estadoListado === "exito" && salidasVisibles.length === 0;

    const columnas = [
        {
            clave: "nroSalida" as const,
            titulo: "Salida y Paquete",
            renderizar: (fila: Salida) => (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                            {fila.nroSalida}
                        </span>
                        {fila.idbloqueo && (
                            <span
                                className="inline-flex items-center whitespace-nowrap text-xs font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 max-md:hidden"
                                title={`Bloqueo ante la autoridad: ${fila.idbloqueo}`}
                            >
                                Bloqueo {fila.idbloqueo}
                            </span>
                        )}
                    </div>
                    <p className="font-semibold text-sm text-texto leading-snug">
                        {fila.paquete?.nombrePaquete ?? "—"}
                    </p>
                    <p className="text-xs text-texto-suave max-md:hidden">
                        {fila.paquete?.nroPaquete ?? `Paquete #${fila.idpaquete}`}
                    </p>
                </div>
            ),
        },
        {
            clave: "fechaInicio" as const,
            titulo: "Fechas",
            renderizar: (fila: Salida) => {
                // El estado real manda: una salida entre sus fechas que el guía no inició no está "en curso"
                const hoy = fechaLocalHoy();
                const inicioStr = fila.fechaInicio.slice(0, 10);
                const finStr = fila.fechaFin.slice(0, 10);
                const alerta = (codigo: string) => fila.alertas?.includes(codigo);
                const diasAntes =
                    fila.estado === "FINALIZADA" && fila.fechaHoraFinReal
                        ? diasEntre(diaLocal(fila.fechaHoraFinReal), finStr)
                        : 0;

                let badgeTiempo = null;
                if (fila.estado === "FINALIZADA") {
                    badgeTiempo = (
                        <span className="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Concluida
                        </span>
                    );
                } else if (alerta("SIN_FINALIZAR")) {
                    badgeTiempo = (
                        <span className="inline-block text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            Vencida sin cerrar
                        </span>
                    );
                } else if (fila.estado === "EN_CURSO") {
                    badgeTiempo = (
                        <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            En curso
                        </span>
                    );
                } else if (alerta("SIN_INICIAR")) {
                    badgeTiempo = (
                        <span className="inline-block text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            {inicioStr === hoy ? "Debía salir hoy" : "Sin iniciar"}
                        </span>
                    );
                } else if (fila.estado !== "CANCELADA") {
                    const dias = diasEntre(hoy, inicioStr);
                    if (dias > 0) {
                        badgeTiempo = (
                            <span className="inline-block text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                En {dias} {dias === 1 ? "día" : "días"}
                            </span>
                        );
                    }
                }

                return (
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-texto">
                                {formatearRangoFechasUtc(fila.fechaInicio, fila.fechaFin)}
                            </span>
                            {badgeTiempo}
                        </div>
                        {fila.fechaHoraInicioReal ? (
                            <p className="text-texto-suave">
                                Inició: {formatearFechaHora(fila.fechaHoraInicioReal)}
                            </p>
                        ) : null}
                        {fila.fechaHoraInicioReal && fila.primerAvance ? (
                            <p className="text-texto-suave">
                                1er avance a las{" "}
                                {Math.max(0, Math.round((new Date(fila.primerAvance).getTime() - new Date(fila.fechaHoraInicioReal).getTime()) / 36e5))}{" "}
                                h
                            </p>
                        ) : null}
                        {diasAntes > 0 ? (
                            <p className="font-semibold text-amber-800">
                                Finalizó {diasAntes} {diasAntes === 1 ? "día" : "días"} antes
                            </p>
                        ) : null}
                    </div>
                );
            },
        },
        {
            clave: "tamanoMaximo" as const,
            titulo: "Ocupación",
            renderizar: (fila: Salida) => {
                const confirmados = fila.pasajerosConfirmados ?? 0;
                const maximo = fila.tamanoMaximo || 1;
                const porcentaje = Math.min(100, Math.round((confirmados / maximo) * 100));

                let colorBarra = "bg-sky-500";
                if (porcentaje >= 100) colorBarra = "bg-rose-500";
                else if (porcentaje >= 60) colorBarra = "bg-emerald-500";
                else if (porcentaje > 0) colorBarra = "bg-amber-500";

                return (
                    <div className="min-w-[130px] space-y-1 text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="font-bold text-sm text-texto">
                                {confirmados}{" "}
                                <span className="font-normal text-xs text-texto-suave">
                                    / {fila.tamanoMaximo} pax
                                </span>
                            </span>
                            <span className="font-semibold text-xs text-texto-suave">
                                {porcentaje}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full ${colorBarra} transition-all duration-300`}
                                style={{ width: `${porcentaje}%` }}
                            />
                        </div>
                        {fila.precioPorPasajero ? (
                            <p className="text-xs text-texto-suave">
                                <span className="font-semibold text-texto">
                                    {formatearMonto(fila.precioPorPasajero.monto, fila.precioPorPasajero.moneda)}
                                </span>{" "}
                                / pax ({fila.precioPorPasajero.temporada})
                                {fila.totalVendido ? (
                                    <span className="block">
                                        {formatearMonto(fila.totalVendido, fila.precioPorPasajero.moneda)} vendidos
                                    </span>
                                ) : null}
                            </p>
                        ) : null}
                        <div className="flex items-center justify-between text-xs text-texto-suave">
                            {/* La venta termina sola en el corte (B4): después del corte ya no se muestran lugares libres */}
                            {fila.estado === "PUBLICADA" && fila.ventaAbierta !== false ? (
                                <>
                                    <span className="max-md:hidden">
                                        {fila.stockLocal} {fila.stockLocal === 1 ? "libre" : "libres"}
                                    </span>
                                    {confirmados === 0 && (
                                        <span className="text-amber-700 font-medium">Sin ventas</span>
                                    )}
                                    {fila.stockLocal === 0 && (
                                        <span className="text-rose-600 font-semibold">Completo</span>
                                    )}
                                </>
                            ) : (
                                fila.estado !== "CANCELADA" && <span>Venta cerrada</span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            clave: "estado" as const,
            titulo: "Estado y Avance",
            renderizar: (fila: Salida) => {
                const informada = fila.etapaInformada ?? fila.ultimaEtapaAlcanzada;
                const esperada = fila.etapaEsperada;
                const desfasada = fila.etapaDesfasada;
                const etapas = fila.paquete.circuito.etapas ?? [];
                const totalEtapas = etapas.length;
                const textoEsperada =
                    esperada !== null
                        ? totalEtapas > 0
                            ? `Etapa ${esperada} de ${totalEtapas} esperada`
                            : `Etapa ${esperada} esperada`
                        : null;
                const llegoA = etapas.find((e) => e.numeroOrden === informada);
                const tramoHoy = etapas.find((e) => e.numeroOrden === esperada);

                return (
                    <div className="space-y-1.5">
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(fila.estado)}`}
                        >
                            {formatearEstadoSalida(fila.estado)}
                        </span>
                        {/* B4: la venta termina sola por fecha; la salida sigue Publicada hasta que el admin la confirma */}
                        {fila.estado === "PUBLICADA" && fila.ventaAbierta === false ? (
                            <span className="block text-xs font-semibold text-amber-800">Venta terminada · falta confirmar</span>
                        ) : null}

                        {fila.estado === "EN_CURSO" && (
                            <div className="text-xs">
                                {desfasada ? (
                                    <div className="flex flex-col gap-0.5">
                                        <span
                                            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
                                            title="Discrepancia entre la etapa informada por el guía y la etapa esperada según itinerario"
                                        >
                                            <span aria-hidden="true">⏱️</span>
                                            <span>
                                                {informada !== null ? `Etapa ${informada}` : "Sin informe"}
                                            </span>
                                            {textoEsperada && (
                                                <span className="font-normal text-amber-700">
                                                    · {textoEsperada}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs font-semibold text-amber-700">
                                            Desfasada
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                            {informada !== null ? `Etapa ${informada}` : "Iniciada"}
                                            {textoEsperada && (
                                                <span className="ml-1 text-emerald-600">
                                                    · {textoEsperada}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-emerald-700 font-medium">
                                            Al día
                                        </span>
                                    </div>
                                )}
                                {(llegoA || tramoHoy) && (
                                    <div className="mt-1 space-y-0.5 text-texto-suave">
                                        {llegoA && <div>Llegó a: <span className="text-texto">{llegoA.puntoFin}</span></div>}
                                        {tramoHoy && (
                                            <div>
                                                Hoy: {tramoHoy.puntoInicio} → {tramoHoy.puntoFin}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            clave: "personalAsignado" as const,
            titulo: "Dotación y Personal",
            renderizar: (fila: Salida) => {
                const dotacion = dotacionDeSalida(fila);
                const totalPersonal = fila.cantidadPersonal ?? dotacion.total;
                const guias =
                    Array.isArray(fila.guias) && fila.guias.length > 0
                        ? fila.guias
                        : nombresGuiasDeSalida(fila);

                if (totalPersonal === 0) {
                    return (
                        <div className="space-y-1 text-xs">
                            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                Sin asignar
                            </span>
                        </div>
                    );
                }

                return (
                    <div className="space-y-1 text-xs">
                        <div className="font-semibold text-texto">
                            {totalPersonal} {totalPersonal === 1 ? "asignado" : "asignados"}
                        </div>
                        {dotacion.total > 0 && (
                            <p className="text-xs text-texto-suave max-md:hidden">
                                {dotacion.guias} {dotacion.guias === 1 ? "guía" : "guías"} ·{" "}
                                {dotacion.porteadores}{" "}
                                {dotacion.porteadores === 1 ? "porteador" : "porteadores"}
                            </p>
                        )}
                        {guias.length > 0 && (
                            <div className="pt-0.5">
                                <p
                                    className="text-xs font-medium text-texto truncate max-w-[170px]"
                                    title={guias.join(", ")}
                                >
                                    <span className="text-texto-suave">Guías: </span>
                                    {guias.join(", ")}
                                </p>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            clave: "permisosFaltantes" as const,
            titulo: "Permisos y Alertas",
            renderizar: (fila: Salida) => {
                const faltantes = fila.permisosFaltantes ?? 0;
                const alertaPermisos = fila.alertas?.includes("PERMISOS_SIN_CONFIRMAR");
                const tieneSobrantes = (fila.lugaresPorLiberar ?? 0) > 0;
                const alertaSol = fila.alertas?.includes("SOLICITUD_PENDIENTE");
                const cantSolicitudes = solicitudesPorSalida.get(fila.idsalida);

                const alertasRecorrido = (fila.alertas ?? []).filter((a) => a in ALERTAS_RECORRIDO);
                const alertasNuevas = (fila.alertas ?? []).filter((a) => a in ALERTAS_OPERATIVAS_NUEVAS);
                const sinNovedades =
                    faltantes === 0 &&
                    !tieneSobrantes &&
                    !alertaSol &&
                    !alertaPermisos &&
                    alertasRecorrido.length === 0 &&
                    alertasNuevas.length === 0;

                if (sinNovedades) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                            <span className="text-emerald-600">✓</span> Al día
                        </span>
                    );
                }

                return (
                    <div className="flex flex-col gap-1 items-start text-xs">
                        {alertasNuevas.map((codigo) => {
                            const cfg = ALERTAS_OPERATIVAS_NUEVAS[codigo]!;
                            const aviso = fila.avisos?.find((av) => av.alerta === codigo);
                            return (
                                <div key={codigo} className="flex flex-col items-start gap-0.5">
                                    <span
                                        title={aviso?.mensaje}
                                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-bold ${cfg.estilo}`}
                                    >
                                        <span>{cfg.etiqueta}</span>
                                    </span>
                                    {aviso?.mensaje && aviso.mensaje !== cfg.etiqueta ? (
                                        <span className="text-[11px] leading-snug text-texto-suave max-w-[200px]">
                                            {aviso.mensaje}
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })}
                        {alertasRecorrido.map((a) => (
                            <span
                                key={a}
                                className="inline-flex items-center gap-1 rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-bold text-rose-900"
                            >
                                <span aria-hidden="true">⚠️</span>
                                <span>{ALERTAS_RECORRIDO[a]}</span>
                            </span>
                        ))}
                        {faltantes > 0 &&
                            (alertaPermisos ? (
                                <span
                                    className="inline-flex items-center gap-1 rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-bold text-rose-900"
                                    title="Alerta operativa: permisos sin emitir dentro de los 7 días previos al inicio"
                                >
                                    <span aria-hidden="true">⚠️</span>
                                    <span>
                                        {faltantes}{" "}
                                        {faltantes === 1
                                            ? "permiso sin emitir"
                                            : "permisos sin emitir"}
                                    </span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    {faltantes}{" "}
                                    {faltantes === 1 ? "permiso faltante" : "permisos faltantes"}
                                </span>
                            ))}

                        {tieneSobrantes && (
                            <span
                                title={`Hay ${fila.lugaresPorLiberar} lugares sobrantes del bloqueo pendientes de liberación`}
                                className="inline-flex items-center gap-1 rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-900"
                            >
                                <span aria-hidden="true">⚠️</span>
                                <span>
                                    {fila.lugaresPorLiberar}{" "}
                                    {fila.lugaresPorLiberar === 1 ? "sobrante" : "sobrantes"}
                                </span>
                            </span>
                        )}

                        {alertaSol && (
                            <Link
                                to="/gestion/solicitudes"
                                title="Solicitudes de alojamiento pendientes en salida próxima (< 7 días)"
                                className="inline-flex items-center gap-1 rounded bg-sky-100 border border-sky-300 px-2 py-0.5 text-xs font-semibold text-sky-900 hover:bg-sky-200 transition-colors"
                            >
                                <span aria-hidden="true">🏨</span>
                                <span>
                                    {cantSolicitudes !== undefined && cantSolicitudes > 0
                                        ? `${cantSolicitudes} sol. hotel`
                                        : "Sol. hotel pend."}
                                </span>
                            </Link>
                        )}
                    </div>
                );
            },
        },
        {
            clave: "idsalida" as const,
            titulo: "Acciones",
            renderizar: (fila: Salida) => {
                // FE-44: una salida cancelada ya no tiene solicitudes para gestionar
                const tieneSolicitudes =
                    fila.estado !== "CANCELADA" &&
                    ((solicitudesPorSalida.get(fila.idsalida) ?? 0) > 0 ||
                        fila.alertas?.includes("SOLICITUD_PENDIENTE"));
                const esFinalizada = fila.estado === "FINALIZADA";

                // CU-40: Confirmar salida (revisar en cualquier momento mientras esté PUBLICADA, confirmar tras el corte)
                const fechaFutura = fila.fechaInicio.slice(0, 10) > fechaLocalHoy();
                const cantPersonal =
                    typeof fila.cantidadPersonal === "number"
                        ? fila.cantidadPersonal
                        : Array.isArray(fila.personalAsignado)
                        ? fila.personalAsignado.length
                        : 0;
                const sinPersonal = cantPersonal === 0;
                const tieneAdvertenciaPendiente =
                    resultadoAsignacion?.advertencia !== undefined &&
                    resultadoAsignacion?.idsalida === fila.idsalida;

                const esPublicadaFutura =
                    esAdmin &&
                    fila.estado === "PUBLICADA" &&
                    fechaFutura &&
                    !tieneAdvertenciaPendiente;

                const ventaCerradaConPasajeros =
                    esPublicadaFutura &&
                    (fila.puedeConfirmar === true || fila.ventaAbierta === false) &&
                    fila.pasajerosConfirmados > 0;
                const tieneBloqueoConfirmacion =
                    tieneSolicitudes ||
                    Boolean(fila.alertas?.includes("FALTA_RECURSO")) ||
                    Boolean(fila.alertas?.includes("PERSONAL_NO_APTO"));
                const listaParaEmitirPermisos =
                    ventaCerradaConPasajeros && !tieneBloqueoConfirmacion;
                const faltaResolverParaConfirmar =
                    esPublicadaFutura && !listaParaEmitirPermisos;

                const tieneSobrantesPendientes = (fila.lugaresPorLiberar ?? 0) > 0;
                const puedeLiberarSobrantes =
                    esAdmin && fila.estado === "CERRADA" && tieneSobrantesPendientes;

                // CU-38: Reemplazar personal
                const estadoReemplazable =
                    fila.estado === "PUBLICADA" || fila.estado === "CERRADA";
                const puedeReemplazarPersonal =
                    esAdmin &&
                    estadoReemplazable &&
                    fechaFutura &&
                    !sinPersonal;

                // CU-39: Modificar logística (también en PUBLICADA — §9.2)
                const puedeModificarLogistica =
                    esAdmin &&
                    (fila.estado === "PUBLICADA" || fila.estado === "CERRADA") &&
                    fechaFutura;

                // CU-37: Cancelar salida
                const estadoCancelable =
                    fila.estado === "PUBLICADA" ||
                    fila.estado === "CERRADA";
                const puedeCancelarSalida =
                    esAdmin &&
                    estadoCancelable &&
                    fechaFutura;

                // Salida ya cancelada con bloqueo pendiente de liberación ante la autoridad (por 503 previo)
                const tieneBloqueoCanceladaPendiente =
                    esAdmin &&
                    fila.estado === "CANCELADA" &&
                    Boolean(fila.idbloqueo);

                // CU-41: Devolver equipamiento
                const yaConcluyo =
                    esFinalizada || fila.fechaFin.slice(0, 10) <= fechaLocalHoy();
                const puedeDevolverEquipamiento =
                    esAdmin &&
                    fila.estado !== "CANCELADA" &&
                    yaConcluyo;

                if (
                    !tieneSolicitudes &&
                    !esFinalizada &&
                    !listaParaEmitirPermisos &&
                    !faltaResolverParaConfirmar &&
                    !puedeLiberarSobrantes &&
                    !puedeReemplazarPersonal &&
                    !puedeModificarLogistica &&
                    !puedeCancelarSalida &&
                    !tieneBloqueoCanceladaPendiente &&
                    !puedeDevolverEquipamiento
                ) {
                    return <span className="text-xs text-texto-suave">—</span>;
                }

                const estaLiberandoEstaSalida =
                    liberarSobrantesMutation.isPending && idSalidaLiberando === fila.idsalida;

                const algunaMutacionPendiente =
                    confirmarAsignacionMutation.isPending ||
                    liberarSobrantesMutation.isPending ||
                    confirmarReemplazoMutation.isPending ||
                    modificarLogisticaMutation.isPending ||
                    cancelarSalidaMutation.isPending;

                // Menú desplegable "Editar": agrupa logística, personal, solicitudes y cancelación
                const accionesEditar: AccionMenuSalida[] = [];

                if (puedeModificarLogistica) {
                    accionesEditar.push({
                        tipo: "boton",
                        id: "modificar-logistica",
                        etiqueta: "Modificar logística",
                        deshabilitado: algunaMutacionPendiente,
                        onClick: () => abrirModificarLogistica(fila),
                    });
                }
                if (puedeReemplazarPersonal) {
                    accionesEditar.push({
                        tipo: "boton",
                        id: "reemplazar-personal",
                        etiqueta: "Reemplazar personal",
                        deshabilitado: algunaMutacionPendiente,
                        onClick: () => abrirReemplazo(fila),
                    });
                }
                if (tieneSolicitudes) {
                    accionesEditar.push({
                        tipo: "enlace",
                        id: "solicitudes",
                        etiqueta: "Ver solicitudes",
                        to: "/gestion/solicitudes",
                    });
                }
                if (esFinalizada) {
                    accionesEditar.push({
                        tipo: "enlace",
                        id: "evaluar",
                        etiqueta: "Evaluar salida",
                        to: "/gestion/evaluaciones",
                    });
                }
                if (puedeCancelarSalida) {
                    accionesEditar.push({
                        tipo: "boton",
                        id: "cancelar-salida",
                        etiqueta: "Cancelar salida",
                        tono: "peligro",
                        deshabilitado: algunaMutacionPendiente,
                        onClick: () => abrirCancelarSalida(fila),
                    });
                }

                return (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {listaParaEmitirPermisos ? (
                            <button
                                type="button"
                                aria-label={`Confirmar salida ${fila.nroSalida}`}
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirAsignacion(fila)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-control bg-marca px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-2xs transition hover:bg-marca-oscura disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span>Confirmar salida</span>
                            </button>
                        ) : faltaResolverParaConfirmar ? (
                            <button
                                type="button"
                                aria-label={`Ver qué falta confirmar en la salida ${fila.nroSalida}`}
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirAsignacion(fila)}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-control border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                    ventaCerradaConPasajeros
                                        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                        : "border-borde bg-slate-50 text-navegacion hover:border-navegacion/30 hover:bg-slate-100"
                                }`}
                            >
                                <span>Qué falta confirmar</span>
                            </button>
                        ) : puedeLiberarSobrantes ? (
                            <button
                                type="button"
                                aria-label={`Liberar lugares sobrantes de la salida ${fila.nroSalida}`}
                                disabled={algunaMutacionPendiente}
                                onClick={() =>
                                    manejarReintentarLiberacion(fila.idsalida, fila.nroSalida)
                                }
                                className="inline-flex cursor-pointer items-center gap-1 rounded-control border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span>
                                    {estaLiberandoEstaSalida ? "Liberando..." : "Liberar sobrantes"}
                                </span>
                            </button>
                        ) : tieneBloqueoCanceladaPendiente ? (
                            <button
                                type="button"
                                aria-label={`Reintentar liberar cupos de la salida ${fila.nroSalida}`}
                                disabled={algunaMutacionPendiente}
                                onClick={() =>
                                    manejarReintentarLiberacionCupos(fila.idsalida, fila.nroSalida)
                                }
                                className="inline-flex cursor-pointer items-center gap-1 rounded-control border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span>
                                    {cancelarSalidaMutation.isPending &&
                                    idSalidaReintentandoCupos === fila.idsalida
                                        ? "Liberando..."
                                        : "Liberar cupos"}
                                </span>
                            </button>
                        ) : puedeDevolverEquipamiento ? (
                            <button
                                type="button"
                                aria-label={`Devolver equipamiento de la salida ${fila.nroSalida}`}
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirDevolucionEquipamiento(fila)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-control border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span>Devolver equipo</span>
                            </button>
                        ) : null}

                        {accionesEditar.length > 0 ? (
                            <MenuAccionesSalida
                                nroSalida={fila.nroSalida}
                                acciones={accionesEditar}
                                etiqueta="Editar"
                                deshabilitado={algunaMutacionPendiente}
                            />
                        ) : null}
                    </div>
                );
            },
        },
    ];

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Operaciones
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">Salidas</h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Seguí las salidas programadas, su personal asignado y el avance del recorrido.
                    </p>
                </div>
                {esAdmin ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                        {solicitudesPendientes.length > 0 ? (
                            <Link
                                to="/gestion/solicitudes"
                                className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-white px-3.5 py-2 text-xs font-semibold text-navegacion transition hover:border-marca/45 hover:bg-marca-suave/50"
                            >
                                <span>Solicitudes de hotel</span>
                                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                    {solicitudesPendientes.length}
                                </span>
                            </Link>
                        ) : null}
                        <Boton
                            onClick={abrirFormulario}
                            disabled={
                                confirmarAsignacionMutation.isPending ||
                                liberarSobrantesMutation.isPending
                            }
                        >
                            + Nueva salida
                        </Boton>
                    </div>
                ) : null}
            </header>

            {mensajeExito ? (
                <Alerta tipo="exito" titulo={mensajeExito.titulo}>
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p>
                                Se creó la salida planificada{" "}
                                <span className="font-bold text-navegacion">
                                    {mensajeExito.numeroSalida ?? "nueva"}
                                </span>
                                {mensajeExito.fechaInicio ? (
                                    <>
                                        {" "}para el día{" "}
                                        <span className="font-semibold">
                                            {formatearFechaUtcCorta(mensajeExito.fechaInicio)}
                                        </span>
                                    </>
                                ) : null}
                                . Ya se encuentra disponible en el listado a continuación.
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setMensajeExito(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>
                        {mensajeExito.advertencias && mensajeExito.advertencias.length > 0 ? (
                            <ul className="list-disc pl-5 text-xs font-medium text-amber-900">
                                {mensajeExito.advertencias.map((adv, idx) => (
                                    <li key={idx}>{adv}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </Alerta>
            ) : null}

            {mensajeExitoLiberacion ? (
                <Alerta tipo="exito" titulo="Lugares sobrantes liberados exitosamente">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                            Se liberaron ante la autoridad{" "}
                            <span className="font-bold">
                                {mensajeExitoLiberacion.lugaresLiberados}{" "}
                                {mensajeExitoLiberacion.lugaresLiberados === 1
                                    ? "lugar sobrante"
                                    : "lugares sobrantes"}
                            </span>{" "}
                            del bloqueo de la salida{" "}
                            <span className="font-bold text-navegacion">
                                {mensajeExitoLiberacion.nroSalida}
                            </span>
                            .
                        </p>
                        <Boton
                            variante="secundario"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => setMensajeExitoLiberacion(null)}
                        >
                            Cerrar aviso
                        </Boton>
                    </div>
                </Alerta>
            ) : null}

            {errorLiberacionSobrantes && !resultadoAsignacion?.advertencia ? (
                <Alerta tipo="error" titulo="Error al liberar lugares sobrantes">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>{errorLiberacionSobrantes}</p>
                        <Boton
                            variante="secundario"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => setErrorLiberacionSobrantes("")}
                        >
                            Cerrar aviso
                        </Boton>
                    </div>
                </Alerta>
            ) : null}

            {formularioAbierto ? (
                <Modal
                    onCerrar={cerrarFormulario}
                    bloqueado={crearSalidaMutation.isPending}
                    tamano="xl"
                    etiqueta="Nueva salida planificada"
                >
                    <FormularioCrearSalida
                        paquetes={paquetes}
                        creando={crearSalidaMutation.isPending}
                        errorServidor={errorCreacion || undefined}
                        errorDetalleEquipo={errorDetalleEquipo}
                        errorEsAutoridad={
                            Boolean(errorCreacion) &&
                            crearSalidaMutation.error instanceof ErrorApi &&
                            crearSalidaMutation.error.estado === 503
                        }
                        alConfirmarCreacion={manejarConfirmarCreacion}
                        alCancelar={cerrarFormulario}
                    />
                </Modal>
            ) : null}

            {mensajeSalidaYaAsignada ? (
                <Alerta tipo="informacion" titulo="Salida ya asignada">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>{mensajeSalidaYaAsignada}</p>
                        <Boton
                            variante="secundario"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => setMensajeSalidaYaAsignada(null)}
                        >
                            Cerrar aviso
                        </Boton>
                    </div>
                </Alerta>
            ) : null}

            {resultadoAsignacion && !resultadoAsignacion.advertencia ? (
                <Alerta
                    tipo="exito"
                    titulo="Asignación confirmada y nómina emitida exitosamente"
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">
                                Se confirmaron los recursos y la dotación definitiva para la salida{" "}
                                <span className="font-bold text-navegacion">
                                    {resultadoAsignacion.nroSalida}
                                </span>
                                .
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setResultadoAsignacion(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 pt-1 border-t border-emerald-200/70 text-xs">
                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Permisos emitidos
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoAsignacion.permisosEmitidos}{" "}
                                    {resultadoAsignacion.permisosEmitidos === 1
                                        ? "permiso nominal"
                                        : "permisos nominales"}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Emitidos ante la autoridad gubernamental
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Lugares liberados
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoAsignacion.lugaresLiberados}{" "}
                                    {resultadoAsignacion.lugaresLiberados === 1
                                        ? "lugar liberado"
                                        : "lugares liberados"}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Cupos sobrantes devueltos del bloqueo
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Estado de la salida
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950 flex items-center gap-1.5">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${estilosEstadoSalida(
                                            resultadoAsignacion.estado,
                                        )}`}
                                    >
                                        {formatearEstadoSalida(resultadoAsignacion.estado)}
                                    </span>
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Venta cerrada y cupo local en 0
                                </p>
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {resultadoAsignacion && resultadoAsignacion.rechazados.length > 0 ? (
                <Alerta tipo="advertencia" titulo="Permisos rechazados">
                    <div className="space-y-2 text-sm">
                        <p>
                            Estas personas no recibieron permiso para la salida{" "}
                            {resultadoAsignacion.nroSalida}.
                        </p>
                        <ul className="list-disc pl-5">
                            {resultadoAsignacion.rechazados.map((r) => (
                                <li key={`${r.tipo}-${r.id}`}>
                                    <span className="font-bold">{r.nombreCompleto}</span>{" "}
                                    ({r.tipo === "PASAJERO" ? "pasajero" : "personal"}): {r.motivo}.{" "}
                                    {r.tipo === "PASAJERO"
                                        ? "Su lugar se libera y no ocupa cupo en la salida."
                                        : 'Su lugar queda reservado para el reemplazo: usá "Reemplazar personal".'}
                                </li>
                            ))}
                        </ul>
                    </div>
                </Alerta>
            ) : null}

            {resultadoAsignacion && resultadoAsignacion.advertencia ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Asignación guardada con advertencia: liberación de cupos pendiente"
                >
                    <div className="space-y-3">
                        <p className="text-sm">
                            La dotación de personal y recursos para la salida{" "}
                            <span className="font-bold text-navegacion">
                                {resultadoAsignacion.nroSalida}
                            </span>{" "}
                            <strong>sí quedó guardada</strong> en el sistema y se emitieron{" "}
                            <strong>
                                {resultadoAsignacion.permisosEmitidos}{" "}
                                {resultadoAsignacion.permisosEmitidos === 1
                                    ? "permiso nominal"
                                    : "permisos nominales"}
                            </strong>
                            . El estado de la salida es{" "}
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${estilosEstadoSalida(
                                    resultadoAsignacion.estado,
                                )}`}
                            >
                                {formatearEstadoSalida(resultadoAsignacion.estado)}
                            </span>
                            .
                        </p>

                        <div className="rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
                            <p className="font-bold">Detalle de la advertencia externa:</p>
                            <p>{resultadoAsignacion.advertencia}</p>
                        </div>

                        {errorLiberacionSobrantes ? (
                            <div className="rounded-control border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900">
                                <p className="font-bold">Error al reintentar la liberación:</p>
                                <p>{errorLiberacionSobrantes}</p>
                            </div>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-amber-300/60">
                            <p className="text-xs text-amber-900 font-medium">
                                Podés reintentar la liberación de los lugares sobrantes ante la autoridad ahora:
                            </p>
                            <div className="flex items-center gap-2">
                                <Boton
                                    variante="secundario"
                                    className="px-2.5 py-1 text-xs"
                                    onClick={() => {
                                        setResultadoAsignacion(null);
                                        setErrorLiberacionSobrantes("");
                                    }}
                                    disabled={liberarSobrantesMutation.isPending}
                                >
                                    Cerrar aviso
                                </Boton>
                                {resultadoAsignacion.idsalida ? (
                                    <Boton
                                        variante="principal"
                                        className="px-3 py-1 text-xs"
                                        cargando={liberarSobrantesMutation.isPending}
                                        disabled={liberarSobrantesMutation.isPending}
                                        onClick={() =>
                                            manejarReintentarLiberacion(
                                                resultadoAsignacion.idsalida,
                                                resultadoAsignacion.nroSalida,
                                            )
                                        }
                                    >
                                        Reintentar liberación de sobrantes
                                    </Boton>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {resultadoReemplazo ? (
                <Alerta
                    tipo="exito"
                    titulo="Reemplazo de personal realizado exitosamente"
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">
                                Se registró correctamente el reemplazo de personal para la salida{" "}
                                <span className="font-bold text-navegacion">
                                    {resultadoReemplazo.nroSalida}
                                </span>
                                .
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setResultadoReemplazo(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-1 border-t border-emerald-200/70 text-xs">
                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Personal saliente
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.sale.nombreCompleto}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Desvinculado de la salida
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Personal ingresante
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.entra.nombreCompleto}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Asignado como reemplazante
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Permiso anterior
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.permisoDadoDeBaja ?? "Sin permiso / N/A"}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    {resultadoReemplazo.permisoDadoDeBaja
                                        ? "Baja informada a la autoridad"
                                        : "No había permiso que dar de baja"}
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Nuevo permiso emitido
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.permisoNuevo ?? "No emitido"}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    {resultadoReemplazo.permisoNuevo
                                        ? "Emitido para el reemplazante"
                                        : "El reemplazante no recibió permiso"}
                                </p>
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {resultadoModificarLogistica ? (
                <Alerta
                    tipo={
                        resultadoModificarLogistica.advertencias.length > 0
                            ? "advertencia"
                            : "exito"
                    }
                    titulo={
                        resultadoModificarLogistica.advertencias.length > 0
                            ? "Logística modificada con observaciones"
                            : "Logística modificada exitosamente"
                    }
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">
                                Se actualizaron los recursos de transporte y equipamiento para la salida{" "}
                                <span className="font-bold text-navegacion">
                                    {resultadoModificarLogistica.nroSalida}
                                </span>
                                .
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setResultadoModificarLogistica(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>

                        {resultadoModificarLogistica.advertencias.length > 0 && (
                            <div className="rounded bg-amber-100/70 border border-amber-300 p-2.5 text-xs text-amber-950 space-y-1">
                                <span className="font-bold uppercase tracking-wider text-[11px] block text-amber-900">
                                    Requerimientos pendientes informados por el sistema:
                                </span>
                                <ul className="list-disc list-inside space-y-0.5 font-medium">
                                    {resultadoModificarLogistica.advertencias.map((adv, i) => (
                                        <li key={i}>{adv}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Alerta>
            ) : null}

            <div ref={anclaPaneles} className="scroll-mt-24" />

            {salidaParaAsignar ? (
                <Modal
                    onCerrar={cerrarAsignacion}
                    bloqueado={confirmarAsignacionMutation.isPending}
                    tamano="xl"
                    etiqueta={`Confirmar salida ${salidaParaAsignar.nroSalida}`}
                >
                    <FormularioAsignarRecursos
                        key={salidaParaAsignar.idsalida}
                        datos={datosAsignacion}
                        idpaquete={salidaParaAsignar.idpaquete}
                        tamanoMaximo={salidaParaAsignar.tamanoMaximo}
                        cargando={cargandoAsignacion}
                        recargando={recargandoAsignacion}
                        guardando={confirmarAsignacionMutation.isPending}
                        errorServidor={
                            errorConfirmacion || (errorAsignacion ? errorAsignacion.message : undefined)
                        }
                        detalleErrorConfirmacion={detalleErrorConfirmacion}
                        onConfirmar={manejarSolicitarConfirmacionAsignacion}
                        onCancelar={cerrarAsignacion}
                        onAbrirReemplazo={() => abrirReemplazo(salidaParaAsignar)}
                        onAbrirLogistica={() => abrirModificarLogistica(salidaParaAsignar)}
                    />
                </Modal>
            ) : null}

            {salidaParaReemplazar ? (
                <Modal
                    onCerrar={cerrarReemplazo}
                    bloqueado={confirmarReemplazoMutation.isPending}
                    tamano="lg"
                    etiqueta={`Reemplazar personal en ${salidaParaReemplazar.nroSalida}`}
                >
                    <FormularioReemplazarPersonal
                        key={salidaParaReemplazar.idsalida}
                        idsalida={salidaParaReemplazar.idsalida}
                        datosPersonal={datosPersonalSalida}
                        cargandoPersonal={cargandoPersonalSalida}
                        errorPersonal={
                            errorPersonalSalida ? errorPersonalSalida.message : undefined
                        }
                        guardando={confirmarReemplazoMutation.isPending}
                        errorReemplazo={errorReemplazo}
                        onRecargarDatos={() => recargarPersonalSalida()}
                        onConfirmarReemplazo={manejarConfirmarReemplazo}
                        onCancelar={cerrarReemplazo}
                    />
                </Modal>
            ) : null}

            {salidaParaModificarLogistica ? (
                <Modal
                    onCerrar={cerrarModificarLogistica}
                    bloqueado={modificarLogisticaMutation.isPending}
                    tamano="xl"
                    etiqueta={`Modificar logística de ${salidaParaModificarLogistica.nroSalida}`}
                >
                    <FormularioModificarLogistica
                        key={salidaParaModificarLogistica.idsalida}
                        idsalida={salidaParaModificarLogistica.idsalida}
                        datosLogistica={datosLogisticaSalida}
                        cargandoLogistica={cargandoLogisticaSalida}
                        errorLogistica={
                            errorLogisticaSalida ? errorLogisticaSalida.message : undefined
                        }
                        guardando={modificarLogisticaMutation.isPending}
                        errorModificacion={errorModificarLogistica}
                        onRecargarDatos={() => recargarLogisticaSalida()}
                        onConfirmarModificacion={manejarConfirmarModificacionLogistica}
                        onCancelar={cerrarModificarLogistica}
                    />
                </Modal>
            ) : null}

            {salidaParaCancelar ? (
                <ModalCancelarSalida
                    key={salidaParaCancelar.idsalida}
                    abierto={salidaParaCancelar !== null}
                    salida={salidaParaCancelar}
                    onCerrar={cerrarCancelarSalida}
                    onCancelacionExitosa={manejarCancelacionExitosa}
                    onCancelacionConAdvertencia={manejarCancelacionConAdvertencia}
                />
            ) : null}

            {salidaParaDevolverEquipamiento ? (
                <ModalDevolucionEquipamiento
                    key={salidaParaDevolverEquipamiento.idsalida}
                    abierto={salidaParaDevolverEquipamiento !== null}
                    salida={salidaParaDevolverEquipamiento}
                    onCerrar={cerrarDevolucionEquipamiento}
                    onDevolucionExitosa={manejarDevolucionExitosa}
                />
            ) : null}

            {/* Aviso de devolución de equipamiento exitosa (CU-41) */}
            {resultadoDevolucion ? (
                <Alerta
                    tipo="exito"
                    titulo="Devolución de equipamiento registrada exitosamente"
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">
                                {resultadoDevolucion.mensaje}
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setResultadoDevolucion(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 pt-1 border-t border-emerald-200/70 text-xs">
                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Artículos devueltos
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.length}{" "}
                                    {resultadoDevolucion.detalle.length === 1 ? "artículo" : "artículos"}
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Registrado en auditoría #{resultadoDevolucion.auditoriaId}
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Reintegradas a stock
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.reduce(
                                        (acc, d) => acc + d.cantidadReintegradaAlStock,
                                        0,
                                    )}{" "}
                                    unidades
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    Reintegradas al stock del proveedor
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                    Dañadas o extraviadas
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.reduce(
                                        (acc, d) => acc + d.cantidadDaniadaOExtraviada,
                                        0,
                                    )}{" "}
                                    unidades
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    No reintegradas (con registro de inspección)
                                </p>
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {/* Aviso de cancelación exitosa (CU-37) */}
            {resultadoCancelacion ? (
                <Alerta tipo="exito" titulo="Salida cancelada exitosamente">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">
                                La salida{" "}
                                <span className="font-bold text-navegacion">
                                    {resultadoCancelacion.nroSalida}
                                </span>{" "}
                                pasó al estado <span className="font-bold text-rose-700">Cancelada</span>.
                                {resultadoCancelacion.reservasCanceladas !== undefined && (
                                    <>
                                        {" "}Se dieron de baja{" "}
                                        <span className="font-bold">
                                            {resultadoCancelacion.reservasCanceladas}{" "}
                                            {resultadoCancelacion.reservasCanceladas === 1
                                                ? "reserva confirmada"
                                                : "reservas confirmadas"}
                                        </span>{" "}
                                        con un reembolso total registrado de{" "}
                                        <span className="font-bold">
                                            {formatearMontoUsd(resultadoCancelacion.reembolsoTotal ?? 0)}
                                        </span>
                                        .
                                    </>
                                )}
                            </p>
                            <Boton
                                variante="secundario"
                                className="px-2.5 py-1 text-xs"
                                onClick={() => setResultadoCancelacion(null)}
                            >
                                Cerrar aviso
                            </Boton>
                        </div>

                        {resultadoCancelacion.notificaciones && (
                            <p className="text-xs text-emerald-900 font-medium">
                                Notificaciones por correo a titulares:{" "}
                                {resultadoCancelacion.notificaciones.enviadas}{" "}
                                {resultadoCancelacion.notificaciones.enviadas === 1
                                    ? "email enviado"
                                    : "emails enviados"}
                                {resultadoCancelacion.notificaciones.fallidas > 0
                                    ? ` (${resultadoCancelacion.notificaciones.fallidas} fallidos)`
                                    : ""}
                                {resultadoCancelacion.notificaciones.salidasAlternativasOfrecidas > 0
                                    ? ` · ${resultadoCancelacion.notificaciones.salidasAlternativasOfrecidas} salidas alternativas informadas`
                                    : ""}
                                .
                            </p>
                        )}

                        {resultadoCancelacion.nota && (
                            <p className="text-xs text-slate-600 italic">
                                {resultadoCancelacion.nota}
                            </p>
                        )}
                    </div>
                </Alerta>
            ) : null}

            {/* Aviso de advertencia 503: salida cancelada pero cupos pendientes */}
            {advertenciaCancelacion503 ? (
                <Alerta
                    tipo="advertencia"
                    titulo={`Salida ${advertenciaCancelacion503.nroSalida} cancelada con cupos pendientes ante la autoridad`}
                >
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm">{advertenciaCancelacion503.mensaje}</p>
                            <div className="flex items-center gap-2">
                                <Boton
                                    variante="principal"
                                    className="px-2.5 py-1 text-xs"
                                    cargando={
                                        cancelarSalidaMutation.isPending &&
                                        idSalidaReintentandoCupos ===
                                            advertenciaCancelacion503.idsalida
                                    }
                                    onClick={() =>
                                        manejarReintentarLiberacionCupos(
                                            advertenciaCancelacion503.idsalida,
                                            advertenciaCancelacion503.nroSalida,
                                        )
                                    }
                                >
                                    Reintentar liberar cupos
                                </Boton>
                                <Boton
                                    variante="secundario"
                                    className="px-2.5 py-1 text-xs"
                                    onClick={() => setAdvertenciaCancelacion503(null)}
                                >
                                    Cerrar aviso
                                </Boton>
                            </div>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {/* 4 TARJETAS KPI CLICABLES (ordenan alertas y contadores sin ruido visual) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                    type="button"
                    onClick={() => {
                        setFiltroEstado((prev) => (prev === "EN_CURSO" ? "" : "EN_CURSO"));
                        setVista("vigentes");
                        setPaginaActual(1);
                    }}
                    className={`group flex cursor-pointer items-start justify-between rounded-tarjeta border p-4 text-left transition ${
                        filtroEstado === "EN_CURSO"
                            ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-borde bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            En curso ahora
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.enCurso}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricas.desfasadas > 0 ? (
                                <span className="font-semibold text-amber-700">
                                    {metricas.desfasadas}{" "}
                                    {metricas.desfasadas === 1 ? "desfasada" : "desfasadas"}
                                </span>
                            ) : metricas.enCurso > 0 ? (
                                <span className="font-medium text-emerald-700">Todas al día</span>
                            ) : (
                                "Sin salidas en ruta"
                            )}
                        </p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                        <span className="size-2 rounded-full bg-emerald-500" />
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setFiltroEstado("");
                        setVista((prev) => (prev === "alertas" ? "vigentes" : "alertas"));
                        setPaginaActual(1);
                    }}
                    className={`group flex cursor-pointer items-start justify-between rounded-tarjeta border p-4 text-left transition ${
                        !buscaEnTodas && vista === "alertas"
                            ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20"
                            : "border-borde bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Requieren atención
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.conAlertas}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricas.conAlertas > 0 ? (
                                <span className="font-semibold text-rose-700">
                                    Alertas, permisos o desfase
                                </span>
                            ) : (
                                <span className="font-medium text-emerald-700">
                                    Todo al día
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`grid size-8 place-items-center rounded-xl text-xs font-bold ring-1 ring-inset ${
                            metricas.conAlertas > 0
                                ? "bg-rose-50 text-rose-700 ring-rose-500/20"
                                : "bg-fondo text-texto-suave ring-borde"
                        }`}
                    >
                        !
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setFiltroEstado("");
                        setVista((prev) => (prev === "confirmar" ? "vigentes" : "confirmar"));
                        setPaginaActual(1);
                    }}
                    className={`group flex cursor-pointer items-start justify-between rounded-tarjeta border p-4 text-left transition ${
                        !buscaEnTodas && vista === "confirmar"
                            ? "border-marca bg-marca-suave/50 ring-2 ring-marca/20"
                            : "border-borde bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Listas para confirmar
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.paraConfirmar}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            {metricas.paraConfirmar > 0 ? (
                                <span className="font-semibold text-marca-oscura">
                                    Venta cerrada · emitir permisos
                                </span>
                            ) : (
                                "Sin cierres pendientes"
                            )}
                        </p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-xl bg-marca-suave text-xs font-bold text-marca-oscura ring-1 ring-inset ring-marca/20">
                        ✓
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setFiltroEstado((prev) => (prev === "PUBLICADA" ? "" : "PUBLICADA"));
                        setVista("vigentes");
                        setPaginaActual(1);
                    }}
                    className={`group flex cursor-pointer items-start justify-between rounded-tarjeta border p-4 text-left transition ${
                        filtroEstado === "PUBLICADA"
                            ? "border-sky-500 bg-sky-50/40 ring-2 ring-sky-500/20"
                            : "border-borde bg-white hover:border-navegacion/25 hover:shadow-xs"
                    }`}
                >
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                            Publicadas abiertas
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tracking-tight text-navegacion">
                            {metricas.publicadasAbiertas}
                        </p>
                        <p className="mt-1 text-xs text-texto-suave">
                            Disponibles en catálogo público
                        </p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-xl bg-sky-50 text-xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/20">
                        ●
                    </span>
                </button>
            </div>

            {rangoFechasInvalido ? (
                <Alerta tipo="error" titulo="Rango de fechas inválido">
                    La fecha desde no puede ser posterior a la fecha hasta.
                </Alerta>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div role="tablist" aria-label="Vista de salidas" className="flex flex-wrap gap-2">
                    {(
                        [
                            { clave: "vigentes", etiqueta: "Vigentes" },
                            {
                                clave: "alertas",
                                etiqueta: "Con alertas",
                                contador: metricas.conAlertas,
                            },
                            { clave: "historial", etiqueta: "Historial" },
                        ] as const
                    ).map((tab) => {
                        const activo = !buscaEnTodas && vista === tab.clave;
                        return (
                            <button
                                key={tab.clave}
                                type="button"
                                role="tab"
                                aria-selected={activo}
                                disabled={buscaEnTodas}
                                onClick={() => {
                                    setVista(tab.clave);
                                    setPaginaActual(1);
                                }}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                                    activo
                                        ? "border-primario bg-primario text-white"
                                        : "border-borde bg-white text-texto-suave hover:bg-slate-100"
                                }`}
                            >
                                <span>{tab.etiqueta}</span>
                                {"contador" in tab && tab.contador > 0 ? (
                                    <span
                                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                            activo
                                                ? "bg-white/20 text-white"
                                                : "bg-rose-100 text-rose-800"
                                        }`}
                                    >
                                        {tab.contador}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <div className="w-full max-w-sm">
                    <label htmlFor="buscar-salida" className="sr-only">
                        Buscar por número de salida
                    </label>
                    <input
                        id="buscar-salida"
                        type="search"
                        value={busqueda}
                        onChange={(evento) => {
                            setBusqueda(evento.target.value);
                            setPaginaActual(1);
                        }}
                        placeholder="Buscar por número de salida..."
                        className="w-full rounded-control border border-borde bg-white px-3.5 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </div>
            </div>

            {/* Panel de Filtros */}
            <div className="grid gap-3 rounded-tarjeta border border-borde bg-white p-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
                <label
                    htmlFor="filtro-circuito"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Circuito
                    <select
                        id="filtro-circuito"
                        value={filtroCircuito}
                        disabled={cargandoCircuitos}
                        onChange={(evento) => {
                            setFiltroCircuito(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los circuitos</option>
                        {circuitos.map((c) => (
                            <option key={c.idcircuito} value={c.idcircuito}>
                                {c.nombreCircuito}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-paquete"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Paquete
                    <select
                        id="filtro-paquete"
                        value={filtroPaquete}
                        disabled={cargandoPaquetes}
                        onChange={(evento) => {
                            setFiltroPaquete(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los paquetes</option>
                        {paquetesFiltro.map((p) => (
                            <option key={p.idpaquete} value={p.idpaquete}>
                                {p.nroPaquete} · {p.nombrePaquete}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-estado"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Estado
                    <select
                        id="filtro-estado"
                        value={filtroEstado}
                        onChange={(evento) => {
                            setFiltroEstado(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los estados</option>
                        {ESTADOS_SALIDA.map((item) => (
                            <option key={item.valor} value={item.valor}>
                                {item.etiqueta}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    htmlFor="filtro-desde"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Fecha desde
                    <input
                        id="filtro-desde"
                        type="date"
                        value={filtroDesde}
                        onChange={(evento) => {
                            setFiltroDesde(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label
                    htmlFor="filtro-hasta"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Fecha hasta
                    <input
                        id="filtro-hasta"
                        type="date"
                        value={filtroHasta}
                        onChange={(evento) => {
                            setFiltroHasta(evento.target.value);
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label
                    htmlFor="filtro-guia"
                    className="grid min-w-0 gap-1 text-xs font-semibold text-texto-suave"
                >
                    Guía asignado
                    <select
                        id="filtro-guia"
                        value={filtroGuia}
                        disabled={cargandoGuias}
                        onChange={(evento) => {
                            setFiltroGuia(
                                evento.target.value ? Number(evento.target.value) : "",
                            );
                            setPaginaActual(1);
                        }}
                        className="w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-slate-50"
                    >
                        <option value="">Todos los guías</option>
                        {personalGuias.map((g) => (
                            <option key={g.idpersonal} value={g.idpersonal}>
                                {g.nombreCompleto}
                            </option>
                        ))}
                    </select>
                </label>

                {hayFiltrosActivos ? (
                    <div className="flex justify-end sm:col-span-2 md:col-span-3 lg:col-span-6">
                        <Boton
                            variante="fantasma"
                            className="text-xs text-texto-suave"
                            onClick={limpiarFiltros}
                        >
                            Limpiar filtros
                        </Boton>
                    </div>
                ) : null}
            </div>

            {/* Listado y Estados */}
            {estadoListado !== "exito" ? (
                <EstadoListado
                    estado={estadoListado}
                    mensaje={estadoListado === "error" ? error?.message : undefined}
                />
            ) : sinResultados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={
                        vista === "confirmar" && !buscaEnTodas
                            ? "No hay salidas listas para confirmar en este momento."
                            : hayFiltrosActivos
                              ? "No se encontraron salidas que coincidan con los filtros seleccionados."
                              : salidas.length > 0
                                ? vista === "alertas"
                                  ? "No hay salidas que requieran atención en este momento."
                                  : `No hay salidas en ${vista === "vigentes" ? "vigentes" : "el historial"}.`
                                : "Todavía no hay salidas registradas."
                    }
                />
            ) : (
                <div className="space-y-4">
                    <div className="overflow-x-auto rounded-tarjeta">
                        <div className="min-w-full w-full">
                            <Tabla
                                filas={salidasPaginadas}
                                columnas={columnas}
                                claseFila={(fila) => {
                                    const tieneAlertas =
                                        Array.isArray(fila.alertas) && fila.alertas.length > 0;
                                    const tieneDesfase = fila.etapaDesfasada === true;
                                    if (tieneAlertas || tieneDesfase) {
                                        return "bg-amber-50/75 hover:bg-amber-100/60 transition-colors";
                                    }
                                    return undefined;
                                }}
                            />
                        </div>
                    </div>

                    <Paginacion
                        paginaActual={paginaValida}
                        totalPaginas={totalPaginas}
                        total={salidasVisibles.length}
                        onCambiarPagina={(nuevaPagina) => setPaginaActual(nuevaPagina)}
                    />
                </div>
            )}

            <DialogoConfirmacion
                abierto={payloadConfirmarAsignacion !== null}
                titulo="Confirmar salida y emitir permisos"
                descripcion={descripcionDialogoConfirmacion}
                textoConfirmar={
                    confirmarAsignacionMutation.isPending
                        ? "Emitiendo permisos..."
                        : "Confirmar salida"
                }
                textoCancelar="Volver a revisar"
                cargando={confirmarAsignacionMutation.isPending}
                onConfirmar={manejarConfirmarAsignacionDefinitiva}
                onCancelar={() => {
                    if (!confirmarAsignacionMutation.isPending) {
                        setPayloadConfirmarAsignacion(null);
                    }
                }}
            />
        </section>
    );
}

export default SalidasPage;
