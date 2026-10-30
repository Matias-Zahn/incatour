import { useCallback, useId, useState } from "react";
import Modal from "./Modal";
import Alerta from "./Alerta";
import Boton from "./Boton";
import { ErrorApi } from "../services/clienteApi";
import { formatearMontoUsd } from "../services/clientePortalService";
import { formatearFechaSalida } from "../services/guiaService";
import {
    useCancelarSalida,
    useImpactoCancelacion,
    type ResultadoCancelarSalida,
    type Salida,
} from "../services/salidaService";

export type ModalCancelarSalidaProps = {
    abierto: boolean;
    salida: Salida | null;
    onCerrar: () => void;
    onCancelacionExitosa: (resultado: ResultadoCancelarSalida) => void;
    onCancelacionConAdvertencia?: (
        idsalida: number,
        nroSalida: string,
        mensaje: string,
    ) => void;
};

export function ModalCancelarSalida({
    abierto,
    salida,
    onCerrar,
    onCancelacionExitosa,
    onCancelacionConAdvertencia,
}: ModalCancelarSalidaProps) {
    const tituloId = useId();
    const descripcionId = useId();

    const [motivo, setMotivo] = useState("");
    const [confirmacionLeida, setConfirmacionLeida] = useState(false);
    const [errorLocal, setErrorLocal] = useState<string | null>(null);
    const [error503Autoridad, setError503Autoridad] = useState<string | null>(null);

    const idsalida = salida?.idsalida ?? null;

    // Consulta de impacto de la cancelación (CU-37)
    const {
        data: impacto,
        isPending: cargandoImpacto,
        error: errorImpacto,
        refetch: recargarImpacto,
    } = useImpactoCancelacion(idsalida, {
        enabled: abierto && idsalida !== null,
    });

    const cancelarMutation = useCancelarSalida();

    const manejarCerrar = useCallback(() => {
        if (cancelarMutation.isPending) return;
        // Si la salida ya quedó cancelada (error 503 previo), notificamos a la página
        if (error503Autoridad && idsalida) {
            onCancelacionConAdvertencia?.(
                idsalida,
                salida?.nroSalida ?? `SAL-${idsalida}`,
                error503Autoridad,
            );
        }
        onCerrar();
    }, [
        cancelarMutation.isPending,
        error503Autoridad,
        idsalida,
        onCancelacionConAdvertencia,
        onCerrar,
        salida?.nroSalida,
    ]);

    if (!abierto || !salida) {
        return null;
    }

    const motivoLimpio = motivo.trim();
    const motivoLongitud = motivoLimpio.length;
    const motivoValido = motivoLongitud >= 5 && motivoLongitud <= 300;
    const puedeConfirmar =
        motivoValido &&
        confirmacionLeida &&
        !cancelarMutation.isPending &&
        Boolean(impacto);

    function manejarConfirmar() {
        if (!idsalida || !puedeConfirmar) return;
        setErrorLocal(null);
        setError503Autoridad(null);

        cancelarMutation.mutate(
            { idsalida, datos: { motivo: motivoLimpio } },
            {
                onSuccess: (resultado) => {
                    onCancelacionExitosa(resultado);
                    onCerrar();
                },
                onError: (error) => {
                    if (error instanceof ErrorApi && error.estado === 503) {
                        setError503Autoridad(
                            error.message ||
                                "La salida quedó cancelada en el sistema, pero la autoridad no liberó los cupos. Podés reintentar la liberación ahora o más tarde.",
                        );
                    } else if (error instanceof ErrorApi) {
                        setErrorLocal(error.message);
                    } else if (error instanceof Error) {
                        // FE-44: sin respuesta HTTP (sin señal, servidor caído) no se muestra "Failed to fetch"
                        setErrorLocal("No se pudo conectar con el servidor. Revisá la conexión y reintentá.");
                    } else {
                        setErrorLocal("Ocurrió un error inesperado al procesar la cancelación.");
                    }
                },
            },
        );
    }

    function manejarReintentar503() {
        if (!idsalida || cancelarMutation.isPending) return;
        setErrorLocal(null);
        setError503Autoridad(null);

        cancelarMutation.mutate(
            {
                idsalida,
                datos: {
                    motivo: motivoLimpio.length >= 5 ? motivoLimpio : "Reintento de liberación ante la autoridad",
                },
            },
            {
                onSuccess: (resultado) => {
                    onCancelacionExitosa(resultado);
                    onCerrar();
                },
                onError: (error) => {
                    if (error instanceof ErrorApi && error.estado === 503) {
                        setError503Autoridad(
                            error.message ||
                                "La autoridad continúa sin responder. Los cupos siguen bloqueados pero la salida ya fue cancelada.",
                        );
                    } else if (error instanceof ErrorApi) {
                        setErrorLocal(error.message);
                    } else {
                        setErrorLocal("Error al reintentar la liberación ante la autoridad.");
                    }
                },
            },
        );
    }

    return (
        <Modal
            onCerrar={manejarCerrar}
            bloqueado={cancelarMutation.isPending}
            rol="alertdialog"
            etiquetaId={tituloId}
            descripcionId={descripcionId}
            className="space-y-5 p-6"
        >
                {/* Cabecera de la salida */}
                <div className="border-b border-borde pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 uppercase tracking-wider">
                            <span aria-hidden="true">⚠️</span> Acción irreversible
                        </span>
                        <span className="text-xs font-semibold text-texto-suave">
                            Cancelación de salida
                        </span>
                    </div>

                    <h2 id={tituloId} className="mt-2 text-xl font-bold text-texto">
                        Cancelar Salida Turística
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-texto-suave">
                        <p>
                            Salida:{" "}
                            <span className="font-bold text-navegacion">{salida.nroSalida}</span>
                        </p>
                        <p>
                            Paquete:{" "}
                            <span className="font-semibold text-texto">
                                {salida.paquete?.nombrePaquete ?? "—"}
                            </span>
                        </p>
                        <p>
                            Fecha de inicio:{" "}
                            <span className="font-semibold text-texto">
                                {formatearFechaSalida(salida.fechaInicio)}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Estado de carga de impacto */}
                {cargandoImpacto && (
                    <div className="flex items-center justify-center gap-3 py-10 text-texto-suave">
                        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                        <span className="text-sm font-medium">
                            Evaluando impacto de la cancelación...
                        </span>
                    </div>
                )}

                {/* Error al consultar impacto */}
                {errorImpacto && !cargandoImpacto && !error503Autoridad && (
                    <div className="space-y-4">
                        <Alerta tipo="error" titulo="No se pudo consultar el impacto de la cancelación">
                            {errorImpacto instanceof ErrorApi
                                ? errorImpacto.message
                                : "Ocurrió un error al cargar la información de la salida."}
                        </Alerta>
                        <div className="flex justify-end gap-2">
                            <Boton variante="secundario" onClick={() => recargarImpacto()}>
                                Reintentar consulta
                            </Boton>
                            <Boton variante="secundario" onClick={manejarCerrar}>
                                Volver
                            </Boton>
                        </div>
                    </div>
                )}

                {/* Resumen del impacto (CU-37) */}
                {impacto && !cargandoImpacto && (
                    <div className="space-y-4 text-sm" id={descripcionId}>
                        {/* Error de la autoridad 503 (Salida ya cancelada en BD, pendiente cupos) */}
                        {error503Autoridad ? (
                            <Alerta
                                tipo="advertencia"
                                titulo="Salida cancelada con advertencia ante la autoridad (HTTP 503)"
                            >
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">{error503Autoridad}</p>
                                    <p className="text-xs text-amber-900">
                                        La salida quedó formalmente cancelada en la base de datos, los
                                        recursos fueron liberados y los reembolsos registrados. Solo resta
                                        liberar el bloqueo de cupos ante el sistema del parque.
                                    </p>
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        <Boton
                                            variante="principal"
                                            cargando={cancelarMutation.isPending}
                                            onClick={manejarReintentar503}
                                        >
                                            Reintentar liberación de cupos
                                        </Boton>
                                        <Boton
                                            variante="secundario"
                                            onClick={manejarCerrar}
                                            disabled={cancelarMutation.isPending}
                                        >
                                            Cerrar y continuar
                                        </Boton>
                                    </div>
                                </div>
                            </Alerta>
                        ) : null}

                        {/* Error 400 u otro error funcional */}
                        {errorLocal && !error503Autoridad ? (
                            <Alerta tipo="error" titulo="Error al procesar la cancelación">
                                {errorLocal}
                            </Alerta>
                        ) : null}

                        {!error503Autoridad && (
                            <>
                                <div className="rounded-tarjeta border border-rose-200 bg-rose-50/60 p-4 space-y-3">
                                    <h3 className="font-bold text-rose-950 text-xs uppercase tracking-wider">
                                        Resumen de impacto en el sistema
                                    </h3>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded bg-white p-3 border border-rose-200/70 shadow-sm">
                                            <span className="text-xs text-texto-suave block">
                                                Reservas confirmadas
                                            </span>
                                            <p className="text-xl font-extrabold text-rose-900 mt-0.5">
                                                {impacto.reservasAfectadas}{" "}
                                                <span className="text-xs font-semibold text-rose-700">
                                                    {impacto.reservasAfectadas === 1
                                                        ? "reserva pasará a Cancelada"
                                                        : "reservas pasarán a Cancelada"}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="rounded bg-white p-3 border border-rose-200/70 shadow-sm">
                                            <span className="text-xs text-texto-suave block">
                                                Total de reintegros registrados (100%)
                                            </span>
                                            <p className="text-xl font-extrabold text-rose-900 mt-0.5">
                                                {formatearMontoUsd(impacto.totalAReembolsar)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Nota obligatoria de acreditación */}
                                    <div className="rounded bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-950 flex items-start gap-2">
                                        <span aria-hidden="true" className="text-amber-700 mt-0.5">
                                            ℹ️
                                        </span>
                                        <div>
                                            <span className="font-bold">Aviso sobre reembolsos: </span>
                                            El sistema registra formalmente los comprobantes de reembolso al 100% de
                                            lo abonado. La acreditación o transferencia efectiva del dinero al cliente se realiza
                                            por fuera de la plataforma.
                                        </div>
                                    </div>

                                    {/* Recursos y permisos */}
                                    <div className="grid gap-2 sm:grid-cols-3 pt-1 text-xs">
                                        <div className="rounded bg-white/80 p-2 border border-rose-200/50">
                                            <span className="text-texto-suave block">Permisos nominales:</span>
                                            <span className="font-bold text-texto">
                                                {impacto.permisosQuePasanAPerdido} pasarán a{" "}
                                                <span className="text-rose-700 font-extrabold">Perdido</span>
                                            </span>
                                        </div>
                                        <div className="rounded bg-white/80 p-2 border border-rose-200/50">
                                            <span className="text-texto-suave block">Personal asignado:</span>
                                            <span className="font-bold text-texto">
                                                {impacto.recursosQueSeLiberan.personal} integrantes liberados
                                            </span>
                                        </div>
                                        <div className="rounded bg-white/80 p-2 border border-rose-200/50">
                                            <span className="text-texto-suave block">Equipamiento y servicios:</span>
                                            <span className="font-bold text-texto">
                                                {impacto.recursosQueSeLiberan.equipamiento} equip. /{" "}
                                                {impacto.recursosQueSeLiberan.servicios} servicios
                                            </span>
                                        </div>
                                    </div>

                                    {/* Notificaciones */}
                                    <div className="text-xs text-texto-suave pt-1 border-t border-rose-200/60">
                                        {impacto.notificaAClientes ? (
                                            <p className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                <span aria-hidden="true">📧</span>
                                                Se enviará un correo electrónico automático a los titulares de las{" "}
                                                {impacto.reservasAfectadas} reservas informando el motivo, el reintegro
                                                y salidas alternativas disponibles.
                                            </p>
                                        ) : (
                                            <p className="text-slate-600 italic">
                                                La salida no tiene reservas confirmadas. No se enviarán notificaciones a clientes.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Formulario: Motivo obligatorio */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center justify-between">
                                        <label
                                            htmlFor="motivo-cancelacion"
                                            className="text-xs font-bold text-texto"
                                        >
                                            Motivo de la cancelación <span className="text-rose-600">*</span>
                                        </label>
                                        <span
                                            className={`text-[11px] font-medium ${
                                                motivoLongitud > 300
                                                    ? "text-rose-600 font-bold"
                                                    : motivoLongitud < 5 && motivoLongitud > 0
                                                    ? "text-amber-700"
                                                    : "text-texto-suave"
                                            }`}
                                        >
                                            {motivoLongitud}/300 caracteres (mínimo 5)
                                        </span>
                                    </div>

                                    <textarea
                                        id="motivo-cancelacion"
                                        rows={3}
                                        value={motivo}
                                        disabled={cancelarMutation.isPending}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        placeholder="Ingrese una justificación detallada (ej. Condiciones climáticas adversas que impiden el paso seguro)..."
                                        className="w-full rounded-control border border-borde bg-white p-2.5 text-sm font-normal text-texto outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:bg-slate-50"
                                    />

                                    {motivoLongitud > 0 && motivoLongitud < 5 && (
                                        <p className="text-xs text-amber-700 font-medium">
                                            El motivo debe tener al menos 5 caracteres.
                                        </p>
                                    )}
                                    {motivoLongitud > 300 && (
                                        <p className="text-xs text-rose-600 font-medium">
                                            El motivo no puede exceder los 300 caracteres.
                                        </p>
                                    )}
                                </div>

                                {/* Confirmación explícita */}
                                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                                    <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-texto">
                                        <input
                                            type="checkbox"
                                            checked={confirmacionLeida}
                                            disabled={cancelarMutation.isPending}
                                            onChange={(e) => setConfirmacionLeida(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-borde text-rose-600 focus:ring-rose-500"
                                        />
                                        <span>
                                            Comprendo el impacto y confirmo que deseo cancelar la salida{" "}
                                            <span className="font-bold text-navegacion">{salida.nroSalida}</span>,
                                            dar de baja las reservas, liberar los recursos y emitir las notificaciones
                                            correspondientes.
                                        </span>
                                    </label>
                                </div>

                                {/* Botones de acción */}
                                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-borde">
                                    <Boton
                                        variante="secundario"
                                        onClick={manejarCerrar}
                                        disabled={cancelarMutation.isPending}
                                    >
                                        Descartar
                                    </Boton>
                                    <Boton
                                        variante="peligro"
                                        onClick={manejarConfirmar}
                                        disabled={!puedeConfirmar}
                                        cargando={cancelarMutation.isPending}
                                    >
                                        {cancelarMutation.isPending
                                            ? "Cancelando salida..."
                                            : "Confirmar cancelación de salida"}
                                    </Boton>
                                </div>
                            </>
                        )}
                    </div>
                )}
        </Modal>
    );
}

export default ModalCancelarSalida;
