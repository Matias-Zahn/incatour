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
    } = useSalidasGuia();

    const [idsalidaSeleccionada, setIdsalidaSeleccionada] = useState<number | null>(
        null,
    );

    // Salida actual activa
    const salidaActual =
        salidas.find((s) => s.idsalida === idsalidaSeleccionada) ??
        salidas.find((s) => s.estado !== "FINALIZADA") ??
        salidas[0] ??
        null;

    const proximaSalida = salidas.length > 1 ? salidas[1] : null;

    // Consultar detalle completo de la salida actual (CU-48)
    const {
        data: detalleSalida = null,
        isLoading: cargandoDetalle,
    } = useDetalleSalidaGuia(salidaActual?.idsalida ?? 0);

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
                        <div className="rounded-tarjeta border border-peligro/30 bg-peligro/10 p-5 text-sm text-texto">
                            <p className="font-bold text-peligro">
                                No se pudieron cargar las salidas asignadas.
                            </p>
                            <p className="mt-1 text-xs text-texto-suave">
                                Verifica que tu usuario posea el rol de GUIA y cuente con salidas asignadas.
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
                            onSeleccionarSalida={(id) => setIdsalidaSeleccionada(id)}
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
