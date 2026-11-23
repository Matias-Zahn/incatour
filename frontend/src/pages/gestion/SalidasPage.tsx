import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Modal from "../../components/Modal";
import Paginacion from "../../components/Paginacion";
import MenuAccionesSalida, {
    type AccionMenuSalida,
} from "../../components/MenuAccionesSalida";
import ModalDetalleSalida, {
    type AlertaSalidaVisual,
} from "../../components/ModalDetalleSalida";
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
} from "../../services/guiaService";
import {
    formatearFechaUtcCorta,
    formatearRangoFechasUtc,
} from "../../services/formato";
import { usePaquetes } from "../../services/paqueteService";
import { usePersonal } from "../../services/personalService";
import {
    clavesSalidas,
    contarSolicitudesPendientesPorSalida,
    diasFinalizadaAntes,
    dotacionDeSalida,
    nombresGuiasDeSalida,
    salidaRequiereAtencion,
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

const ELEMENTOS_POR_PAGINA = 8;

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
const diasEntre = (desde: string, hasta: string) => Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / DIA_MS);

type VistaSalidas = "vigentes" | "alertas" | "confirmar" | "historial";

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
    { valor: "CERRADA", etiqueta: "Cerrada" },
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
        refetch: recargarAsignacion,
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
    const [filtrosAvanzadosAbiertos, setFiltrosAvanzadosAbiertos] = useState(false);
    const [salidaDetalle, setSalidaDetalle] = useState<Salida | null>(null);
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

    // Comparte caché con BarraSuperior para mantener los KPIs estables al filtrar
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

    // KPIs operativos estables sobre todas las salidas vigentes
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

    const cantidadFiltrosAvanzados = [
        filtroCircuito !== "",
        filtroPaquete !== "",
        Boolean(filtroEstado),
        Boolean(filtroDesde),
        Boolean(filtroHasta),
        filtroGuia !== "",
    ].filter(Boolean).length;

    const hayFiltrosActivos =
        cantidadFiltrosAvanzados > 0 ||
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

    // El filtro de estado y la búsqueda miran todas las salidas (número o paquete)
    const buscaEnTodas = Boolean(filtroEstado) || Boolean(busqueda.trim());
    const salidasVisibles = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();
        const elegidas = salidas.filter((s) => {
            if (termino) {
                const coincideNumero = s.nroSalida.toLowerCase().includes(termino);
                const coincidePaquete = (s.paquete?.nombrePaquete ?? "")
                    .toLowerCase()
                    .includes(termino);
                const coincideCodigo = (s.paquete?.nroPaquete ?? "")
                    .toLowerCase()
                    .includes(termino);
                if (!coincideNumero && !coincidePaquete && !coincideCodigo) {
                    return false;
                }
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

    const algunaMutacionPendiente =
        confirmarAsignacionMutation.isPending ||
        liberarSobrantesMutation.isPending ||
        confirmarReemplazoMutation.isPending ||
        modificarLogisticaMutation.isPending ||
        cancelarSalidaMutation.isPending;

    function construirAlertasSalida(fila: Salida): AlertaSalidaVisual[] {
        const lista: AlertaSalidaVisual[] = [];
        const faltantes = fila.permisosFaltantes ?? 0;
        const alertaPermisos = fila.alertas?.includes("PERMISOS_SIN_CONFIRMAR");
        const tieneSobrantes = (fila.lugaresPorLiberar ?? 0) > 0;
        const alertaSol = fila.alertas?.includes("SOLICITUD_PENDIENTE");
        const cantSolicitudes = solicitudesPorSalida.get(fila.idsalida);

        for (const codigo of (fila.alertas ?? []).filter((a) => a in ALERTAS_OPERATIVAS_NUEVAS)) {
            const cfg = ALERTAS_OPERATIVAS_NUEVAS[codigo]!;
            const aviso = fila.avisos?.find((av) => av.alerta === codigo);
            const severidad =
                codigo === "FALTA_RECURSO" || codigo === "PERSONAL_NO_APTO"
                    ? "critica"
                    : codigo === "PENDIENTE_CONFIRMAR"
                      ? "info"
                      : "advertencia";
            lista.push({
                clave: `op-${codigo}`,
                etiqueta: cfg.etiqueta,
                mensaje: aviso?.mensaje,
                severidad,
            });
        }

        for (const a of (fila.alertas ?? []).filter((x) => x in ALERTAS_RECORRIDO)) {
            lista.push({
                clave: `rec-${a}`,
                etiqueta: ALERTAS_RECORRIDO[a]!,
                severidad: "critica",
            });
        }

        if (faltantes > 0) {
            lista.push({
                clave: "permisos",
                etiqueta: alertaPermisos
                    ? `${faltantes} ${faltantes === 1 ? "permiso sin emitir" : "permisos sin emitir"}`
                    : `${faltantes} ${faltantes === 1 ? "permiso faltante" : "permisos faltantes"}`,
                mensaje: alertaPermisos
                    ? "Permisos sin emitir dentro de los 7 días previos al inicio."
                    : undefined,
                severidad: alertaPermisos ? "critica" : "advertencia",
            });
        }

        if (tieneSobrantes) {
            lista.push({
                clave: "sobrantes",
                etiqueta: `${fila.lugaresPorLiberar} ${fila.lugaresPorLiberar === 1 ? "sobrante" : "sobrantes"}`,
                mensaje: `Hay ${fila.lugaresPorLiberar} lugares sobrantes del bloqueo pendientes de liberación.`,
                severidad: "advertencia",
            });
        }

        if (alertaSol) {
            lista.push({
                clave: "solicitudes",
                etiqueta:
                    cantSolicitudes !== undefined && cantSolicitudes > 0
                        ? `${cantSolicitudes} sol. hotel`
                        : "Sol. hotel pend.",
                mensaje: "Solicitudes de alojamiento pendientes de confirmación hotelera.",
                severidad: "info",
                enlace: { to: "/gestion/solicitudes", texto: "Gestionar solicitudes" },
            });
        }

        if (fila.estado === "EN_CURSO" && fila.etapaDesfasada) {
            lista.push({
                clave: "desfase",
                etiqueta: "Recorrido desfasado",
                mensaje: `Etapa informada: ${fila.etapaInformada ?? "sin informe"} · Etapa esperada: ${fila.etapaEsperada ?? "—"}.`,
                severidad: "advertencia",
            });
        }

        return lista;
    }

    function construirAccionesSalida(fila: Salida) {
        const tieneSolicitudes =
            fila.estado !== "CANCELADA" &&
            ((solicitudesPorSalida.get(fila.idsalida) ?? 0) > 0 ||
                fila.alertas?.includes("SOLICITUD_PENDIENTE"));
        const esFinalizada = fila.estado === "FINALIZADA";
        const fechaFutura = fila.fechaInicio.slice(0, 10) > hoyActual;
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

        const listaParaConfirmar = esListaParaConfirmar(fila);
        const puedeRevisarConfirmacion = esPublicadaFutura && !listaParaConfirmar;
        const tieneSobrantesPendientes = (fila.lugaresPorLiberar ?? 0) > 0;
        const puedeLiberarSobrantes =
            esAdmin && fila.estado === "CERRADA" && tieneSobrantesPendientes;
        const estadoReemplazable =
            fila.estado === "PUBLICADA" || fila.estado === "CERRADA";
        const puedeReemplazarPersonal =
            esAdmin && estadoReemplazable && fechaFutura && !sinPersonal;
        const puedeModificarLogistica =
            esAdmin &&
            (fila.estado === "PUBLICADA" || fila.estado === "CERRADA") &&
            fechaFutura;
        const puedeCancelarSalida =
            esAdmin &&
            (fila.estado === "PUBLICADA" || fila.estado === "CERRADA") &&
            fechaFutura;
        const tieneBloqueoCanceladaPendiente =
            esAdmin && fila.estado === "CANCELADA" && Boolean(fila.idbloqueo);
        const yaConcluyo =
            esFinalizada || fila.fechaFin.slice(0, 10) <= hoyActual;
        const puedeDevolverEquipamiento =
            esAdmin && fila.estado !== "CANCELADA" && yaConcluyo;

        const estaLiberandoEstaSalida =
            liberarSobrantesMutation.isPending && idSalidaLiberando === fila.idsalida;

        // Acción principal contextual (1 sola, clara)
        let principal: {
            etiqueta: string;
            tono: "marca" | "advertencia" | "exito" | "neutro";
            onClick: () => void;
        };

        if (listaParaConfirmar) {
            principal = {
                etiqueta: "Confirmar →",
                tono: "marca",
                onClick: () => abrirAsignacion(fila),
            };
        } else if (puedeLiberarSobrantes) {
            principal = {
                etiqueta: estaLiberandoEstaSalida ? "Liberando..." : "Liberar sobrantes",
                tono: "advertencia",
                onClick: () =>
                    manejarReintentarLiberacion(fila.idsalida, fila.nroSalida),
            };
        } else if (tieneBloqueoCanceladaPendiente) {
            principal = {
                etiqueta:
                    cancelarSalidaMutation.isPending &&
                    idSalidaReintentandoCupos === fila.idsalida
                        ? "Liberando..."
                        : "Liberar cupos",
                tono: "advertencia",
                onClick: () =>
                    manejarReintentarLiberacionCupos(fila.idsalida, fila.nroSalida),
            };
        } else if (puedeDevolverEquipamiento) {
            principal = {
                etiqueta: "Devolver equipo",
                tono: "exito",
                onClick: () => abrirDevolucionEquipamiento(fila),
            };
        } else {
            principal = {
                etiqueta: "Detalle",
                tono: "neutro",
                onClick: () => setSalidaDetalle(fila),
            };
        }

        // Menú secundario completo (⋯)
        const menu: AccionMenuSalida[] = [
            {
                tipo: "boton",
                id: "ver-detalle",
                etiqueta: "Ver detalle completo",
                onClick: () => setSalidaDetalle(fila),
            },
        ];

        if (puedeRevisarConfirmacion) {
            menu.push({
                tipo: "boton",
                id: "revisar-confirmacion",
                etiqueta: "Revisar confirmación",
                deshabilitado: algunaMutacionPendiente,
                onClick: () => abrirAsignacion(fila),
            });
        }
        if (puedeModificarLogistica) {
            menu.push({
                tipo: "boton",
                id: "logistica",
                etiqueta: "Modificar logística",
                deshabilitado: algunaMutacionPendiente,
                onClick: () => abrirModificarLogistica(fila),
            });
        }
        if (puedeReemplazarPersonal) {
            menu.push({
                tipo: "boton",
                id: "reemplazar-personal",
                etiqueta: "Reemplazar personal",
                deshabilitado: algunaMutacionPendiente,
                onClick: () => abrirReemplazo(fila),
            });
        }
        if (tieneSolicitudes) {
            menu.push({
                tipo: "enlace",
                id: "solicitudes",
                etiqueta: "Ver solicitudes de alojamiento",
                to: "/gestion/solicitudes",
            });
        }
        if (esFinalizada) {
            menu.push({
                tipo: "enlace",
                id: "evaluar",
                etiqueta: "Ir a evaluaciones",
                to: "/gestion/evaluaciones",
            });
        }
        if (puedeCancelarSalida) {
            menu.push({
                tipo: "boton",
                id: "cancelar",
                etiqueta: "Cancelar salida",
                tono: "peligro",
                deshabilitado: algunaMutacionPendiente,
                onClick: () => abrirCancelarSalida(fila),
            });
        }

        // Acciones rápidas dentro del modal de detalle
        const accionesDetalle: Array<{
            id: string;
            etiqueta: string;
            variante?: "principal" | "secundario" | "peligro";
            onClick: () => void;
        }> = [];

        if (listaParaConfirmar) {
            accionesDetalle.push({
                id: "confirmar",
                etiqueta: "Confirmar salida →",
                variante: "principal",
                onClick: () => abrirAsignacion(fila),
            });
        } else if (puedeRevisarConfirmacion) {
            accionesDetalle.push({
                id: "revisar",
                etiqueta: "Revisar confirmación",
                variante: "secundario",
                onClick: () => abrirAsignacion(fila),
            });
        }
        if (puedeModificarLogistica) {
            accionesDetalle.push({
                id: "logistica",
                etiqueta: "Modificar logística",
                variante: "secundario",
                onClick: () => abrirModificarLogistica(fila),
            });
        }
        if (puedeReemplazarPersonal) {
            accionesDetalle.push({
                id: "reemplazo",
                etiqueta: "Reemplazar personal",
                variante: "secundario",
                onClick: () => abrirReemplazo(fila),
            });
        }
        if (puedeDevolverEquipamiento) {
            accionesDetalle.push({
                id: "devolver",
                etiqueta: "Devolver equipamiento",
                variante: "principal",
                onClick: () => abrirDevolucionEquipamiento(fila),
            });
        }
        if (puedeCancelarSalida) {
            accionesDetalle.push({
                id: "cancelar",
                etiqueta: "Cancelar salida",
                variante: "peligro",
                onClick: () => abrirCancelarSalida(fila),
            });
        }

        return { principal, menu, accionesDetalle };
    }

    function obtenerBadgeTiempo(fila: Salida) {
        const inicioStr = fila.fechaInicio.slice(0, 10);
        const alerta = (codigo: string) => fila.alertas?.includes(codigo);

        if (fila.estado === "FINALIZADA") {
            return { texto: "Concluida", estilo: "bg-slate-100 text-slate-600" };
        }
        if (alerta("SIN_FINALIZAR")) {
            return { texto: "Vencida sin cerrar", estilo: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-500/25" };
        }
        if (fila.estado === "EN_CURSO") {
            return { texto: "En curso", estilo: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20" };
        }
        if (alerta("SIN_INICIAR")) {
            return {
                texto: inicioStr === hoyActual ? "Debía salir hoy" : "Sin iniciar",
                estilo: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-500/25",
            };
        }
        if (fila.estado !== "CANCELADA") {
            const dias = diasEntre(hoyActual, inicioStr);
            if (dias > 0) {
                return {
                    texto: `En ${dias} ${dias === 1 ? "día" : "días"}`,
                    estilo: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-500/20",
                };
            }
        }
        return null;
    }

    return (
        <section className="mx-auto max-w-[1440px] space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca-oscura">
                        Operación diaria
                    </p>
                    <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-navegacion sm:text-3xl">
                        Salidas
                    </h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        Programación, ocupación, alertas operativas y seguimiento en vivo.
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
                                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">
                                    {solicitudesPendientes.length}
                                </span>
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={abrirFormulario}
                            disabled={
                                confirmarAsignacionMutation.isPending ||
                                liberarSobrantesMutation.isPending
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <span>+ Nueva salida</span>
                        </button>
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
                        onRecargarDatos={() => recargarAsignacion()}
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

            {/* 4 TARJETAS KPI CLICABLES */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                    type="button"
                    onClick={() => {
                        setFiltroEstado((prev) => (prev === "EN_CURSO" ? "" : "EN_CURSO"));
                        setVista("vigentes");
                        setPaginaActual(1);
                    }}
                    className={`group flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroEstado === "EN_CURSO"
                            ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
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
                                <span className="text-emerald-700 font-medium">Todas al día</span>
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
                    className={`group flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        !buscaEnTodas && vista === "alertas"
                            ? "border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
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
                    className={`group flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        !buscaEnTodas && vista === "confirmar"
                            ? "border-marca bg-marca-suave/50 ring-2 ring-marca/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
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
                    className={`group flex cursor-pointer items-start justify-between rounded-2xl border p-4 text-left transition ${
                        filtroEstado === "PUBLICADA"
                            ? "border-sky-500 bg-sky-50/40 ring-2 ring-sky-500/20"
                            : "border-borde/80 bg-white hover:border-navegacion/25 hover:shadow-xs"
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

            {/* BARRA DE HERRAMIENTAS COMPACTA + FILTROS COLAPSABLES */}
            <div className="rounded-2xl border border-borde/80 bg-white p-3.5 shadow-[0_4px_16px_-8px_rgba(18,61,112,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* PÍLDORA SEGMENTADA DE VISTAS */}
                    <div
                        role="tablist"
                        aria-label="Vista de salidas"
                        className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-fondo p-1 ring-1 ring-borde/80"
                    >
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
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        activo
                                            ? "bg-white text-navegacion shadow-2xs ring-1 ring-navegacion/[0.06]"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <span>{tab.etiqueta}</span>
                                    {"contador" in tab && tab.contador > 0 ? (
                                        <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500/12 px-1.5 text-[10.5px] font-bold leading-4 text-rose-700">
                                            {tab.contador}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    {/* BUSCADOR + BOTÓN DE FILTROS AVANZADOS */}
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                        <div className="relative min-w-[210px] flex-1 sm:w-64 sm:flex-initial">
                            <label htmlFor="buscar-salida" className="sr-only">
                                Buscar por número de salida o paquete
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
                                id="buscar-salida"
                                type="search"
                                value={busqueda}
                                onChange={(evento) => {
                                    setBusqueda(evento.target.value);
                                    setPaginaActual(1);
                                }}
                                placeholder="Buscar SAL-2026 o paquete..."
                                className="w-full rounded-xl border border-borde bg-fondo/50 py-2 pl-9 pr-3 text-xs font-medium text-navegacion outline-none placeholder:text-texto-suave/70 transition focus:border-marca focus:bg-white focus:ring-4 focus:ring-marca/15"
                            />
                        </div>

                        <button
                            type="button"
                            aria-expanded={filtrosAvanzadosAbiertos}
                            onClick={() => setFiltrosAvanzadosAbiertos((v) => !v)}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                                filtrosAvanzadosAbiertos || cantidadFiltrosAvanzados > 0
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

                        {hayFiltrosActivos ? (
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-marca-oscura transition hover:bg-marca-suave/60"
                            >
                                Limpiar
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* PANEL DESPLEGABLE DE FILTROS AVANZADOS */}
                {filtrosAvanzadosAbiertos ? (
                    <div className="animar-menu mt-3.5 grid gap-3 border-t border-borde/70 pt-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                        <label
                            htmlFor="filtro-circuito"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
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
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:bg-slate-50"
                            >
                                <option value="">Todos</option>
                                {circuitos.map((c) => (
                                    <option key={c.idcircuito} value={c.idcircuito}>
                                        {c.nombreCircuito}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label
                            htmlFor="filtro-paquete"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
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
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:bg-slate-50"
                            >
                                <option value="">Todos</option>
                                {paquetesFiltro.map((p) => (
                                    <option key={p.idpaquete} value={p.idpaquete}>
                                        {p.nroPaquete} · {p.nombrePaquete}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label
                            htmlFor="filtro-estado"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
                        >
                            Estado
                            <select
                                id="filtro-estado"
                                value={filtroEstado}
                                onChange={(evento) => {
                                    setFiltroEstado(evento.target.value);
                                    setPaginaActual(1);
                                }}
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
                            >
                                <option value="">Todos</option>
                                {ESTADOS_SALIDA.map((item) => (
                                    <option key={item.valor} value={item.valor}>
                                        {item.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label
                            htmlFor="filtro-desde"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
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
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
                            />
                        </label>

                        <label
                            htmlFor="filtro-hasta"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
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
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15"
                            />
                        </label>

                        <label
                            htmlFor="filtro-guia"
                            className="grid min-w-0 gap-1 text-[11px] font-semibold uppercase tracking-wide text-texto-suave"
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
                                className="w-full min-w-0 rounded-xl border border-borde bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-navegacion outline-none focus:border-marca focus:ring-4 focus:ring-marca/15 disabled:bg-slate-50"
                            >
                                <option value="">Todos</option>
                                {personalGuias.map((g) => (
                                    <option key={g.idpersonal} value={g.idpersonal}>
                                        {g.nombreCompleto}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : null}

                {/* CHIPS DE FILTRO ACTIVO CUANDO EL CAJÓN ESTÁ CERRADO */}
                {!buscaEnTodas && vista === "confirmar" ? (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-borde/60 pt-2.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-marca-suave px-2.5 py-0.5 font-semibold text-navegacion">
                            Mostrando salidas listas para confirmar (CU-40)
                            <button
                                type="button"
                                onClick={() => setVista("vigentes")}
                                className="cursor-pointer text-marca-oscura hover:text-navegacion"
                                aria-label="Quitar filtro de confirmación"
                            >
                                ✕
                            </button>
                        </span>
                    </div>
                ) : null}
            </div>

            {/* LISTADO MODERNO DE 5 COLUMNAS */}
            {estadoListado !== "exito" ? (
                <EstadoListado
                    estado={estadoListado}
                    mensaje={estadoListado === "error" ? error?.message : undefined}
                />
            ) : sinResultados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={
                        hayFiltrosActivos
                            ? "No se encontraron salidas que coincidan con los filtros seleccionados."
                            : vista === "alertas"
                              ? "No hay salidas con alertas operativas pendientes."
                              : salidas.length > 0
                                ? `No hay salidas en ${vista === "vigentes" ? "vigentes" : "el historial"}.`
                                : "Todavía no hay salidas registradas."
                    }
                />
            ) : (
                <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-borde/80 bg-white shadow-[0_6px_24px_-10px_rgba(18,61,112,0.08)] max-md:overflow-visible max-md:border-0 max-md:bg-transparent max-md:shadow-none">
                        <table className="w-full text-left max-md:block">
                            <thead className="border-b border-borde/80 bg-fondo/80 text-[11px] font-bold uppercase tracking-wider text-texto-suave max-md:hidden">
                                <tr>
                                    <th className="px-5 py-3.5">Salida y fechas</th>
                                    <th className="px-4 py-3.5">Estado y avance</th>
                                    <th className="px-4 py-3.5">Ocupación y equipo</th>
                                    <th className="px-4 py-3.5">Alertas</th>
                                    <th className="px-5 py-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-borde/70 max-md:flex max-md:flex-col max-md:gap-3 max-md:divide-y-0">
                                {salidasPaginadas.map((fila) => {
                                    const alertas = construirAlertasSalida(fila);
                                    const { principal, menu } = construirAccionesSalida(fila);
                                    const badgeTiempo = obtenerBadgeTiempo(fila);
                                    const tieneCritica = alertas.some((a) => a.severidad === "critica");
                                    const tieneAviso = alertas.length > 0;

                                    const confirmados = fila.pasajerosConfirmados ?? 0;
                                    const maximo = fila.tamanoMaximo || 1;
                                    const porcentaje = Math.min(
                                        100,
                                        Math.round((confirmados / maximo) * 100),
                                    );
                                    const colorBarra =
                                        porcentaje >= 100
                                            ? "bg-rose-500"
                                            : porcentaje >= 60
                                              ? "bg-emerald-500"
                                              : porcentaje > 0
                                                ? "bg-amber-500"
                                                : "bg-slate-300";

                                    const dotacion = dotacionDeSalida(fila);
                                    const totalPersonal = fila.cantidadPersonal ?? dotacion.total;
                                    const guias =
                                        Array.isArray(fila.guias) && fila.guias.length > 0
                                            ? fila.guias
                                            : nombresGuiasDeSalida(fila);

                                    const informada =
                                        fila.etapaInformada ?? fila.ultimaEtapaAlcanzada;
                                    const totalEtapas =
                                        fila.paquete?.circuito?.etapas?.length ?? 0;
                                    const diasAntes = diasFinalizadaAntes(fila);

                                    const bordeAlerta = tieneCritica
                                        ? "border-l-[3px] border-l-rose-500"
                                        : tieneAviso
                                          ? "border-l-[3px] border-l-amber-400"
                                          : "border-l-[3px] border-l-transparent";

                                    return (
                                        <tr
                                            key={fila.idsalida}
                                            className={`group bg-white transition-colors hover:bg-fondo/45 max-md:block max-md:rounded-2xl max-md:border max-md:border-borde/80 max-md:p-4 max-md:shadow-xs ${bordeAlerta}`}
                                        >
                                            {/* COL 1: SALIDA Y FECHAS */}
                                            <td className="px-5 py-4 align-middle max-md:block max-md:p-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setSalidaDetalle(fila)}
                                                    className="group/titulo cursor-pointer text-left"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-bold text-navegacion transition group-hover/titulo:text-marca-oscura">
                                                            {fila.nroSalida}
                                                        </span>
                                                        {badgeTiempo ? (
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTiempo.estilo}`}
                                                            >
                                                                {badgeTiempo.texto}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-1 text-sm font-semibold leading-snug text-texto transition group-hover/titulo:text-navegacion">
                                                        {fila.paquete?.nombrePaquete ?? "—"}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-texto-suave">
                                                        {formatearRangoFechasUtc(
                                                            fila.fechaInicio,
                                                            fila.fechaFin,
                                                        )}
                                                    </p>
                                                    {diasAntes > 0 ? (
                                                        <p className="mt-1 text-xs font-semibold text-amber-800">
                                                            Finalizó {diasAntes}{" "}
                                                            {diasAntes === 1 ? "día" : "días"} antes
                                                        </p>
                                                    ) : null}
                                                </button>
                                            </td>

                                            {/* COL 2: ESTADO Y AVANCE */}
                                            <td className="px-4 py-4 align-middle max-md:mt-3 max-md:flex max-md:items-center max-md:justify-between max-md:p-0">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave md:hidden">
                                                    Estado
                                                </span>
                                                <div className="flex flex-col items-start gap-1.5 max-md:items-end">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(fila.estado)}`}
                                                    >
                                                        {formatearEstadoSalida(fila.estado)}
                                                    </span>
                                                    {fila.estado === "EN_CURSO" ? (
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                                fila.etapaDesfasada
                                                                    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/25"
                                                                    : "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
                                                            }`}
                                                        >
                                                            {informada !== null
                                                                ? `Etapa ${informada}${totalEtapas > 0 ? `/${totalEtapas}` : ""}`
                                                                : "Iniciada"}{" "}
                                                            ·{" "}
                                                            {fila.etapaDesfasada
                                                                ? "Desfasada"
                                                                : "Al día"}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            {/* COL 3: OCUPACIÓN Y EQUIPO */}
                                            <td className="px-4 py-4 align-middle max-md:mt-3 max-md:block max-md:p-0">
                                                <div className="min-w-[155px] space-y-1.5 text-xs">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="font-bold text-navegacion">
                                                            {confirmados}
                                                            <span className="font-normal text-texto-suave">
                                                                /{fila.tamanoMaximo} pax
                                                            </span>
                                                        </span>
                                                        <span className="text-[11px] font-semibold text-texto-suave">
                                                            {porcentaje}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fondo ring-1 ring-borde/50">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${colorBarra}`}
                                                            style={{ width: `${porcentaje}%` }}
                                                        />
                                                    </div>
                                                    <p
                                                        className="truncate text-[11.5px] text-texto-suave max-w-[190px]"
                                                        title={
                                                            guias.length > 0
                                                                ? `Guías: ${guias.join(", ")} (${totalPersonal} en total)`
                                                                : undefined
                                                        }
                                                    >
                                                        {totalPersonal === 0 ? (
                                                            <span>Sin personal asignado</span>
                                                        ) : guias.length > 0 ? (
                                                            <>
                                                                <span className="font-medium text-texto">
                                                                    {guias[0]}
                                                                </span>
                                                                {totalPersonal > 1
                                                                    ? ` · +${totalPersonal - 1}`
                                                                    : ""}
                                                            </>
                                                        ) : (
                                                            <span>
                                                                {totalPersonal}{" "}
                                                                {totalPersonal === 1
                                                                    ? "asignado"
                                                                    : "asignados"}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </td>

                                            {/* COL 4: ALERTAS (MÁX 2 PILLS + +N) */}
                                            <td className="px-4 py-4 align-middle max-md:mt-3 max-md:block max-md:p-0">
                                                {alertas.length === 0 ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-fondo px-2.5 py-0.5 text-xs font-medium text-texto-suave">
                                                        <span className="text-exito">✓</span> Al día
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {alertas.slice(0, 2).map((alerta) => (
                                                            <button
                                                                key={alerta.clave}
                                                                type="button"
                                                                title={alerta.mensaje ?? alerta.etiqueta}
                                                                onClick={() => setSalidaDetalle(fila)}
                                                                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition hover:brightness-95 ${
                                                                    alerta.severidad === "critica"
                                                                        ? "bg-rose-50 text-rose-800 ring-rose-500/25"
                                                                        : alerta.severidad === "advertencia"
                                                                          ? "bg-amber-50 text-amber-900 ring-amber-500/25"
                                                                          : "bg-sky-50 text-sky-800 ring-sky-500/25"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`size-1.5 rounded-full ${
                                                                        alerta.severidad === "critica"
                                                                            ? "bg-rose-500"
                                                                            : alerta.severidad === "advertencia"
                                                                              ? "bg-amber-500"
                                                                              : "bg-sky-500"
                                                                    }`}
                                                                    aria-hidden="true"
                                                                />
                                                                <span>{alerta.etiqueta}</span>
                                                            </button>
                                                        ))}
                                                        {alertas.length > 2 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSalidaDetalle(fila)}
                                                                className="cursor-pointer rounded-full bg-fondo px-2 py-0.5 text-[11px] font-bold text-navegacion ring-1 ring-borde transition hover:bg-marca-suave"
                                                                title={`Ver los ${alertas.length} avisos`}
                                                            >
                                                                +{alertas.length - 2}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </td>

                                            {/* COL 5: ACCIÓN PRINCIPAL + MENÚ ⋯ */}
                                            <td className="px-5 py-4 align-middle max-md:mt-3.5 max-md:border-t max-md:border-borde/70 max-md:px-0 max-md:pb-0 max-md:pt-3">
                                                <div className="flex items-center justify-end gap-2 max-md:justify-between">
                                                    {principal ? (
                                                        <button
                                                            type="button"
                                                            disabled={algunaMutacionPendiente}
                                                            onClick={principal.onClick}
                                                            className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                                                principal.tono === "marca"
                                                                    ? "bg-gradient-to-r from-navegacion to-marca-oscura text-white shadow-2xs hover:brightness-110"
                                                                    : principal.tono === "advertencia"
                                                                      ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-100"
                                                                      : principal.tono === "exito"
                                                                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/25 hover:bg-emerald-100"
                                                                        : "border border-borde bg-white text-navegacion hover:bg-fondo"
                                                            }`}
                                                        >
                                                            {principal.etiqueta}
                                                        </button>
                                                    ) : null}

                                                    <MenuAccionesSalida
                                                        nroSalida={fila.nroSalida}
                                                        acciones={menu}
                                                        deshabilitado={algunaMutacionPendiente}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Paginacion
                        paginaActual={paginaValida}
                        totalPaginas={totalPaginas}
                        total={salidasVisibles.length}
                        onCambiarPagina={(nuevaPagina) => setPaginaActual(nuevaPagina)}
                    />
                </div>
            )}

            {/* MODAL DE DETALLE RÁPIDO DE SALIDA */}
            {salidaDetalle ? (
                <ModalDetalleSalida
                    salida={salidaDetalle}
                    alertas={construirAlertasSalida(salidaDetalle)}
                    acciones={construirAccionesSalida(salidaDetalle).accionesDetalle}
                    onCerrar={() => setSalidaDetalle(null)}
                />
            ) : null}

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
