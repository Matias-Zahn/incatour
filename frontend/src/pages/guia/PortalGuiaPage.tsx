import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import {
    limpiarSesion,
    obtenerUsuario,
} from "../../services/sesionService";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaSalida,
    useDetalleSalidaGuia,
    useSalidasGuia,
} from "../../services/guiaService";
import { IconoMontana } from "./IconosGuia";
import { BarraLateralGuia, type SeccionGuia } from "./BarraLateralGuia";
import { VistaAvances } from "./VistaAvances";
import { VistaIncidentes } from "./VistaIncidentes";
import { VistaInicio } from "./VistaInicio";
import { VistaRecorridos } from "./VistaRecorridos";
import { VistaSalidas } from "./VistaSalidas";
import { useSincronizacionAvances } from "./useSincronizacionAvances";
import { useSincronizacionIncidentes } from "./useSincronizacionIncidentes";
import Alerta from "../../components/Alerta";
import LimiteDeError from "../../components/LimiteDeError";

// Salida elegida a mano, una clave por guía para que sobreviva a la recarga
const CLAVE_SALIDA_SELECCIONADA = "incatour.guia.salida_seleccionada";

function leerSalidaSeleccionada(clave: string): number | null {
    try {
        const n = Number(localStorage.getItem(clave));
        return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

export default function PortalGuiaPage() {
    const navegar = useNavigate();
    const params = useParams<{ seccion?: string }>();

    // El parámetro de la URL es la fuente única de verdad para la sección
    const seccionActiva: SeccionGuia =
        params.seccion === "salidas" ||
        params.seccion === "recorridos" ||
        params.seccion === "novedades" ||
        params.seccion === "incidentes"
            ? params.seccion
            : "inicio";

    const [modalSalirAbierto, setModalSalirAbierto] = useState(false);
    const usuario = obtenerUsuario();

    // Consultar salidas asignadas (CU-48)
    const {
        data: salidas = [],
        isLoading: cargandoSalidas,
        isError: errorSalidas,
        error: errorSalidasObj,
    } = useSalidasGuia();

    const claveSalida = `${CLAVE_SALIDA_SELECCIONADA}_${usuario?.idusuario ?? 0}`;
    const [idsalidaSeleccionada, setIdsalidaSeleccionada] = useState<number | null>(
        () => leerSalidaSeleccionada(claveSalida),
    );

    // Elegida en esta sesión (sí puede ser FINALIZADA) vs. recuperada de localStorage
    const [eligioEnSesion, setEligioEnSesion] = useState(false);

    // Hay un incidente a medio cargar: cambiar de salida lo descarta, así que se pide confirmación
    const incidenteEnEdicion = useRef(false);
    const avisarEdicionIncidente = useCallback((enCurso: boolean) => {
        incidenteEnEdicion.current = enCurso;
    }, []);
    const [salidaPorConfirmar, setSalidaPorConfirmar] = useState<number | null>(null);

    function cambiarSalidaGlobal(id: number) {
        if (incidenteEnEdicion.current) setSalidaPorConfirmar(id);
        else seleccionarSalida(id);
    }

    function seleccionarSalida(id: number) {
        setIdsalidaSeleccionada(id);
        setEligioEnSesion(true);
        try {
            localStorage.setItem(claveSalida, String(id));
        } catch (e) {
            console.warn("No se pudo guardar la salida seleccionada", e);
        }
    }

    // Salida actual activa
    // La guardada de una sesión anterior se ignora si ya no existe o está FINALIZADA
    const salidaActual =
        salidas.find(
            (s) =>
                s.idsalida === idsalidaSeleccionada &&
                (eligioEnSesion || s.estado !== "FINALIZADA"),
        ) ??
        salidas.find((s) => s.estado !== "FINALIZADA") ??
        salidas[0] ??
        null;

    // La lista viene ordenada por fechaInicio: la próxima es la que sigue a la actual
    const indiceActual = salidaActual ? salidas.indexOf(salidaActual) : -1;
    const proximaSalida = indiceActual >= 0 ? (salidas[indiceActual + 1] ?? null) : null;

    // FE-38: la cola de avances se sincroniza al entrar al portal y al volver la señal, en cualquier vista
    const sincronizacion = useSincronizacionAvances(salidaActual?.idsalida ?? 0);
    const sincronizacionIncidentes = useSincronizacionIncidentes(salidaActual?.idsalida ?? 0);
    const pendientesDeEnvio = sincronizacion.pendientes.length + sincronizacionIncidentes.pendientes.length;
    // Novedades ya muestra los avances pendientes y su aviso
    const enNovedades = seccionActiva === "novedades";

    // Consultar detalle completo de la salida actual (CU-48)
    const {
        data: detalleSalida = null,
        isLoading: cargandoDetalle,
    } = useDetalleSalidaGuia(salidaActual?.idsalida ?? 0);

    const mensajeErrorSalidas =
        errorSalidasObj instanceof Error && errorSalidasObj.message
            ? errorSalidasObj.message
            : typeof errorSalidasObj === "object" &&
                errorSalidasObj !== null &&
                "message" in errorSalidasObj
              ? String((errorSalidasObj as { message: unknown }).message)
              : "No se pudieron cargar las salidas asignadas.";

    useEffect(() => {
        document.title = "Portal Guía · IncaTour";
    }, []);

    // Los avisos son de la sección donde aparecieron, se llegue a la siguiente por el menú o por un botón
    const { limpiarMensaje: limpiarAvisoAvances } = sincronizacion;
    const { limpiarMensaje: limpiarAvisoIncidentes } = sincronizacionIncidentes;
    useEffect(() => {
        limpiarAvisoAvances();
        limpiarAvisoIncidentes();
    }, [seccionActiva, limpiarAvisoAvances, limpiarAvisoIncidentes]);

    function manejarCambioSeccion(seccion: SeccionGuia) {
        navegar(`/guia/${seccion}`, { replace: true });
    }

    function confirmarCerrarSesion() {
        limpiarSesion();
        setModalSalirAbierto(false);
        navegar("/login", { replace: true });
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#f4f7f8] md:flex-row">
            {/* Barra lateral / navegación */}
            <BarraLateralGuia
                seccionActiva={seccionActiva}
                onCambiarSeccion={manejarCambioSeccion}
                onAbrirSalir={() => setModalSalirAbierto(true)}
                usuario={usuario}
            />

            {/* Área de contenido */}
            <main className="flex-1 overflow-x-hidden p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8">
                <div className="mx-auto max-w-6xl"><LimiteDeError>
                    {/* Barra Superior / Contexto Global de Salida Operativa */}
                    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1b9fc7] to-[#16d6dc] text-white shadow-sm">
                                <IconoMontana tamano={22} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave">
                                        Salida seleccionada
                                    </span>
                                    {salidaActual ? (
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${estilosEstadoSalida(
                                                salidaActual.estado,
                                            )}`}
                                        >
                                            {formatearEstadoSalida(salidaActual.estado)}
                                        </span>
                                    ) : null}
                                </div>
                                {salidaActual ? (
                                    <p className="text-sm font-bold text-navegacion md:text-base">
                                        <span className="text-marca">{salidaActual.nroSalida}</span>
                                        {" · "}
                                        <span>{salidaActual.circuito}</span>
                                        <span className="ml-2 text-xs font-normal text-texto-suave">
                                            ({formatearFechaSalida(salidaActual.fechaInicio)} al {formatearFechaSalida(salidaActual.fechaFin)})
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-sm font-medium text-texto-suave">
                                        {cargandoSalidas ? "Cargando salidas asignadas..." : "Sin salidas asignadas"}
                                    </p>
                                )}
                            </div>
                        </div>

                        {salidas.length > 1 ? (
                            <div className="flex w-full min-w-0 flex-col gap-1 rounded-xl border border-borde/70 bg-[#f8fafb] px-3 py-2 md:w-auto md:flex-row md:items-center md:gap-2">
                                <label
                                    htmlFor="selector-salida-global"
                                    className="text-xs font-bold text-texto-suave md:whitespace-nowrap"
                                >
                                    Cambiar salida activa:
                                </label>
                                <select
                                    id="selector-salida-global"
                                    value={salidaActual?.idsalida ?? ""}
                                    onChange={(e) => cambiarSalidaGlobal(Number(e.target.value))}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-1.5 text-base font-bold text-texto outline-none focus:border-marca md:max-w-xs md:text-xs"
                                >
                                    {salidas.map((s) => (
                                        <option key={s.idsalida} value={s.idsalida}>
                                            {s.nroSalida} ({formatearEstadoSalida(s.estado)}) · {s.circuito}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                    </header>
                    {errorSalidas ? (
                        <div className="mb-6 rounded-tarjeta border border-peligro/30 bg-peligro/10 p-5 text-sm text-texto">
                            <p className="font-bold text-peligro">
                                {mensajeErrorSalidas}
                            </p>
                            <p className="mt-1 text-xs text-texto-suave">
                                Verifica que tu cuenta cuente con los permisos necesarios o contacta al administrador.
                            </p>
                        </div>
                    ) : null}

                    {pendientesDeEnvio > 0 && !enNovedades ? (
                        <div className="mb-4">
                            <Alerta tipo="advertencia">
                                Tenés {pendientesDeEnvio} registro(s) sin enviar. Se envían solos cuando vuelva la señal.
                            </Alerta>
                        </div>
                    ) : null}
                    {sincronizacion.mensaje && !enNovedades ? (
                        <div className="mb-4">
                            <Alerta tipo={sincronizacion.mensaje.tipo}>{sincronizacion.mensaje.texto}</Alerta>
                        </div>
                    ) : null}
                    {sincronizacionIncidentes.mensaje ? (
                        <div className="mb-4">
                            <Alerta tipo={sincronizacionIncidentes.mensaje.tipo}>{sincronizacionIncidentes.mensaje.texto}</Alerta>
                        </div>
                    ) : null}

                    {seccionActiva === "inicio" && (
                        <VistaInicio
                            salidaActual={salidaActual}
                            proximaSalida={proximaSalida}
                            detalleSalida={detalleSalida}
                            nombreGuia={usuario?.nombre}
                            cargando={cargandoSalidas || cargandoDetalle}
                        />
                    )}

                    {seccionActiva === "salidas" && (
                        <VistaSalidas
                            salidaActual={salidaActual}
                            detalleSalida={detalleSalida}
                            salidas={salidas}
                            onSeleccionarSalida={seleccionarSalida}
                            cargando={cargandoSalidas || cargandoDetalle}
                        />
                    )}

                    {seccionActiva === "recorridos" && (
                        <VistaRecorridos detalleSalida={detalleSalida} avancesPendientes={sincronizacion.pendientes} />
                    )}

                    {seccionActiva === "novedades" && (
                        <VistaAvances
                            key={salidaActual?.idsalida ?? "sin_salida"}
                            salidaActual={salidaActual}
                            detalleSalida={detalleSalida}
                            sincronizacion={sincronizacion}
                            cargando={cargandoSalidas || cargandoDetalle}
                        />
                    )}

                    {seccionActiva === "incidentes" && (
                        <VistaIncidentes
                            key={salidaActual?.idsalida ?? "sin_salida"}
                            salidaActual={salidaActual}
                            detalleSalida={detalleSalida}
                            sincronizacion={sincronizacionIncidentes}
                            onCambioEdicion={avisarEdicionIncidente}
                            cargando={cargandoSalidas || cargandoDetalle}
                        />
                    )}
                </LimiteDeError></div>
            </main>

            <DialogoConfirmacion
                abierto={salidaPorConfirmar !== null}
                titulo="¿Cambiar de salida?"
                descripcion="El incidente que estás cargando todavía no se envió y se va a descartar."
                textoConfirmar="Sí, cambiar"
                textoCancelar="Seguir cargando"
                onConfirmar={() => {
                    if (salidaPorConfirmar !== null) seleccionarSalida(salidaPorConfirmar);
                    setSalidaPorConfirmar(null);
                }}
                onCancelar={() => setSalidaPorConfirmar(null)}
            />

            {/* Modal de confirmación para salir */}
            <DialogoConfirmacion
                abierto={modalSalirAbierto}
                titulo="¿Deseas salir del portal?"
                descripcion="Al confirmar, cerrarás tu sesión operativa de guía en IncaTour."
                textoConfirmar="Sí, salir"
                textoCancelar="Cancelar"
                onConfirmar={confirmarCerrarSesion}
                onCancelar={() => setModalSalirAbierto(false)}
            />
        </div>
    );
}
