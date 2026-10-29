import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import Alerta from "./Alerta";
import Boton from "./Boton";
import DialogoConfirmacion from "./DialogoConfirmacion";
import { ErrorApi } from "../services/clienteApi";
import { formatearFechaSalida } from "../services/guiaService";
import {
    claveMutacionDevolucion,
    useEquipamientoAsignado,
    useRegistrarDevolucion,
    type ItemEquipamientoAsignado,
    type ItemDevolucionPayload,
    type PayloadDevolucionEquipamiento,
    type ResultadoDevolucionEquipamiento,
    type Salida,
} from "../services/salidaService";

export type ModalDevolucionEquipamientoProps = {
    abierto: boolean;
    salida: Salida | null;
    onCerrar: () => void;
    onDevolucionExitosa: (resultado: ResultadoDevolucionEquipamiento) => void;
};

type ItemFormulario = {
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento: string;
    proveedor: string;
    cantidadAsignada: number;
    stockActualDisponible: number;
    cantidadBuenEstado: number;
    cantidadDaniada: number;
    observaciones: string;
};

type FormularioDevolucionContenidoProps = {
    salida: Salida;
    equipamientos: ItemEquipamientoAsignado[];
    onCerrar: () => void;
    onDevolucionExitosa: (resultado: ResultadoDevolucionEquipamiento) => void;
};

