import { useId, useMemo, useState } from "react";
import Alerta from "./Alerta";
import Boton from "./Boton";
import DialogoConfirmacion from "./DialogoConfirmacion";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaSalida,
} from "../services/guiaService";
import {
    useRecursosDisponiblesLogistica,
    type PanelLogistica,
    type PayloadModificarLogistica,
    type RecursoDisponibleEquipamiento,
    type RecursoDisponibleTransporte,
} from "../services/salidaService";

export type FormularioModificarLogisticaProps = {
    idsalida: number;
    datosLogistica?: PanelLogistica | null;
    cargandoLogistica?: boolean;
    errorLogistica?: string;
    guardando?: boolean;
    errorModificacion?: string;
    onRecargarDatos?: () => void;
    onConfirmarModificacion: (payload: PayloadModificarLogistica) => void;
    onCancelar: () => void;
};

type ItemNuevoEquipamientoForm = {
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento: string | null;
    proveedor: string;
    cantidad: number;
    stockMaximo: number;
};

export function FormularioModificarLogistica({
    idsalida,
    datosLogistica,
    cargandoLogistica = false,
    errorLogistica,
    guardando = false,
    errorModificacion,
    onRecargarDatos,
    onConfirmarModificacion,
    onCancelar,
}: FormularioModificarLogisticaProps) {
    const idSeccion = useId();

    // Consultas de recursos disponibles
    const {
        data: transportesDisponibles,
        isPending: cargandoTransportes,
        error: errorTransportes,
    } = useRecursosDisponiblesLogistica(idsalida, "TRANSPORTE");

    const {
        data: equipamientosDisponibles,
        isPending: cargandoEquipamientos,
        error: errorEquipamientos,
    } = useRecursosDisponiblesLogistica(idsalida, "EQUIPAMIENTO");

    // Transporte: estados de cambio
    // "conservar" | "quitar" | "cambiar"
    const [modoTransporte, setModoTransporte] = useState<"conservar" | "quitar" | "cambiar">("conservar");
    const [idTransporteNuevo, setIdTransporteNuevo] = useState<number | null>(null);
    const [comprobanteReserva, setComprobanteReserva] = useState("");

    // Equipamiento original: idservicio -> { cantidad: number, quitado: boolean }
    const [estadoOriginalEquipamiento, setEstadoOriginalEquipamiento] = useState<
        Record<number, { cantidad: number; quitado: boolean }>
    >({});

    // Nuevos equipamientos agregados a la salida
    const [nuevosEquipamientos, setNuevosEquipamientos] = useState<ItemNuevoEquipamientoForm[]>([]);

    // Selector para añadir equipamiento
    const [idEquipamientoAAgregar, setIdEquipamientoAAgregar] = useState<number | null>(null);
    const [cantidadAAgregar, setCantidadAAgregar] = useState<number>(1);

    // Motivo del cambio (opcional, máx 300 caracteres)
    const [motivo, setMotivo] = useState("");

    // Diálogo de confirmación
    const [dialogoAbierto, setDialogoAbierto] = useState(false);

    // Listas tipeadas de recursos disponibles
    const transportes = useMemo(() => {
        return (transportesDisponibles as RecursoDisponibleTransporte[]) ?? [];
    }, [transportesDisponibles]);

    const equipamientos = useMemo(() => {
        return (equipamientosDisponibles as RecursoDisponibleEquipamiento[]) ?? [];
    }, [equipamientosDisponibles]);

    // Mapa de stock adicional disponible para equipamientos asignados actualmente
    const stockDisponiblePorServicio = useMemo(() => {
        const mapa = new Map<number, number>();
        for (const eq of equipamientos) {
            mapa.set(eq.idservicio, eq.disponibilidad?.cantidadDisponible ?? 0);
        }
        return mapa;
    }, [equipamientos]);

    // Opciones para el selector de nuevo equipamiento (excluyendo los ya asignados y los ya agregados)
    const opcionesEquipamientoDisponibles = useMemo(() => {
        const idsAsignados = new Set(
            (datosLogistica?.equipamiento ?? [])
                .filter((e) => !(estadoOriginalEquipamiento[e.idservicio]?.quitado))
                .map((e) => e.idservicio),
        );
        const idsNuevos = new Set(nuevosEquipamientos.map((e) => e.idservicio));

        return equipamientos.filter(
            (eq) => !idsAsignados.has(eq.idservicio) && !idsNuevos.has(eq.idservicio),
        );
    }, [equipamientos, datosLogistica?.equipamiento, estadoOriginalEquipamiento, nuevosEquipamientos]);

    // Cálculo de itemsDesasignar e itemsNuevos
    const { itemsDesasignar, itemsNuevos, resumenCambios, errorValidacionTransporte } = useMemo(() => {
        const desasignar: PayloadModificarLogistica["itemsDesasignar"] = [];
        const nuevos: PayloadModificarLogistica["itemsNuevos"] = [];
        const resumen: { tipo: "quitar" | "agregar" | "modificar"; detalle: string }[] = [];
        let errTrans: string | null = null;

        // Transporte
        const transOriginal = datosLogistica?.transporte;
        if (transOriginal) {
            if (modoTransporte === "quitar") {
                desasignar.push({ tipo: "TRANSPORTE", idservicio: transOriginal.idservicio });
                resumen.push({
                    tipo: "quitar",
                    detalle: `Desasignar transporte: ${transOriginal.nombreServicio} (${transOriginal.proveedor.razonSocial})`,
                });
            } else if (modoTransporte === "cambiar") {
                if (!idTransporteNuevo) {
                    errTrans = "Debe seleccionar un transporte de reemplazo.";
                } else if (!comprobanteReserva.trim()) {
                    errTrans = "El comprobante de la reserva externa es obligatorio para el nuevo transporte.";
                } else if (comprobanteReserva.trim().length > 100) {
                    errTrans = "El comprobante no puede superar los 100 caracteres.";
                } else {
                    const sel = transportes.find((t) => t.idservicio === idTransporteNuevo);
                    desasignar.push({ tipo: "TRANSPORTE", idservicio: transOriginal.idservicio });
                    nuevos.push({
                        tipo: "TRANSPORTE",
                        idservicio: idTransporteNuevo,
                        comprobanteReserva: comprobanteReserva.trim(),
                    });
                    resumen.push({
                        tipo: "modificar",
                        detalle: `Reemplazar transporte ${transOriginal.nombreServicio} por ${sel?.nombreServicio ?? "Nuevo"} (${sel?.proveedor.razonSocial ?? ""}) — Comprobante: ${comprobanteReserva.trim()}`,
                    });
                }
            }
        } else {
            // No tenía transporte asignado previamente
            if (modoTransporte === "cambiar") {
                if (!idTransporteNuevo) {
                    errTrans = "Debe seleccionar un transporte para asignar.";
                } else if (!comprobanteReserva.trim()) {
                    errTrans = "El comprobante de la reserva externa es obligatorio.";
                } else if (comprobanteReserva.trim().length > 100) {
                    errTrans = "El comprobante no puede superar los 100 caracteres.";
                } else {
                    const sel = transportes.find((t) => t.idservicio === idTransporteNuevo);
                    nuevos.push({
                        tipo: "TRANSPORTE",
                        idservicio: idTransporteNuevo,
                        comprobanteReserva: comprobanteReserva.trim(),
                    });
                    resumen.push({
                        tipo: "agregar",
                        detalle: `Asignar transporte: ${sel?.nombreServicio ?? "Servicio"} (${sel?.proveedor.razonSocial ?? ""}) — Comprobante: ${comprobanteReserva.trim()}`,
                    });
                }
            }
        }

        // Equipamiento original
        for (const eq of datosLogistica?.equipamiento ?? []) {
            const estado = estadoOriginalEquipamiento[eq.idservicio];
            if (estado?.quitado) {
                desasignar.push({ tipo: "EQUIPAMIENTO", idservicio: eq.idservicio });
                resumen.push({
                    tipo: "quitar",
                    detalle: `Quitar equipamiento: ${eq.nombreServicio} (${eq.cantidad} u.)`,
                });
            } else if (estado?.cantidad && estado.cantidad !== eq.cantidad) {
                // En el backend para cambiar cantidad se desasigna y se vuelve a asignar con la nueva cantidad
                desasignar.push({ tipo: "EQUIPAMIENTO", idservicio: eq.idservicio });
                nuevos.push({
                    tipo: "EQUIPAMIENTO",
                    idservicio: eq.idservicio,
                    cantidad: estado.cantidad,
                });
                resumen.push({
                    tipo: "modificar",
                    detalle: `Modificar cantidad de ${eq.nombreServicio}: de ${eq.cantidad} a ${estado.cantidad} u.`,
                });
            }
        }

        // Nuevos equipamientos agregados
        for (const nuevo of nuevosEquipamientos) {
            nuevos.push({
                tipo: "EQUIPAMIENTO",
                idservicio: nuevo.idservicio,
                cantidad: nuevo.cantidad,
            });
            resumen.push({
                tipo: "agregar",
                detalle: `Agregar equipamiento: ${nuevo.nombreServicio} (${nuevo.cantidad} u. - ${nuevo.proveedor})`,
            });
        }

        return {
            itemsDesasignar: desasignar,
            itemsNuevos: nuevos,
            resumenCambios: resumen,
            errorValidacionTransporte: errTrans,
        };
    }, [
        datosLogistica,
        modoTransporte,
        idTransporteNuevo,
        comprobanteReserva,
        transportes,
        estadoOriginalEquipamiento,
        nuevosEquipamientos,
    ]);

    // Validaciones para habilitar el guardado
    const hayCambiosEfectivos = itemsDesasignar.length > 0 || itemsNuevos.length > 0;
    const motivoLimpio = motivo.trim();
    const motivoValido = motivoLimpio.length <= 300;
    const formularioValido =
        hayCambiosEfectivos &&
        errorValidacionTransporte === null &&
        motivoValido &&
        !guardando;

    // Manejadores para equipamiento original
    function manejarCambiarCantidadOriginal(idservicio: number, nuevaCantidad: number, maxPermitido: number) {
        if (nuevaCantidad < 1) return;
        if (nuevaCantidad > maxPermitido) nuevaCantidad = maxPermitido;
        setEstadoOriginalEquipamiento((prev) => ({
            ...prev,
            [idservicio]: {
                cantidad: nuevaCantidad,
                quitado: false,
            },
        }));
    }

    function manejarAlternarQuitarOriginal(idservicio: number, cantidadOriginal: number) {
        setEstadoOriginalEquipamiento((prev) => {
            const actual = prev[idservicio];
            const quitado = actual ? !actual.quitado : true;
            return {
                ...prev,
                [idservicio]: {
                    cantidad: actual?.cantidad ?? cantidadOriginal,
                    quitado,
                },
            };
        });
    }

    // Manejador para agregar nuevo equipamiento
    function manejarAgregarNuevoEquipamiento() {
        if (!idEquipamientoAAgregar || cantidadAAgregar <= 0) return;
        const item = equipamientos.find((e) => e.idservicio === idEquipamientoAAgregar);
        if (!item) return;

        const max = item.disponibilidad?.cantidadDisponible ?? 0;
        const cant = Math.min(cantidadAAgregar, max);
        if (cant <= 0) return;

        setNuevosEquipamientos((prev) => [
            ...prev,
            {
                idservicio: item.idservicio,
                nombreServicio: item.nombreServicio,
                tipoEquipamiento: item.disponibilidad?.tipoEquipamiento ?? null,
                proveedor: item.proveedor?.razonSocial ?? "Proveedor",
                cantidad: cant,
                stockMaximo: max,
            },
        ]);

        setIdEquipamientoAAgregar(null);
        setCantidadAAgregar(1);
    }

    function manejarQuitarNuevoEquipamiento(idservicio: number) {
        setNuevosEquipamientos((prev) => prev.filter((e) => e.idservicio !== idservicio));
    }

    function manejarCambiarCantidadNuevo(idservicio: number, nuevaCantidad: number) {
        if (nuevaCantidad < 1) return;
        setNuevosEquipamientos((prev) =>
            prev.map((e) =>
                e.idservicio === idservicio
                    ? { ...e, cantidad: Math.min(nuevaCantidad, e.stockMaximo) }
                    : e,
            ),
        );
    }

    // Diálogo de confirmación
    function manejarSolicitarConfirmacion() {
        if (!formularioValido) return;
        setDialogoAbierto(true);
    }

    function manejarEjecutarConfirmacion() {
        setDialogoAbierto(false);
        onConfirmarModificacion({
            itemsDesasignar,
            itemsNuevos,
            motivo: motivoLimpio ? motivoLimpio : null,
        });
    }

    // Estados de carga inicial
    if (cargandoLogistica) {
        return (
            <section
                aria-busy="true"
                className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                        <p className="text-sm font-medium text-texto">
                            Consultando logística actual de la salida...
                        </p>
                    </div>
                    <Boton type="button" variante="secundario" onClick={onCancelar}>
                        Cancelar
                    </Boton>
                </div>
            </section>
        );
    }

    // Error al cargar datos de la salida
    if (!datosLogistica) {
        if (errorLogistica) {
            return (
                <section className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4">
                    <header className="border-b border-borde pb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración · CU-39
                        </span>
                        <h2 className="text-lg font-bold text-texto">
                            Modificar Logística de Salida
                        </h2>
                    </header>
                    <Alerta
                        tipo="error"
                        titulo="No fue posible cargar la logística de la salida"
                    >
                        <p>{errorLogistica}</p>
                    </Alerta>
                    <div className="flex justify-end gap-3 pt-2">
                        {onRecargarDatos && (
                            <Boton type="button" variante="secundario" onClick={onRecargarDatos}>
                                Reintentar
                            </Boton>
                        )}
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Cerrar
                        </Boton>
                    </div>
                </section>
            );
        }
        return null;
    }

    const { nroSalida, estado, fechaInicio, fechaFin, transporte: transActual, equipamiento: eqActual } = datosLogistica;
    const requerimientoTransporteSinAsignar =
        datosLogistica.requerimientosSinAsignar?.includes("TRANSPORTE") || !transActual;

    return (
        <section
            aria-labelledby={`${idSeccion}-titulo`}
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-6"
        >
            {/* Cabecera */}
            <header className="border-b border-borde pb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                        Administración · CU-39
                    </span>
                    <h2 id={`${idSeccion}-titulo`} className="text-xl font-bold text-texto">
                        Modificar Logística · Salida #{nroSalida}
                    </h2>
                    <p className="text-xs text-texto-suave mt-1">
                        Fechas: {formatearFechaSalida(fechaInicio)} — {formatearFechaSalida(fechaFin)}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilosEstadoSalida(estado)}`}>
                        {formatearEstadoSalida(estado)}
                    </span>
                    <Boton type="button" variante="secundario" onClick={onCancelar} disabled={guardando}>
                        Cerrar
                    </Boton>
                </div>
            </header>

            {/* Error devuelto por el servidor al confirmar */}
            {errorModificacion && (
                <Alerta
                    tipo="error"
                    titulo="Error al guardar las modificaciones de logística"
                >
                    <p>{errorModificacion}</p>
                </Alerta>
            )}

            {/* Advertencia inicial si el transporte está sin asignar */}
            {requerimientoTransporteSinAsignar && modoTransporte === "conservar" && (
                <Alerta
                    tipo="advertencia"
                    titulo="Requerimiento pendiente"
                >
                    <p>La salida actualmente no tiene transporte asignado (Sin asignar). Debe cubrirse este requerimiento antes del inicio de la salida.</p>
                </Alerta>
            )}

            {/* ========================================================== */}
            {/* SECCIÓN 1: TRANSPORTE                                     */}
            {/* ========================================================== */}
            <div className="rounded-lg border border-borde p-4 space-y-4 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">🚐</span>
                        <h3 className="text-sm font-bold text-texto uppercase tracking-wide">
                            Servicio de Transporte
                        </h3>
                    </div>
                    {transActual && modoTransporte === "conservar" && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setModoTransporte("cambiar");
                                    setIdTransporteNuevo(null);
                                    setComprobanteReserva("");
                                }}
                                className="text-xs font-semibold text-marca hover:underline cursor-pointer"
                            >
                                Reemplazar
                            </button>
                            <span className="text-texto-suave text-xs">·</span>
                            <button
                                type="button"
                                onClick={() => setModoTransporte("quitar")}
                                className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                                Desasignar
                            </button>
                        </div>
                    )}
                    {!transActual && modoTransporte === "conservar" && (
                        <button
                            type="button"
                            onClick={() => {
                                setModoTransporte("cambiar");
                                setIdTransporteNuevo(null);
                                setComprobanteReserva("");
                            }}
                            className="text-xs font-semibold text-marca hover:underline cursor-pointer"
                        >
                            + Asignar transporte
                        </button>
                    )}
                    {modoTransporte !== "conservar" && (
                        <button
                            type="button"
                            onClick={() => {
                                setModoTransporte("conservar");
                                setIdTransporteNuevo(null);
                                setComprobanteReserva("");
                            }}
                            className="text-xs font-semibold text-texto-suave hover:underline cursor-pointer"
                        >
                            Cancelar cambio de transporte
                        </button>
                    )}
                </div>

                {/* Vista cuando se conserva el estado original */}
                {modoTransporte === "conservar" && (
                    <div>
                        {transActual ? (
                            <div className="bg-white rounded border border-borde p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                    <p className="font-bold text-texto text-sm">{transActual.nombreServicio}</p>
                                    <p className="text-texto-suave">Proveedor: {transActual.proveedor.razonSocial}</p>
                                    <p className="text-texto-suave">
                                        Comprobante de reserva:{" "}
                                        <span className="font-mono font-medium text-slate-800">
                                            {transActual.comprobanteReserva || "No informado"}
                                        </span>
                                    </p>
                                </div>
                                <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                    Asignado actualmente
                                </span>
                            </div>
                        ) : (
                            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 font-medium">
                                No cuenta con servicio de transporte asignado.
                            </div>
                        )}
                    </div>
                )}

                {/* Vista cuando se marca para quitar (desasignar) */}
                {modoTransporte === "quitar" && transActual && (
                    <div className="p-3 bg-rose-50 rounded border border-rose-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-800">
                                Se desasignará: {transActual.nombreServicio} ({transActual.proveedor.razonSocial})
                            </span>
                            <span className="inline-flex items-center rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-900">
                                Pendiente de baja
                            </span>
                        </div>
                        <p className="text-rose-700">
                            La salida quedará sin transporte. Deberá cubrirse este requerimiento antes del inicio de la salida.
                        </p>
                    </div>
                )}

                {/* Vista cuando se selecciona o reemplaza */}
                {modoTransporte === "cambiar" && (
                    <div className="bg-white rounded border border-borde p-4 space-y-4">
                        <div className="space-y-1">
                            <label htmlFor={`${idSeccion}-sel-transporte`} className="block text-xs font-bold text-texto uppercase tracking-wide">
                                {transActual ? "Seleccionar transporte de reemplazo" : "Seleccionar transporte a asignar"}
                            </label>
                            {cargandoTransportes ? (
                                <p className="text-xs text-texto-suave">Consultando transportes disponibles...</p>
                            ) : errorTransportes ? (
                                <p className="text-xs text-rose-600">Error al cargar proveedores de transporte.</p>
                            ) : transportes.length === 0 ? (
                                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                                    No hay servicios de transporte activos disponibles con capacidad suficiente para los pasajeros confirmados de esta salida.
                                </p>
                            ) : (
                                <select
                                    id={`${idSeccion}-sel-transporte`}
                                    value={idTransporteNuevo ?? ""}
                                    onChange={(e) => setIdTransporteNuevo(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full rounded border border-borde p-2 text-xs text-texto focus:border-marca focus:outline-none"
                                >
                                    <option value="">-- Seleccioná un servicio de transporte --</option>
                                    {transportes.map((t) => (
                                        <option key={t.idservicio} value={t.idservicio}>
                                            {t.nombreServicio} — {t.proveedor.razonSocial} (Capacidad: {t.disponibilidad?.capacidadVehiculo ?? "?"} pas.)
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {idTransporteNuevo && (
                            <div className="space-y-1">
                                <label htmlFor={`${idSeccion}-comprobante`} className="block text-xs font-bold text-texto uppercase tracking-wide">
                                    Comprobante de reserva externa <span className="text-rose-600">*</span>
                                </label>
                                <input
                                    id={`${idSeccion}-comprobante`}
                                    type="text"
                                    value={comprobanteReserva}
                                    onChange={(e) => setComprobanteReserva(e.target.value)}
                                    placeholder="Ej. RES-EXT-4921"
                                    maxLength={100}
                                    className="w-full rounded border border-borde p-2 text-xs text-texto focus:border-marca focus:outline-none"
                                />
                                <p className="text-[11px] text-texto-suave">
                                    Obligatorio. Identificador de la confirmación o voucher emitido por el proveedor.
                                </p>
                            </div>
                        )}

                        {errorValidacionTransporte && (
                            <p className="text-xs text-rose-600 font-semibold">{errorValidacionTransporte}</p>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================================== */}
            {/* SECCIÓN 2: EQUIPAMIENTO                                   */}
            {/* ========================================================== */}
            <div className="rounded-lg border border-borde p-4 space-y-4 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">🎒</span>
                        <h3 className="text-sm font-bold text-texto uppercase tracking-wide">
                            Equipamiento Asignado
                        </h3>
                    </div>
                    <span className="text-xs text-texto-suave">
                        {eqActual.length} servicio{eqActual.length === 1 ? "" : "s"} asignado{eqActual.length === 1 ? "" : "s"}
                    </span>
                </div>

                {/* Tabla de equipamiento actualmente asignado */}
                {eqActual.length === 0 ? (
                    <div className="p-3 bg-white rounded border border-borde text-xs text-texto-suave">
                        La salida no tiene equipamiento asignado actualmente.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-texto bg-white rounded border border-borde">
                            <thead className="bg-slate-100 text-texto-suave font-semibold border-b border-borde">
                                <tr>
                                    <th className="p-2.5">Servicio</th>
                                    <th className="p-2.5">Proveedor</th>
                                    <th className="p-2.5">Tipo</th>
                                    <th className="p-2.5 text-center">Cantidad</th>
                                    <th className="p-2.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde">
                                {eqActual.map((eq) => {
                                    const estado = estadoOriginalEquipamiento[eq.idservicio];
                                    const estaQuitado = Boolean(estado?.quitado);
                                    const cantidadActual = estado?.cantidad ?? eq.cantidad;
                                    const stockAdicional = stockDisponiblePorServicio.get(eq.idservicio) ?? 0;
                                    const maxPermitido = eq.cantidad + stockAdicional;

                                    return (
                                        <tr
                                            key={eq.idservicio}
                                            className={estaQuitado ? "bg-rose-50/70 text-rose-900" : undefined}
                                        >
                                            <td className="p-2.5 font-medium">
                                                {eq.nombreServicio}
                                                {estaQuitado && (
                                                    <span className="ml-2 inline-flex items-center rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                                                        Baja
                                                    </span>
                                                )}
                                                {!estaQuitado && cantidadActual !== eq.cantidad && (
                                                    <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                                                        Modificado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5 text-texto-suave">{eq.proveedor?.razonSocial}</td>
                                            <td className="p-2.5 text-texto-suave">{eq.tipoEquipamiento || "—"}</td>
                                            <td className="p-2.5 text-center">
                                                {estaQuitado ? (
                                                    <span className="line-through text-texto-suave">{eq.cantidad}</span>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxPermitido}
                                                            value={cantidadActual}
                                                            onChange={(e) =>
                                                                manejarCambiarCantidadOriginal(
                                                                    eq.idservicio,
                                                                    Number(e.target.value),
                                                                    maxPermitido,
                                                                )
                                                            }
                                                            className="w-16 rounded border border-borde p-1 text-center font-semibold text-xs focus:border-marca focus:outline-none"
                                                        />
                                                        <span className="text-[11px] text-texto-suave">/ máx {maxPermitido}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => manejarAlternarQuitarOriginal(eq.idservicio, eq.cantidad)}
                                                    className={`font-semibold cursor-pointer text-xs ${
                                                        estaQuitado
                                                            ? "text-emerald-700 hover:underline"
                                                            : "text-rose-600 hover:underline"
                                                    }`}
                                                >
                                                    {estaQuitado ? "Restaurar" : "Quitar"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Equipamientos nuevos agregados en esta sesión */}
                {nuevosEquipamientos.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                            Equipamiento a incorporar
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-texto bg-emerald-50/40 rounded border border-emerald-200">
                                <thead className="bg-emerald-100/60 text-emerald-900 font-semibold border-b border-emerald-200">
                                    <tr>
                                        <th className="p-2.5">Servicio</th>
                                        <th className="p-2.5">Proveedor</th>
                                        <th className="p-2.5">Tipo</th>
                                        <th className="p-2.5 text-center">Cantidad</th>
                                        <th className="p-2.5 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-200">
                                    {nuevosEquipamientos.map((nuevo) => (
                                        <tr key={nuevo.idservicio}>
                                            <td className="p-2.5 font-bold text-emerald-900">
                                                {nuevo.nombreServicio}
                                            </td>
                                            <td className="p-2.5 text-emerald-800">{nuevo.proveedor}</td>
                                            <td className="p-2.5 text-emerald-800">{nuevo.tipoEquipamiento || "—"}</td>
                                            <td className="p-2.5 text-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={nuevo.stockMaximo}
                                                    value={nuevo.cantidad}
                                                    onChange={(e) =>
                                                        manejarCambiarCantidadNuevo(nuevo.idservicio, Number(e.target.value))
                                                    }
                                                    className="w-16 rounded border border-emerald-300 p-1 text-center font-bold text-xs bg-white focus:border-marca focus:outline-none"
                                                />
                                                <span className="ml-1 text-[11px] text-emerald-700">/ {nuevo.stockMaximo}</span>
                                            </td>
                                            <td className="p-2.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => manejarQuitarNuevoEquipamiento(nuevo.idservicio)}
                                                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Formulario para agregar otro servicio de equipamiento */}
                <div className="bg-white rounded border border-borde p-3 space-y-3">
                    <span className="text-xs font-bold text-texto uppercase tracking-wide block">
                        Agregar equipamiento adicional
                    </span>
                    {cargandoEquipamientos ? (
                        <p className="text-xs text-texto-suave">Cargando servicios de equipamiento disponibles...</p>
                    ) : errorEquipamientos ? (
                        <p className="text-xs text-rose-600">Error al consultar equipamientos disponibles.</p>
                    ) : opcionesEquipamientoDisponibles.length === 0 ? (
                        <p className="text-xs text-texto-suave">
                            No hay otros servicios de equipamiento con stock disponible en este momento.
                        </p>
                    ) : (
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[240px] space-y-1">
                                <label htmlFor={`${idSeccion}-sel-eq`} className="text-[11px] font-semibold text-texto-suave block">
                                    Servicio de equipamiento
                                </label>
                                <select
                                    id={`${idSeccion}-sel-eq`}
                                    value={idEquipamientoAAgregar ?? ""}
                                    onChange={(e) => {
                                        const id = e.target.value ? Number(e.target.value) : null;
                                        setIdEquipamientoAAgregar(id);
                                        setCantidadAAgregar(1);
                                    }}
                                    className="w-full rounded border border-borde p-2 text-xs text-texto focus:border-marca focus:outline-none"
                                >
                                    <option value="">-- Seleccioná un equipamiento disponible --</option>
                                    {opcionesEquipamientoDisponibles.map((eq) => (
                                        <option key={eq.idservicio} value={eq.idservicio}>
                                            {eq.nombreServicio} — {eq.proveedor?.razonSocial} (Stock: {eq.disponibilidad?.cantidadDisponible ?? 0})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-24 space-y-1">
                                <label htmlFor={`${idSeccion}-cant-eq`} className="text-[11px] font-semibold text-texto-suave block">
                                    Cantidad
                                </label>
                                <input
                                    id={`${idSeccion}-cant-eq`}
                                    type="number"
                                    min={1}
                                    max={
                                        idEquipamientoAAgregar
                                            ? equipamientos.find((e) => e.idservicio === idEquipamientoAAgregar)?.disponibilidad?.cantidadDisponible ?? 1
                                            : 1
                                    }
                                    value={cantidadAAgregar}
                                    onChange={(e) => setCantidadAAgregar(Math.max(1, Number(e.target.value)))}
                                    disabled={!idEquipamientoAAgregar}
                                    className="w-full rounded border border-borde p-2 text-xs text-center font-semibold text-texto focus:border-marca focus:outline-none disabled:bg-slate-100"
                                />
                            </div>
                            <Boton
                                type="button"
                                variante="secundario"
                                onClick={manejarAgregarNuevoEquipamiento}
                                disabled={!idEquipamientoAAgregar}
                            >
                                Añadir a la salida
                            </Boton>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================== */}
            {/* SECCIÓN 3: MOTIVO (OPCIONAL)                               */}
            {/* ========================================================== */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label htmlFor={`${idSeccion}-motivo`} className="text-xs font-bold text-texto uppercase tracking-wide">
                        Motivo de la modificación (Opcional)
                    </label>
                    <span className={`text-[11px] font-mono ${motivo.length > 300 ? "text-rose-600 font-bold" : "text-texto-suave"}`}>
                        {motivo.length}/300
                    </span>
                </div>
                <textarea
                    id={`${idSeccion}-motivo`}
                    rows={2}
                    maxLength={300}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Registrá el motivo de reasignación o desasignación para el registro de auditoría (ej. El proveedor original canceló el servicio)."
                    className="w-full rounded border border-borde p-2.5 text-xs text-texto focus:border-marca focus:outline-none"
                />
            </div>

            {/* ========================================================== */}
            {/* RESUMEN DE CAMBIOS Y ACCIONES                             */}
            {/* ========================================================== */}
            <footer className="border-t border-borde pt-4 space-y-4">
                {hayCambiosEfectivos ? (
                    <div className="bg-amber-50/60 border border-amber-200 rounded p-3 text-xs space-y-1.5">
                        <span className="font-bold text-amber-900 uppercase tracking-wide text-[11px] block">
                            Modificaciones pendientes ({resumenCambios.length}):
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-900 font-medium">
                            {resumenCambios.map((r, i) => (
                                <li key={i}>{r.detalle}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-xs text-texto-suave italic">
                        No se detectaron modificaciones en el transporte ni en el equipamiento.
                    </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Boton type="button" variante="secundario" onClick={onCancelar} disabled={guardando}>
                        Cancelar
                    </Boton>
                    <Boton
                        type="button"
                        variante="principal"
                        onClick={manejarSolicitarConfirmacion}
                        disabled={!formularioValido || guardando}
                    >
                        {guardando ? "Guardando cambios..." : "Guardar modificaciones"}
                    </Boton>
                </div>
            </footer>

            {/* Diálogo modal de confirmación */}
            <DialogoConfirmacion
                abierto={dialogoAbierto}
                titulo={`Confirmar modificaciones de logística · Salida #${nroSalida}`}
                descripcion={`¿Estás seguro de aplicar las modificaciones sobre la logística de esta salida? Se actualizará el inventario de equipamiento y los comprobantes de transporte de forma inmediata.${
                    motivoLimpio ? ` Motivo: "${motivoLimpio}".` : ""
                }`}
                textoConfirmar="Sí, modificar logística"
                textoCancelar="Revisar cambios"
                cargando={guardando}
                onConfirmar={manejarEjecutarConfirmacion}
                onCancelar={() => setDialogoAbierto(false)}
            />
        </section>
    );
}

export default FormularioModificarLogistica;
