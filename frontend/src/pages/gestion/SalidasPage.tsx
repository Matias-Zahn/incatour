import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
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
    formatearFechaSalida,
} from "../../services/guiaService";
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
    useOpcionesSalida,
    usePanelAsignacion,
    usePanelLogistica,
    usePersonalSalida,
    useSalidas,
    useCancelarSalida,
    type DatosCrearSalida,
    type FiltrosSalidas,
    type ParametrosConsultaOpciones,
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

/** Lo que está en curso va arriba y después lo más cercano; en el historial, lo más reciente primero */
function ordenarSalidas(salidas: Salida[], vista: "vigentes" | "historial") {
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

    // Estados para la creación de salidas (CU-36)
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [parametrosConsulta, setParametrosConsulta] =
        useState<ParametrosConsultaOpciones | null>(null);
    const [errorCreacion, setErrorCreacion] = useState("");
    const [mensajeExito, setMensajeExito] = useState<{
        titulo: string;
        numeroSalida?: string;
        fechaInicio?: string;
    } | null>(null);

    const {
        data: opcionesSalida,
        isFetching: cargandoOpciones,
        error: errorOpciones,
        refetch: refrescarOpciones,
    } = useOpcionesSalida(parametrosConsulta);

    const crearSalidaMutation = useCrearSalida();

    // Estados para la asignación de recursos (CU-40)
    const [salidaParaAsignar, setSalidaParaAsignar] = useState<Salida | null>(null);
    const [payloadConfirmarAsignacion, setPayloadConfirmarAsignacion] =
        useState<PayloadConfirmarAsignacion | null>(null);
    const [errorConfirmacion, setErrorConfirmacion] = useState("");
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
    const [salidaParaReemplazar, setSalidaParaReemplazar] = useState<Salida | null>(null);
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
    } = usePersonalSalida(salidaParaReemplazar?.idsalida ?? null);

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
        setParametrosConsulta(null);
        setErrorCreacion("");
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
        setParametrosConsulta(null);
        setErrorCreacion("");
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
                    setSalidaParaReemplazar(null);
                    setErrorReemplazo("");
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
        const cantPersonal = payloadConfirmarAsignacion.personalIds.length;
        const pasajeros =
            datosAsignacion?.pasajerosConfirmados ??
            salidaParaAsignar.pasajerosConfirmados ??
            0;
        const totalNomina = pasajeros + cantPersonal;
        return `¿Estás seguro de que deseás confirmar la dotación y recursos para la salida ${salidaParaAsignar.nroSalida}? Se solicitará la emisión de ${totalNomina} permisos nominales ante la autoridad externa (${pasajeros} pasajeros y ${cantPersonal} de personal asignado), se liberarán los lugares sobrantes del bloqueo y la salida pasará al estado Cerrada. Esta acción no se puede deshacer desde este formulario.`;
    }, [salidaParaAsignar, payloadConfirmarAsignacion, datosAsignacion]);

    function manejarConfirmarCreacion(datos: DatosCrearSalida) {
        setErrorCreacion("");
        crearSalidaMutation.mutate(datos, {
            onSuccess: (resultado) => {
                const numero = resultado.numeroSalida ?? resultado.salida?.nroSalida;
                setMensajeExito({
                    titulo: resultado.mensaje || "Salida creada exitosamente",
                    numeroSalida: numero,
                    fechaInicio: resultado.salida?.fechaInicio,
                });
                cerrarFormulario();
            },
            onError: (err: Error) => {
                setErrorCreacion(err.message || "Ocurrió un error al crear la salida.");
            },
        });
    }

    const [filtroCircuito, setFiltroCircuito] = useState<number | "">("");
    const [filtroPaquete, setFiltroPaquete] = useState<number | "">("");
    const [filtroEstado, setFiltroEstado] = useState<string>("");
    const [filtroDesde, setFiltroDesde] = useState<string>("");
    const [filtroHasta, setFiltroHasta] = useState<string>("");
    const [filtroGuia, setFiltroGuia] = useState<number | "">("");
    const [vista, setVista] = useState<"vigentes" | "historial">("vigentes");
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

    const {
        data: salidas = [],
        isPending,
        isError,
        error,
    } = useSalidas(filtrosConsulta);

    // Consulta de solicitudes de alojamiento para enriquecer con el conteo exacto de solicitudes pendientes
    const { data: solicitudesPendientes = [] } = useQuery({
        queryKey: ["solicitudes"],
        queryFn: listarSolicitudesPendientes,
        retry: 1,
    });

    const solicitudesPorSalida = useMemo(() => {
        return contarSolicitudesPendientesPorSalida(solicitudesPendientes);
    }, [solicitudesPendientes]);

    // Advertencias operativas basadas en salida.alertas provistas por el backend (RF-61)
    const salidasConAlertasOperativas = useMemo(() => {
        return salidas.filter((s) => Array.isArray(s.alertas) && s.alertas.length > 0);
    }, [salidas]);

    const hayFiltrosActivos =
        filtroCircuito !== "" ||
        filtroPaquete !== "" ||
        Boolean(filtroEstado) ||
        Boolean(filtroDesde) ||
        Boolean(filtroHasta) ||
        filtroGuia !== "" ||
        Boolean(busqueda);

    function limpiarFiltros() {
        setFiltroCircuito("");
        setFiltroPaquete("");
        setFiltroEstado("");
        setFiltroDesde("");
        setFiltroHasta("");
        setFiltroGuia("");
        setBusqueda("");
        setPaginaActual(1);
    }

    // El filtro de estado y la búsqueda piden algo puntual: miran todas las salidas, no solo las de la vista
    const buscaEnTodas = Boolean(filtroEstado) || Boolean(busqueda.trim());
    const salidasVisibles = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();
        const elegidas = salidas.filter((s) =>
            buscaEnTodas
                ? s.nroSalida.toLowerCase().includes(termino)
                : ESTADOS_HISTORIAL.includes(s.estado) === (vista === "historial"),
        );
        return ordenarSalidas(elegidas, vista);
    }, [salidas, vista, busqueda, buscaEnTodas]);

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
                                className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                                title={`Bloqueo Serfor/Dircetur: ${fila.idbloqueo}`}
                            >
                                Bloq: {fila.idbloqueo}
                            </span>
                        )}
                    </div>
                    <p className="font-semibold text-sm text-texto leading-snug">
                        {fila.paquete?.nombrePaquete ?? "—"}
                    </p>
                    <p className="text-xs text-texto-suave">
                        {fila.paquete?.nroPaquete ?? `Paquete #${fila.idpaquete}`}
                    </p>
                </div>
            ),
        },
        {
            clave: "fechaInicio" as const,
            titulo: "Fechas",
            renderizar: (fila: Salida) => {
                const hoy = fechaLocalHoy();
                const inicioStr = fila.fechaInicio.slice(0, 10);
                const finStr = fila.fechaFin.slice(0, 10);
                const esFinalizada = fila.estado === "FINALIZADA" || finStr < hoy;
                const esEnCurso = fila.estado === "EN_CURSO" || (inicioStr <= hoy && finStr >= hoy);

                let badgeTiempo = null;
                if (esFinalizada) {
                    badgeTiempo = (
                        <span className="inline-block text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Concluida
                        </span>
                    );
                } else if (esEnCurso) {
                    badgeTiempo = (
                        <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            En curso
                        </span>
                    );
                } else if (inicioStr === hoy) {
                    badgeTiempo = (
                        <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Sale hoy
                        </span>
                    );
                } else {
                    const diffMs = new Date(inicioStr).getTime() - new Date(hoy).getTime();
                    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (dias > 0) {
                        badgeTiempo = (
                            <span className="inline-block text-[10px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                En {dias} {dias === 1 ? "día" : "días"}
                            </span>
                        );
                    }
                }

                return (
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-texto whitespace-nowrap">
                                {formatearFechaSalida(fila.fechaInicio)}
                            </span>
                            {badgeTiempo}
                        </div>
                        <p className="text-texto-suave whitespace-nowrap">
                            Hasta: {formatearFechaSalida(fila.fechaFin)}
                        </p>
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
                            <span className="font-semibold text-[11px] text-texto-suave">
                                {porcentaje}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full ${colorBarra} transition-all duration-300`}
                                style={{ width: `${porcentaje}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-texto-suave">
                            <span>Disp: {fila.stockLocal}</span>
                            {confirmados === 0 && (
                                <span className="text-amber-700 font-medium">Sin ventas</span>
                            )}
                            {fila.stockLocal === 0 && (
                                <span className="text-rose-600 font-semibold">Completo</span>
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

                return (
                    <div className="space-y-1.5">
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(fila.estado)}`}
                        >
                            {formatearEstadoSalida(fila.estado)}
                        </span>

                        {fila.estado === "EN_CURSO" && (
                            <div className="text-xs">
                                {desfasada ? (
                                    <div className="flex flex-col gap-0.5">
                                        <span
                                            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                                            title="Discrepancia entre la etapa informada por el guía y la etapa esperada según itinerario"
                                        >
                                            <span aria-hidden="true">⏱️</span>
                                            <span>
                                                {informada !== null ? `Etapa ${informada}` : "Sin informe"}
                                            </span>
                                            {esperada !== null && (
                                                <span className="font-normal text-amber-700">
                                                    (Esp: {esperada})
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-[10px] font-semibold text-amber-700">
                                            Desfasada
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                            {informada !== null ? `Etapa ${informada}` : "Iniciada"}
                                            {esperada !== null && (
                                                <span className="ml-1 text-emerald-600">
                                                    (Esp: {esperada})
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-[10px] text-emerald-700 font-medium">
                                            Al día
                                        </span>
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
                            <p className="text-[11px] text-texto-suave">
                                {dotacion.guias} {dotacion.guias === 1 ? "guía" : "guías"} ·{" "}
                                {dotacion.porteadores}{" "}
                                {dotacion.porteadores === 1 ? "porteador" : "porteadores"}
                            </p>
                        )}
                        {guias.length > 0 && (
                            <div className="pt-0.5">
                                <p
                                    className="text-[11px] font-medium text-texto truncate max-w-[170px]"
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

                const sinNovedades =
                    faltantes === 0 && !tieneSobrantes && !alertaSol && !alertaPermisos;

                if (sinNovedades) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                            <span className="text-emerald-600">✓</span> Al día
                        </span>
                    );
                }

                return (
                    <div className="flex flex-col gap-1 items-start text-xs">
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

                // CU-40: Una salida admite asignación si está activa (PUBLICADA o CERRADA),
                // tiene fecha futura y no tiene personal asignado aún.
                const estadoAsignable = fila.estado === "PUBLICADA" || fila.estado === "CERRADA";
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

                // Si cumple las condiciones para ser asignable pero aún no tiene compras (pasajeros === 0),
                // mostramos el botón deshabilitado con explicación para no confundir al usuario.
                const baseAsignable =
                    esAdmin &&
                    estadoAsignable &&
                    fechaFutura &&
                    sinPersonal &&
                    !tieneAdvertenciaPendiente;

                const puedeAsignar = baseAsignable && fila.pasajerosConfirmados > 0;
                const requierePasajerosParaAsignar =
                    baseAsignable && fila.pasajerosConfirmados === 0;

                const tieneSobrantesPendientes = (fila.lugaresPorLiberar ?? 0) > 0;
                const puedeLiberarSobrantes =
                    esAdmin && fila.estado === "CERRADA" && tieneSobrantesPendientes;

                // CU-38: Reemplazar personal
                const estadoReemplazable =
                    fila.estado === "PUBLICADA" || fila.estado === "ABIERTA" || fila.estado === "CERRADA";
                const puedeReemplazarPersonal =
                    esAdmin &&
                    estadoReemplazable &&
                    fechaFutura &&
                    !sinPersonal;

                // CU-39: Modificar logística
                const puedeModificarLogistica =
                    esAdmin &&
                    fila.estado === "CERRADA" &&
                    fechaFutura;

                // CU-37: Cancelar salida
                const estadoCancelable =
                    fila.estado === "PUBLICADA" ||
                    fila.estado === "ABIERTA" ||
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
                    !puedeAsignar &&
                    !requierePasajerosParaAsignar &&
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

                return (
                    <div className="flex flex-col gap-1.5 items-start text-xs font-semibold">
                        {puedeAsignar && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirAsignacion(fila)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-marca text-white font-semibold text-xs shadow-sm hover:bg-marca-oscura transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <span>Asignar recursos</span>
                                <span aria-hidden="true">→</span>
                            </button>
                        )}

                        {requierePasajerosParaAsignar && (
                            <div className="flex flex-col items-start gap-0.5">
                                <button
                                    type="button"
                                    disabled
                                    title="No se pueden asignar recursos ni emitir nómina sin pasajeros confirmados."
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-400 font-semibold text-xs cursor-not-allowed border border-slate-200"
                                >
                                    <span>Asignar recursos</span>
                                </button>
                                <span className="text-[10px] text-amber-700 font-medium">
                                    ⚠️ Requiere compras
                                </span>
                            </div>
                        )}

                        {puedeReemplazarPersonal && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirReemplazo(fila)}
                                className="text-marca hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Reemplazar personal
                            </button>
                        )}

                        {puedeModificarLogistica && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirModificarLogistica(fila)}
                                className="text-marca hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Modificar logística
                            </button>
                        )}

                        {puedeLiberarSobrantes && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() =>
                                    manejarReintentarLiberacion(fila.idsalida, fila.nroSalida)
                                }
                                className="text-amber-800 hover:text-amber-900 hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {estaLiberandoEstaSalida ? "Liberando..." : "Liberar sobrantes"}
                            </button>
                        )}

                        {puedeCancelarSalida && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirCancelarSalida(fila)}
                                className="text-rose-700 hover:text-rose-900 hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Cancelar salida
                            </button>
                        )}

                        {tieneBloqueoCanceladaPendiente && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() =>
                                    manejarReintentarLiberacionCupos(fila.idsalida, fila.nroSalida)
                                }
                                className="text-amber-800 hover:text-amber-900 hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {cancelarSalidaMutation.isPending &&
                                idSalidaReintentandoCupos === fila.idsalida
                                    ? "Liberando cupos..."
                                    : "Reintentar liberar cupos"}
                            </button>
                        )}

                        {tieneSolicitudes && (
                            <Link
                                to="/gestion/solicitudes"
                                className="text-marca hover:underline"
                            >
                                Ver solicitudes
                            </Link>
                        )}

                        {esFinalizada && (
                            <Link
                                to="/gestion/evaluaciones"
                                className="text-marca hover:underline"
                            >
                                Evaluar
                            </Link>
                        )}

                        {puedeDevolverEquipamiento && (
                            <button
                                type="button"
                                disabled={algunaMutacionPendiente}
                                onClick={() => abrirDevolucionEquipamiento(fila)}
                                className="text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer font-semibold text-xs text-left disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Devolver equipamiento
                            </button>
                        )}
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
                        Gestión de salidas
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">Consultar Salidas</h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Visualizá y consultá las salidas programadas, su dotación de personal asignado y estado de avance.
                    </p>
                </div>
                {esAdmin ? (
                    <div className="flex flex-wrap items-center gap-3">
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
                                        {formatearFechaSalida(mensajeExito.fechaInicio)}
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
                <FormularioCrearSalida
                    paquetes={paquetes}
                    opciones={opcionesSalida}
                    cargandoOpciones={cargandoOpciones}
                    creando={crearSalidaMutation.isPending}
                    errorServidor={
                        errorCreacion || (errorOpciones ? errorOpciones.message : undefined)
                    }
                    errorEsAutoridad={
                        Boolean(errorCreacion) &&
                        crearSalidaMutation.error instanceof ErrorApi &&
                        crearSalidaMutation.error.estado === 503
                    }
                    alConsultarOpciones={(parametros) => {
                        setErrorCreacion("");
                        // Mismos parámetros: la query no cambia de clave, hay que pedirla de nuevo
                        if (
                            parametrosConsulta &&
                            parametrosConsulta.idpaquete === parametros.idpaquete &&
                            parametrosConsulta.fechaInicio === parametros.fechaInicio &&
                            parametrosConsulta.tamanoMaximo === parametros.tamanoMaximo
                        ) {
                            void refrescarOpciones();
                            return;
                        }
                        setParametrosConsulta(parametros);
                    }}
                    alConfirmarCreacion={manejarConfirmarCreacion}
                    alCancelar={cerrarFormulario}
                />
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Permisos emitidos
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoAsignacion.permisosEmitidos}{" "}
                                    {resultadoAsignacion.permisosEmitidos === 1
                                        ? "permiso nominal"
                                        : "permisos nominales"}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Emitidos ante la autoridad gubernamental
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Lugares liberados
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoAsignacion.lugaresLiberados}{" "}
                                    {resultadoAsignacion.lugaresLiberados === 1
                                        ? "lugar liberado"
                                        : "lugares liberados"}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Cupos sobrantes devueltos del bloqueo
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
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
                                <p className="text-[11px] text-emerald-800 mt-0.5">
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Personal saliente
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.sale.nombreCompleto}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Desvinculado de la salida
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Personal ingresante
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.entra.nombreCompleto}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Asignado como reemplazante
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Permiso anterior
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.permisoDadoDeBaja ?? "Sin permiso / N/A"}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    {resultadoReemplazo.permisoDadoDeBaja
                                        ? "Baja informada a la autoridad"
                                        : "No había permiso que dar de baja"}
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Nuevo permiso emitido
                                </span>
                                <p className="mt-0.5 text-sm font-extrabold text-emerald-950">
                                    {resultadoReemplazo.permisoNuevo ?? "No emitido"}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
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
                                <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-900">
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

            {salidaParaAsignar ? (
                <FormularioAsignarRecursos
                    key={salidaParaAsignar.idsalida}
                    datos={datosAsignacion}
                    cargando={cargandoAsignacion}
                    recargando={recargandoAsignacion}
                    guardando={confirmarAsignacionMutation.isPending}
                    errorServidor={
                        errorConfirmacion || (errorAsignacion ? errorAsignacion.message : undefined)
                    }
                    onRecargarDatos={() => recargarAsignacion()}
                    onConfirmar={manejarSolicitarConfirmacionAsignacion}
                    onCancelar={cerrarAsignacion}
                />
            ) : null}

            {salidaParaReemplazar ? (
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
            ) : null}

            {salidaParaModificarLogistica ? (
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Artículos devueltos
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.length}{" "}
                                    {resultadoDevolucion.detalle.length === 1 ? "artículo" : "artículos"}
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Trazabilidad asentada en auditoría #{resultadoDevolucion.auditoriaId} (RF-56)
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Reintegradas a stock
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.reduce(
                                        (acc, d) => acc + d.cantidadReintegradaAlStock,
                                        0,
                                    )}{" "}
                                    unidades
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
                                    Reintegradas al stock del proveedor
                                </p>
                            </div>

                            <div className="rounded bg-emerald-100/60 p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                    Dañadas o extraviadas
                                </span>
                                <p className="mt-0.5 text-base font-extrabold text-emerald-950">
                                    {resultadoDevolucion.detalle.reduce(
                                        (acc, d) => acc + d.cantidadDaniadaOExtraviada,
                                        0,
                                    )}{" "}
                                    unidades
                                </p>
                                <p className="text-[11px] text-emerald-800 mt-0.5">
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
                                pasó al estado <span className="font-bold text-rose-700">CANCELADA</span>.
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
                    titulo={`Salida ${advertenciaCancelacion503.nroSalida} cancelada con cupos pendientes ante la autoridad (HTTP 503)`}
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

            {/* Advertencia operativa en salidas próximas (< 7 días) (RF-61) */}
            {salidasConAlertasOperativas.length > 0 ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Advertencias operativas: Salidas próximas dentro de 7 días (RF-61)"
                >
                    <div className="space-y-2">
                        <p className="text-sm">
                            Se detectaron situaciones operativas pendientes en{" "}
                            {salidasConAlertasOperativas.length}{" "}
                            {salidasConAlertasOperativas.length === 1
                                ? "salida próxima a iniciar"
                                : "salidas próximas a iniciar"}
                            :
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {salidasConAlertasOperativas.map((s) => {
                                const tieneSol = s.alertas?.includes("SOLICITUD_PENDIENTE");
                                const tienePerm = s.alertas?.includes("PERMISOS_SIN_CONFIRMAR");
                                const cantSol = solicitudesPorSalida.get(s.idsalida);

                                return (
                                    <div
                                        key={s.idsalida}
                                        className="inline-flex flex-wrap items-center gap-1.5 rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300"
                                    >
                                        <span>
                                            {s.nroSalida} ({s.paquete?.nombrePaquete}):
                                        </span>
                                        {tieneSol && (
                                            <Link
                                                to="/gestion/solicitudes"
                                                className="font-bold underline hover:text-amber-950"
                                            >
                                                {cantSol
                                                    ? `${cantSol} ${cantSol === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`
                                                    : "solicitud pendiente"}
                                            </Link>
                                        )}
                                        {tieneSol && tienePerm && <span>·</span>}
                                        {tienePerm && (
                                            <span className="text-rose-900 font-bold">
                                                {s.permisosFaltantes}{" "}
                                                {s.permisosFaltantes === 1
                                                    ? "permiso faltante"
                                                    : "permisos faltantes"}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="pt-1">
                            <Link
                                to="/gestion/solicitudes"
                                className="inline-flex items-center text-xs font-semibold text-amber-900 underline hover:text-amber-950"
                            >
                                Ir a Gestión de Solicitudes →
                            </Link>
                        </div>
                    </div>
                </Alerta>
            ) : null}

            {rangoFechasInvalido ? (
                <Alerta tipo="error" titulo="Rango de fechas inválido">
                    La fecha desde no puede ser posterior a la fecha hasta.
                </Alerta>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div role="tablist" aria-label="Vista de salidas" className="flex gap-2">
                    {(["vigentes", "historial"] as const).map((opcion) => (
                        <button
                            key={opcion}
                            type="button"
                            role="tab"
                            aria-selected={!buscaEnTodas && vista === opcion}
                            disabled={buscaEnTodas}
                            onClick={() => {
                                setVista(opcion);
                                setPaginaActual(1);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                                !buscaEnTodas && vista === opcion
                                    ? "border-primario bg-primario text-white"
                                    : "border-borde bg-white text-texto-suave hover:bg-slate-100"
                            }`}
                        >
                            {opcion === "vigentes" ? "Vigentes" : "Historial"}
                        </button>
                    ))}
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
                        hayFiltrosActivos
                            ? "No se encontraron salidas que coincidan con los filtros seleccionados."
                            : salidas.length > 0
                              ? `No hay salidas en ${vista === "vigentes" ? "vigentes" : "el historial"}.`
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
                titulo="Confirmar asignación de recursos y emisión de nómina"
                descripcion={descripcionDialogoConfirmacion}
                textoConfirmar={
                    confirmarAsignacionMutation.isPending
                        ? "Emitiendo permisos..."
                        : "Confirmar asignación"
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
