import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import {
    limpiarSesion,
    obtenerUsuario,
} from "../../services/sesionService";
import {
    useDetalleSalidaGuia,
    useSalidasGuia,
} from "../../services/guiaService";
import { BarraLateralGuia, type SeccionGuia } from "./BarraLateralGuia";
import { VistaAvances } from "./VistaAvances";
import { VistaIncidentes } from "./VistaIncidentes";
import { VistaInicio } from "./VistaInicio";
import { VistaRecorridos } from "./VistaRecorridos";
import { VistaSalidas } from "./VistaSalidas";
import { useSincronizacionAvances } from "./useSincronizacionAvances";

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
            <main className="flex-1 overflow-x-hidden p-4 md:p-8">
                <div className="mx-auto max-w-6xl">
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

                    {seccionActiva === "inicio" && (
                        <VistaInicio
                            salidaActual={salidaActual}
                            proximaSalida={proximaSalida}
                            detalleSalida={detalleSalida}
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
                        <VistaRecorridos detalleSalida={detalleSalida} />
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
                            cargando={cargandoSalidas || cargandoDetalle}
                        />
                    )}
                </div>
            </main>

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