function FormularioDevolucionContenido({
    salida,
    equipamientos,
    onCerrar,
    onDevolucionExitosa,
}: FormularioDevolucionContenidoProps) {
    const [itemsForm, setItemsForm] = useState<ItemFormulario[]>(() =>
        equipamientos.map((eq) => ({
            idservicio: eq.idservicio,
            nombreServicio: eq.nombreServicio,
            tipoEquipamiento: eq.tipoEquipamiento,
            proveedor: eq.proveedor,
            cantidadAsignada: eq.cantidadAsignada,
            stockActualDisponible: eq.stockActualDisponible,
            cantidadBuenEstado: eq.cantidadAsignada, // Precarga por defecto con devolución total en buen estado
            cantidadDaniada: 0,
            observaciones: "",
        })),
    );
    const [observacionesGenerales, setObservacionesGenerales] = useState("");
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
    const [confirmacionAbierta, setConfirmacionAbierta] = useState(false);

    const registrarMutation = useRegistrarDevolucion();

    // Actualización de campos por ítem
    const actualizarBuenEstado = (idservicio: number, valor: number) => {
        setItemsForm((prev) =>
            prev.map((it) =>
                it.idservicio === idservicio
                    ? { ...it, cantidadBuenEstado: Number.isNaN(valor) ? 0 : Math.max(0, valor) }
                    : it,
            ),
        );
        setErrorEnvio(null);
    };

    const actualizarDaniada = (idservicio: number, valor: number) => {
        setItemsForm((prev) =>
            prev.map((it) =>
                it.idservicio === idservicio
                    ? { ...it, cantidadDaniada: Number.isNaN(valor) ? 0 : Math.max(0, valor) }
                    : it,
            ),
        );
        setErrorEnvio(null);
    };

    const actualizarObservaciones = (idservicio: number, valor: string) => {
        setItemsForm((prev) =>
            prev.map((it) => (it.idservicio === idservicio ? { ...it, observaciones: valor } : it)),
        );
        setErrorEnvio(null);
    };

    // Validación por ítem
    const erroresPorItem = useMemo(() => {
        const mapa = new Map<number, string>();
        for (const item of itemsForm) {
            const total = item.cantidadBuenEstado + item.cantidadDaniada;
            // SAL-15: se informa todo lo asignado; lo que no volvió va como dañado o extraviado
            if (total < item.cantidadAsignada) {
                mapa.set(
                    item.idservicio,
                    `Faltan informar ${item.cantidadAsignada - total} uds.: cargalas como dañadas o extraviadas.`,
                );
            } else if (total > item.cantidadAsignada) {
                mapa.set(
                    item.idservicio,
                    `La suma devuelta (${total}) supera la cantidad que la salida tenía asignada (${item.cantidadAsignada}).`,
                );
            } else if (item.observaciones.length > 250) {
                mapa.set(
                    item.idservicio,
                    "Las observaciones no pueden superar los 250 caracteres.",
                );
            }
        }
        return mapa;
    }, [itemsForm]);

    const errorObservacionesGenerales =
        observacionesGenerales.length > 500
            ? "Las observaciones generales no pueden superar los 500 caracteres."
            : null;

    const formularioValido =
        itemsForm.length > 0 &&
        erroresPorItem.size === 0 &&
        !errorObservacionesGenerales;

    // Totales calculados
    const { totalBuenEstado, totalDaniadas, totalSinDevolver } = useMemo(() => {
        let buenEstado = 0;
        let daniadas = 0;
        let sinDevolver = 0;
        for (const it of itemsForm) {
            buenEstado += it.cantidadBuenEstado;
            daniadas += it.cantidadDaniada;
            const diff = it.cantidadAsignada - (it.cantidadBuenEstado + it.cantidadDaniada);
            if (diff > 0) sinDevolver += diff;
        }
        return { totalBuenEstado: buenEstado, totalDaniadas: daniadas, totalSinDevolver: sinDevolver };
    }, [itemsForm]);

    // Ejecución final del POST tras confirmación
    const ejecutarRegistroDevolucion = () => {
        if (!salida.idsalida || !formularioValido) return;

        const payload: PayloadDevolucionEquipamiento = {
            observacionesGenerales: observacionesGenerales.trim() ? observacionesGenerales.trim() : null,
            items: itemsForm.map((it): ItemDevolucionPayload => {
                const itemDto: ItemDevolucionPayload = {
                    idservicio: it.idservicio,
                    cantidadBuenEstado: it.cantidadBuenEstado,
                    cantidadDaniada: it.cantidadDaniada,
                };
                if (it.observaciones.trim()) {
                    itemDto.observaciones = it.observaciones.trim();
                }
                return itemDto;
            }),
        };

        registrarMutation.mutate(
            { idsalida: salida.idsalida, datos: payload },
            {
                onSuccess: (resultado) => {
                    setConfirmacionAbierta(false);
                    onDevolucionExitosa(resultado);
                    onCerrar();
                },
                onError: (error) => {
                    setConfirmacionAbierta(false);
                    if (error instanceof ErrorApi) {
                        setErrorEnvio(error.message);
                    } else {
                        setErrorEnvio("Ocurrió un error inesperado al registrar la devolución.");
                    }
                },
            },
        );
    };

    return (
        <>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (formularioValido) {
                        setConfirmacionAbierta(true);
                    }
                }}
                className="space-y-5"
            >
                {/* Error de envío del backend */}
                {errorEnvio && (
                    <Alerta tipo="error" titulo="Error al registrar la devolución">
                        {errorEnvio}
                    </Alerta>
                )}

                {/* Listado de artículos a devolver */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-navegacion flex items-center justify-between">
                        <span>Artículos asignados ({itemsForm.length})</span>
                        <span className="text-xs font-normal normal-case text-texto-suave">
                            Indicá las cantidades en buen estado y dañadas/extraviadas
                        </span>
                    </h3>

                    <div className="space-y-3">
                        {itemsForm.map((item) => {
                            const errorItem = erroresPorItem.get(item.idservicio);
                            const totalDevuelto = item.cantidadBuenEstado + item.cantidadDaniada;
                            const sinDevolver = item.cantidadAsignada - totalDevuelto;

                            return (
                                <div
                                    key={item.idservicio}
                                    className={`rounded-tarjeta border p-4 transition-colors ${
                                        errorItem
                                            ? "border-rose-300 bg-rose-50/40"
                                            : "border-borde bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-texto text-sm">
                                                    {item.nombreServicio}
                                                </h4>
                                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                    {item.tipoEquipamiento}
                                                </span>
                                            </div>
                                            <p className="text-xs text-texto-suave mt-0.5">
                                                Proveedor:{" "}
                                                <span className="font-medium text-texto">
                                                    {item.proveedor}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                                                Asignado:{" "}
                                                <strong className="text-navegacion font-bold text-sm">
                                                    {item.cantidadAsignada}
                                                </strong>{" "}
                                                {item.cantidadAsignada === 1 ? "ud." : "uds."}
                                            </span>
                                            <span className="text-slate-500 text-[11px]">
                                                Stock disp. actual: {item.stockActualDisponible}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Inputs de cantidades */}
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                        <div>
                                            <label
                                                htmlFor={`buen-estado-${item.idservicio}`}
                                                className="block text-xs font-semibold text-emerald-900 mb-1"
                                            >
                                                ✓ En buen estado (reintegra stock):
                                            </label>
                                            <input
                                                id={`buen-estado-${item.idservicio}`}
                                                type="number"
                                                min={0}
                                                max={item.cantidadAsignada}
                                                value={item.cantidadBuenEstado}
                                                onChange={(e) =>
                                                    actualizarBuenEstado(
                                                        item.idservicio,
                                                        parseInt(e.target.value, 10),
                                                    )
                                                }
                                                disabled={registrarMutation.isPending}
                                                className="w-full rounded-control border border-emerald-300 bg-emerald-50/30 px-3 py-1.5 text-sm font-semibold text-texto focus:border-marca focus:bg-white focus:outline-none focus:ring-1 focus:ring-marca disabled:opacity-50"
                                            />
                                        </div>

                                        <div>
                                            <label
                                                htmlFor={`daniada-${item.idservicio}`}
                                                className="block text-xs font-semibold text-rose-900 mb-1"
                                            >
                                                ✕ Dañado / Extraviado (no reintegra):
                                            </label>
                                            <input
                                                id={`daniada-${item.idservicio}`}
                                                type="number"
                                                min={0}
                                                max={item.cantidadAsignada}
                                                value={item.cantidadDaniada}
                                                onChange={(e) =>
                                                    actualizarDaniada(
                                                        item.idservicio,
                                                        parseInt(e.target.value, 10),
                                                    )
                                                }
                                                disabled={registrarMutation.isPending}
                                                className="w-full rounded-control border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-texto focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 disabled:opacity-50"
                                            />
                                        </div>

                                        {/* Estado de balance de devolución */}
                                        <div className="pb-1 text-xs">
                                            {sinDevolver > 0 && totalDevuelto > 0 && (
                                                <p className="text-amber-800 font-medium">
                                                    Quedan <strong>{sinDevolver}</strong> uds. sin devolver.
                                                </p>
                                            )}
                                            {sinDevolver === 0 && (
                                                <p className="text-emerald-700 font-medium">
                                                    Total devuelto: {totalDevuelto} / {item.cantidadAsignada}
                                                </p>
                                            )}
                                            {sinDevolver < 0 && (
                                                <p className="text-rose-700 font-bold">
                                                    Supera asignación por {Math.abs(sinDevolver)} uds.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Observaciones del ítem */}
                                    <div className="mt-3">
                                        <label
                                            htmlFor={`obs-${item.idservicio}`}
                                            className="block text-xs font-medium text-texto-suave mb-1"
                                        >
                                            Observaciones de inspección (opcional, máx. 250 car.):
                                        </label>
                                        <input
                                            id={`obs-${item.idservicio}`}
                                            type="text"
                                            maxLength={250}
                                            placeholder="Ej: 1 carpa con varilla doblada, bolsa de transporte rasgada..."
                                            value={item.observaciones}
                                            onChange={(e) =>
                                                actualizarObservaciones(
                                                    item.idservicio,
                                                    e.target.value,
                                                )
                                            }
                                            disabled={registrarMutation.isPending}
                                            className="w-full rounded-control border border-borde bg-white px-3 py-1.5 text-xs text-texto placeholder:text-slate-400 focus:border-marca focus:outline-none focus:ring-1 focus:ring-marca disabled:opacity-50"
                                        />
                                        <div className="flex justify-between items-center text-[10px] text-texto-suave mt-0.5">
                                            <span>{errorItem ? <strong className="text-rose-600">{errorItem}</strong> : null}</span>
                                            <span>{item.observaciones.length} / 250</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Observaciones Generales */}
                <div className="rounded-tarjeta border border-borde bg-slate-50/60 p-4 space-y-2">
                    <label
                        htmlFor="observaciones-generales"
                        className="block text-xs font-bold uppercase tracking-wider text-navegacion"
                    >
                        Observaciones Generales de la Devolución (opcional)
                    </label>
                    <textarea
                        id="observaciones-generales"
                        rows={2}
                        maxLength={500}
                        placeholder="Detalles globales de la recepción en depósito o aclaraciones de la entrega..."
                        value={observacionesGenerales}
                        onChange={(e) => {
                            setObservacionesGenerales(e.target.value);
                            setErrorEnvio(null);
                        }}
                        disabled={registrarMutation.isPending}
                        className="w-full rounded-control border border-borde bg-white p-2.5 text-xs text-texto placeholder:text-slate-400 focus:border-marca focus:outline-none focus:ring-1 focus:ring-marca disabled:opacity-50"
                    />
                    <div className="flex justify-between items-center text-[11px] text-texto-suave">
                        <span>
                            {errorObservacionesGenerales && (
                                <strong className="text-rose-600">
                                    {errorObservacionesGenerales}
                                </strong>
                            )}
                        </span>
                        <span>{observacionesGenerales.length} / 500</span>
                    </div>
                </div>

                {/* Resumen cuantitativo */}
                <div className="rounded-control bg-slate-100 border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                        <span className="text-texto-suave">A reintegrar al stock:</span>
                        <p className="text-sm font-extrabold text-emerald-800">
                            {totalBuenEstado} unidades (buen estado)
                        </p>
                    </div>
                    <div>
                        <span className="text-texto-suave">Dañadas o extraviadas:</span>
                        <p className="text-sm font-extrabold text-rose-800">
                            {totalDaniadas} unidades
                        </p>
                    </div>
                    <div>
                        <span className="text-texto-suave">Sin devolver:</span>
                        <p className={`text-sm font-extrabold ${totalSinDevolver > 0 ? "text-amber-800" : "text-slate-600"}`}>
                            {totalSinDevolver} unidades
                        </p>
                    </div>
                </div>

                {/* Acciones del formulario */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-borde">
                    <Boton
                        type="button"
                        variante="secundario"
                        onClick={onCerrar}
                        disabled={registrarMutation.isPending}
                    >
                        Cancelar
                    </Boton>
                    <Boton
                        type="submit"
                        variante="principal"
                        disabled={!formularioValido || registrarMutation.isPending}
                        cargando={registrarMutation.isPending}
                    >
                        Registrar devolución
                    </Boton>
                </div>
            </form>

            {/* Diálogo de Confirmación antes del POST */}
            <DialogoConfirmacion
                abierto={confirmacionAbierta}
                titulo="Confirmar Devolución de Equipamiento"
                descripcion={`¿Confirmás el registro de la devolución para la salida ${salida.nroSalida}? Se reintegrarán ${totalBuenEstado} unidades al stock del proveedor y ${totalDaniadas} unidades quedarán registradas como dañadas o extraviadas. Esta acción impactará el inventario y guardará el registro de trazabilidad en auditoría (RF-56).`}
                textoConfirmar="Confirmar devolución"
                textoCancelar="Revisar cantidades"
                cargando={registrarMutation.isPending}
                onConfirmar={ejecutarRegistroDevolucion}
                onCancelar={() => setConfirmacionAbierta(false)}
            />
        </>
    );
}

export function ModalDevolucionEquipamiento({
    abierto,
    salida,
    onCerrar,
    onDevolucionExitosa,
}: ModalDevolucionEquipamientoProps) {
    const tituloId = useId();
    const descripcionId = useId();

    const idsalida = salida?.idsalida ?? null;

    // Consulta de equipamiento asignado a la salida (CU-41)
    const {
        data: datosEquipamiento,
        isPending: cargandoEquipamiento,
        error: errorConsulta,
        refetch: recargarEquipamiento,
    } = useEquipamientoAsignado(idsalida, {
        enabled: abierto && idsalida !== null,
    });

    // FE-45: con el registro en curso no se cierra (Escape, clic afuera ni Cancelar)
    const registrando = useIsMutating({ mutationKey: claveMutacionDevolucion }) > 0;
    const manejarCerrar = useCallback(() => {
        if (registrando) return;
        onCerrar();
    }, [onCerrar, registrando]);

    // Cierre con Escape
    useEffect(() => {
        if (!abierto) return;

        function manejarTecla(evento: KeyboardEvent) {
            if (evento.key === "Escape") {
                manejarCerrar();
            }
        }

        document.addEventListener("keydown", manejarTecla);
        return () => {
            document.removeEventListener("keydown", manejarTecla);
        };
    }, [abierto, manejarCerrar]);

    if (!abierto || !salida) {
        return null;
    }

    const sinEquipamiento =
        !cargandoEquipamiento &&
        !errorConsulta &&
        (datosEquipamiento?.equipamientos?.length ?? 0) === 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 overflow-y-auto"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget) {
                    manejarCerrar();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                aria-describedby={descripcionId}
                className="w-full max-w-4xl rounded-tarjeta bg-white p-6 shadow-tarjeta max-h-[92vh] overflow-y-auto space-y-5"
            >
                {/* Cabecera */}
                <div className="border-b border-borde pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            <span aria-hidden="true">📦</span> Inspección e reintegro a stock
                        </span>
                    </div>

                    <h2 id={tituloId} className="mt-2 text-xl font-bold text-texto">
                        Registrar Devolución de Equipamiento
                    </h2>

                    <p id={descripcionId} className="mt-1 text-sm text-texto-suave">
                        Inspeccioná y registrá el estado del equipamiento de camping asignado a la salida. Las unidades en buen estado se reintegrarán automáticamente al stock disponible del proveedor.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-texto-suave bg-slate-50 p-2.5 rounded-control border border-borde">
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
                            Fecha de finalización:{" "}
                            <span className="font-semibold text-texto">
                                {formatearFechaSalida(salida.fechaFin)}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Estado de carga */}
                {cargandoEquipamiento && (
                    <div className="flex items-center justify-center gap-3 py-12 text-texto-suave">
                        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                        <span className="text-sm font-medium">
                            Cargando equipamiento asignado a la salida...
                        </span>
                    </div>
                )}

                {/* Error al consultar equipamiento */}
                {errorConsulta && !cargandoEquipamiento && (
                    <div className="space-y-4">
                        <Alerta tipo="error" titulo="No se pudo consultar el equipamiento">
                            {errorConsulta instanceof ErrorApi
                                ? errorConsulta.message
                                : "Ocurrió un error al cargar la información del equipamiento."}
                        </Alerta>
                        <div className="flex justify-end gap-2">
                            <Boton variante="secundario" onClick={() => recargarEquipamiento()}>
                                Reintentar consulta
                            </Boton>
                            <Boton variante="secundario" onClick={manejarCerrar}>
                                Volver
                            </Boton>
                        </div>
                    </div>
                )}

                {/* Salida sin equipamiento de camping */}
                {sinEquipamiento && (
                    <div className="space-y-4">
                        <Alerta
                            tipo="informacion"
                            titulo="La salida no tiene equipamiento de camping asignado"
                        >
                            Esta salida concluyó sin artículos de equipamiento de camping asignados en su logística. No requiere devolución ni reintegro de stock.
                        </Alerta>
                        <div className="flex justify-end">
                            <Boton variante="secundario" onClick={manejarCerrar}>
                                Cerrar
                            </Boton>
                        </div>
                    </div>
                )}

                {/* Formulario de devolución */}
                {!cargandoEquipamiento &&
                    !errorConsulta &&
                    datosEquipamiento &&
                    datosEquipamiento.equipamientos.length > 0 && (
                        <FormularioDevolucionContenido
                            key={salida.idsalida}
                            salida={salida}
                            equipamientos={datosEquipamiento.equipamientos}
                            onCerrar={manejarCerrar}
                            onDevolucionExitosa={onDevolucionExitosa}
                        />
                    )}
            </section>
        </div>
    );
}

export default ModalDevolucionEquipamiento;
