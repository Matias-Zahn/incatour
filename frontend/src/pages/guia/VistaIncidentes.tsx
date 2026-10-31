import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import { ErrorApi } from "../../services/clienteApi";
import {
    agregarHistorialLocalIncidente,
    esquemaIncidente,
    estilosEstadoSalida,
    etiquetasNivelGravedad,
    etiquetasTipoIncidente,
    fechaLocalHoy,
    formatearEstadoSalida,
    formatearFechaHora,
    guardarIncidenteOffline,
    nivelesGravedad,
    obtenerHistorialLocalIncidentes,
    ESTADOS_CON_AVANCES,
    tiposIncidente,
    usePasajerosSalida,
    useRegistrarIncidente,
    type DatosIncidenteForm,
    type DetalleSalidaGuia,
    type NivelGravedad,
    type RegistroHistorialIncidente,
    type SalidaGuiaResumen,
} from "../../services/guiaService";
import {
    IconoCerrar,
    IconoInfo,
    IconoMontana,
} from "./IconosGuia";
import type { SincronizacionIncidentes } from "./useSincronizacionIncidentes";

type VistaIncidentesProps = {
    salidaActual: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
    sincronizacion: SincronizacionIncidentes;
    /** Avisa si hay un incidente a medio cargar, que se perdería al cambiar de salida */
    onCambioEdicion: (enCurso: boolean) => void;
    cargando?: boolean;
};

export function VistaIncidentes({
    salidaActual,
    detalleSalida,
    sincronizacion,
    onCambioEdicion,
    cargando = false,
}: VistaIncidentesProps) {
    const idsalida = salidaActual?.idsalida ?? 0;
    const registrarIncidenteMutation = useRegistrarIncidente();
    const { data: pasajerosSalida = [] } = usePasajerosSalida(idsalida);

    const [modalDescartarAbierto, setModalDescartarAbierto] = useState(false);
    const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
    const [modalMasPasajerosAbierto, setModalMasPasajerosAbierto] = useState(false);
    const [mensajeFeedback, setMensajeFeedback] = useState<{
        tipo: "exito" | "error" | "advertencia";
        texto: string;
    } | null>(null);

    const [pasajerosSeleccionados, setPasajerosSeleccionados] = useState<number[]>([]);

    // Se lee en cada render: la sincronización puede sacar un incidente rechazado
    // Lo del servidor se ve desde cualquier celular; de lo local queda solo lo que el servidor todavía no tiene
    const delServidor: RegistroHistorialIncidente[] = (detalleSalida?.incidentes ?? []).map((i) => ({
        id: `inc_${i.idincidente}`,
        tipoIncidente: i.tipoIncidente,
        nivelGravedad: i.nivelGravedad,
        descripcion: i.descripcion,
        fechaHora: formatearFechaHora(i.fechaHoraReporte),
    }));
    const idsDelServidor = new Set(delServidor.map((i) => i.id));
    const historialIncidentes = [
        ...obtenerHistorialLocalIncidentes(idsalida).filter((i) => !idsDelServidor.has(i.id)),
        ...delServidor,
    ];
    const idsPendientes = new Set(sincronizacion.pendientes.map((p) => p.idLocal));

    const fechaHoy = fechaLocalHoy();
    const horaActual = new Date().toTimeString().slice(0, 5);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<DatosIncidenteForm>({
        resolver: zodResolver(esquemaIncidente),
        defaultValues: {
            tipoIncidente: "ACCIDENTE",
            descripcion: "",
            nivelGravedad: "BAJO",
            fechaOcurrencia: fechaHoy,
            horaOcurrencia: horaActual,
            pasajerosAfectados: [],
        },
    });

    const textoDescripcion = useWatch({ control, name: "descripcion" }) ?? "";

    const enEdicion = isDirty || pasajerosSeleccionados.length > 0;
    useEffect(() => {
        onCambioEdicion(enEdicion);
        return () => onCambioEdicion(false);
    }, [enEdicion, onCambioEdicion]);

    if (!salidaActual || idsalida <= 0) {
        return (
            <section aria-label="Notificar incidente operativo" className="space-y-6">
                <header className="border-b border-borde/60 pb-4">
                    <h1 className="text-2xl font-bold text-navegacion md:text-3xl">
                        Notificar incidente
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Reporta cualquier incidente ocurrido durante la salida
                    </p>
                </header>
                <div className="rounded-tarjeta border border-borde bg-white p-8 text-center text-sm text-texto-suave shadow-tarjeta">
                    {cargando
                        ? "Cargando información de la salida..."
                        : "No tienes una salida asignada seleccionada para notificar incidentes."}
                </div>
            </section>
        );
    }

    function alternarPasajero(idpasajero: number) {
        setPasajerosSeleccionados((prev) =>
            prev.includes(idpasajero)
                ? prev.filter((id) => id !== idpasajero)
                : [...prev, idpasajero],
        );
    }

    function descartarFormulario() {
        reset({
            tipoIncidente: "ACCIDENTE",
            descripcion: "",
            nivelGravedad: "BAJO",
            fechaOcurrencia: fechaHoy,
            horaOcurrencia: horaActual,
            pasajerosAfectados: [],
        });
        setPasajerosSeleccionados([]);
        setMensajeFeedback(null);
        setModalDescartarAbierto(false);
    }

    async function enviarIncidente(datos: DatosIncidenteForm) {
        setMensajeFeedback(null);

        const fechaHoraCombinada = `${datos.fechaOcurrencia}T${datos.horaOcurrencia}:00`;
        const fechaHoraIso = new Date(fechaHoraCombinada).toISOString();
        const payload = {
            tipoIncidente: datos.tipoIncidente,
            descripcion: datos.descripcion.trim(),
            nivelGravedad: datos.nivelGravedad,
            fechaHoraOcurrencia: fechaHoraIso,
            pasajerosAfectados:
                pasajerosSeleccionados.length > 0 ? pasajerosSeleccionados : undefined,
        };

        function registrarEnHistorial(id: string) {
            const item: RegistroHistorialIncidente = {
                id,
                tipoIncidente: datos.tipoIncidente,
                nivelGravedad: datos.nivelGravedad,
                descripcion: datos.descripcion.trim(),
                fechaHora: formatearFechaHora(fechaHoraIso),
            };
            agregarHistorialLocalIncidente(idsalida, item);
            // Primero limpiar el formulario (resetea el feedback) y después mostrar el resultado
            descartarFormulario();
        }

        function guardarSinSenal() {
            registrarEnHistorial(guardarIncidenteOffline(idsalida, payload).idLocal);
            sincronizacion.refrescar();
            setMensajeFeedback({
                tipo: "advertencia",
                texto: "Sin conexión: el incidente quedó guardado en tu dispositivo y se enviará cuando recuperes señal.",
            });
        }

        if (!navigator.onLine) {
            guardarSinSenal();
            return;
        }

        try {
            const respuesta = await registrarIncidenteMutation.mutateAsync({ idsalida, payload });

            const idGenerado = String(
                (respuesta.data as { idincidente?: number } | undefined)?.idincidente ??
                    historialIncidentes.length + 1,
            );
            registrarEnHistorial(`inc_${idGenerado}`);

            setMensajeFeedback({
                tipo: "exito",
                texto: "Notificación de incidente enviada exitosamente al equipo de administración.",
            });
        } catch (error: unknown) {
            // Todo error que no es una respuesta del servidor es de red
            if (!(error instanceof ErrorApi)) {
                guardarSinSenal();
                return;
            }
            setMensajeFeedback({
                tipo: "error",
                texto: error.message || "Ocurrió un error al intentar notificar el incidente.",
            });
        }
    }

    // Lista de pasajeros para la tabla
    const listaPasajeros =
        pasajerosSalida.length > 0
            ? pasajerosSalida
            : detalleSalida?.nomina?.map((p) => ({
                  idpasajero: p.idpasajero,
                  nombreCompleto: p.nombreCompleto,
                  nroPasaporte: p.nroPasaporte,
              })) ?? [];

    function claseGravedad(gravedad: NivelGravedad) {
        if (gravedad === "CRITICO") return "bg-rose-100 text-rose-800";
        if (gravedad === "MEDIO") return "bg-amber-100 text-amber-800";
        return "bg-emerald-100 text-emerald-800";
    }

    return (
        <section aria-label="Notificar incidente operativo" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Atención operativa
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-navegacion md:text-3xl">
                        Notificar incidente
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Reporta cualquier incidente ocurrido durante la salida
                    </p>
                </div>

                <div className="flex max-w-sm items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50/80 p-3.5 text-xs text-cyan-900 shadow-xs">
                    <IconoInfo tamano={20} className="shrink-0 text-marca" />
                    <p className="leading-relaxed">
                        La notificación será enviada inmediatamente al equipo de administración. Puedes seleccionar opcionalmente qué pasajeros resultaron afectados.
                    </p>
                </div>
            </div>

            {/* Banner de Salida Actual */}
            <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-l-4 border-l-[#16d6dc] border-y border-r border-borde bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr_auto]">
                <div className="grid size-12 place-items-center rounded-xl bg-[#1b9fc7] text-white">
                    <IconoMontana tamano={24} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-navegacion">
                        Salida actual: {salidaActual.nroSalida}
                    </h2>
                    <p className="text-xs text-texto-suave">
                        {salidaActual.circuito} {salidaActual.paquete ? `· ${salidaActual.paquete}` : ""}
                    </p>
                </div>
                <div>
                    <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${estilosEstadoSalida(
                            salidaActual.estado,
                        )}`}
                    >
                        {formatearEstadoSalida(salidaActual.estado)}
                    </span>
                </div>
            </article>

            {/* Grilla principal: Formulario a la izquierda, Pasajeros e Historial a la derecha */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                {/* Formulario de Incidente */}
                <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <h2 className="border-b border-borde/70 pb-3 text-base font-bold text-navegacion">
                        Datos del incidente
                    </h2>

                    {ESTADOS_CON_AVANCES.includes(salidaActual.estado) ? null : (
                        <div className="mt-5">
                            <Alerta tipo="informacion">Esta salida ya terminó: no admite incidentes nuevos.</Alerta>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(enviarIncidente)} noValidate className="mt-5">
                    <fieldset disabled={!ESTADOS_CON_AVANCES.includes(salidaActual.estado)} className="min-w-0 space-y-4 disabled:opacity-60">
                        {mensajeFeedback ? (
                            <Alerta tipo={mensajeFeedback.tipo}>
                                {mensajeFeedback.texto}
                            </Alerta>
                        ) : null}

                        {/* Descripción */}
                        <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                            <span>Descripción del incidente *</span>
                            <textarea
                                rows={4}
                                maxLength={1000}
                                placeholder="Describa lo ocurrido en detalle (mínimo 5 caracteres)..."
                                {...register("descripcion")}
                                className="w-full min-w-0 rounded-control border border-borde bg-white p-3 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                            />
                            <div className="flex justify-between text-[11px] text-texto-suave">
                                <span>
                                    {errors.descripcion ? (
                                        <span className="text-peligro font-normal">
                                            {errors.descripcion.message}
                                        </span>
                                    ) : (
                                        "Entre 5 y 1000 caracteres"
                                    )}
                                </span>
                                <span>{textoDescripcion.length}/1000</span>
                            </div>
                        </label>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Fecha */}
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Fecha del incidente *</span>
                                <input
                                    type="date"
                                    {...register("fechaOcurrencia")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.fechaOcurrencia ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.fechaOcurrencia.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Hora */}
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Hora del incidente *</span>
                                <input
                                    type="time"
                                    {...register("horaOcurrencia")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.horaOcurrencia ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.horaOcurrencia.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Tipo de Incidente */}
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Tipo de incidente *</span>
                                <select
                                    {...register("tipoIncidente")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    {tiposIncidente.map((t) => (
                                        <option key={t} value={t}>
                                            {etiquetasTipoIncidente[t]}
                                        </option>
                                    ))}
                                </select>
                                {errors.tipoIncidente ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.tipoIncidente.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Nivel de Gravedad */}
                            <label className="grid min-w-0 grid-cols-1 gap-1.5 text-xs font-bold text-texto">
                                <span>Nivel de gravedad *</span>
                                <select
                                    {...register("nivelGravedad")}
                                    className="min-h-11 w-full min-w-0 rounded-control border border-borde bg-white px-3 py-2 text-base text-texto outline-none md:text-sm focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    {nivelesGravedad.map((g) => (
                                        <option key={g} value={g}>
                                            {etiquetasNivelGravedad[g]}
                                        </option>
                                    ))}
                                </select>
                                {errors.nivelGravedad ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.nivelGravedad.message}
                                    </span>
                                ) : null}
                            </label>
                        </div>

                        {pasajerosSeleccionados.length > 0 ? (
                            <div className="rounded-xl bg-cyan-50 p-2.5 text-xs text-cyan-900 font-medium">
                                Pasajeros afectados seleccionados: <b>{pasajerosSeleccionados.length}</b>
                            </div>
                        ) : null}

                        <div className="flex items-center justify-end gap-3 pt-3">
                            <Boton
                                type="button"
                                variante="secundario"
                                onClick={() => setModalDescartarAbierto(true)}
                            >
                                Cancelar
                            </Boton>
                            <Boton
                                type="submit"
                                variante="principal"
                                cargando={registrarIncidenteMutation.isPending}
                            >
                                Enviar Notificación
                            </Boton>
                        </div>
                    </fieldset>
                    </form>
                </article>

                {/* Columna Derecha: Selección de Pasajeros e Historial */}
                <div className="space-y-6 max-lg:order-first">
                    {/* Pasajeros afectados */}
                    <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                        <h2 className="text-sm font-bold text-navegacion">
                            Pasajeros afectados (opcional)
                        </h2>
                        <p className="mt-1 text-xs text-texto-suave">
                            Selecciona a quienes se hayan visto afectados
                        </p>

                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-xs" aria-label="Pasajeros de la salida">
                                <thead>
                                    <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                        <th className="w-9 py-2"></th>
                                        <th className="py-2">ID/Pasaporte</th>
                                        <th className="py-2">Nombre completo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-borde/50">
                                    {listaPasajeros.slice(0, 4).map((p) => {
                                        const seleccionado = pasajerosSeleccionados.includes(
                                            p.idpasajero,
                                        );
                                        return (
                                            <tr
                                                key={p.idpasajero}
                                                className={`cursor-pointer transition-colors ${
                                                    seleccionado ? "bg-cyan-50/60" : ""
                                                }`}
                                                onClick={() => alternarPasajero(p.idpasajero)}
                                            >
                                                <td className="py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={seleccionado}
                                                        onChange={() => {}}
                                                        aria-label={`Afectado: ${p.nombreCompleto}`}
                                                        className="size-6 rounded border-borde text-marca focus:ring-marca"
                                                    />
                                                </td>
                                                <td className="py-2 font-medium text-texto">
                                                    {p.nroPasaporte}
                                                </td>
                                                <td className="py-2 text-texto">
                                                    {p.nombreCompleto}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {listaPasajeros.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-4 text-center text-xs text-texto-suave">
                                                No hay pasajeros registrados para esta salida
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        {listaPasajeros.length > 4 ? (
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setModalMasPasajerosAbierto(true)}
                                    className="text-xs font-bold text-marca hover:underline"
                                >
                                    Ver nómina para seleccionar ({listaPasajeros.length})...
                                </button>
                            </div>
                        ) : null}
                    </article>

                    {/* Historial de incidentes */}
                    <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                        <div className="flex items-start justify-between border-b border-borde/70 pb-3">
                            <div>
                                <h2 className="text-sm font-bold text-navegacion">
                                    Incidentes reportados
                                </h2>
                                <p className="text-[11px] text-texto-suave">
                                    Últimos reportes de esta salida
                                </p>
                            </div>
                            {historialIncidentes.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setModalHistorialAbierto(true)}
                                    className="text-xs font-bold text-marca hover:underline"
                                >
                                    Ver historial
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-3 divide-y divide-borde/50">
                            {historialIncidentes.slice(0, 3).map((item) => (
                                <div key={item.id} className="py-2.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-texto">
                                            {etiquetasTipoIncidente[item.tipoIncidente] ?? item.tipoIncidente}
                                        </p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${claseGravedad(
                                                item.nivelGravedad,
                                            )}`}
                                        >
                                            {etiquetasNivelGravedad[item.nivelGravedad] ?? item.nivelGravedad}
                                        </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-[11px] text-texto-suave">
                                        {item.descripcion}
                                    </p>
                                    <p className="mt-1 text-[10px] text-texto-suave">
                                        {item.fechaHora}
                                        {idsPendientes.has(item.id) ? (
                                            <span className="ml-2 font-semibold text-amber-700">
                                                (Pendiente de envío)
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                            ))}

                            {historialIncidentes.length === 0 ? (
                                <p className="py-6 text-center text-xs text-texto-suave">
                                    No hay incidentes reportados en esta salida
                                </p>
                            ) : null}
                        </div>
                    </article>
                </div>
            </div>

            {/* Modal de Descarte (Usando DialogoConfirmacion) */}
            <DialogoConfirmacion
                abierto={modalDescartarAbierto}
                titulo="¿Descartar los datos ingresados?"
                descripcion="Los datos del incidente y los pasajeros seleccionados se limpiarán del formulario."
                textoConfirmar="Sí, descartar"
                textoCancelar="Seguir editando"
                onConfirmar={descartarFormulario}
                onCancelar={() => setModalDescartarAbierto(false)}
            />

            {/* Modal Selección Completa de Pasajeros Afectados */}
            {modalMasPasajerosAbierto ? (
                <Modal
                    onCerrar={() => setModalMasPasajerosAbierto(false)}
                    etiqueta="Seleccionar pasajeros afectados"
                    className="p-6"
                >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    Salida {salidaActual.nroSalida}
                                </p>
                                <h2 className="text-lg font-bold text-navegacion">
                                    Pasajeros de la salida
                                </h2>
                                <p className="text-xs text-texto-suave">
                                    Marca las casillas de los pasajeros que resultaron afectados por el incidente.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalMasPasajerosAbierto(false)}
                                aria-label="Cerrar"
                                className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
                            >
                                <IconoCerrar tamano={20} />
                            </button>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                        <th className="w-9 py-2"></th>
                                        <th className="py-2">ID/Pasaporte</th>
                                        <th className="py-2">Nombre completo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-borde/50">
                                    {listaPasajeros.map((p) => {
                                        const marcado = pasajerosSeleccionados.includes(p.idpasajero);
                                        return (
                                            <tr
                                                key={p.idpasajero}
                                                className={`cursor-pointer transition-colors ${
                                                    marcado ? "bg-cyan-50/70" : "hover:bg-slate-50"
                                                }`}
                                                onClick={() => alternarPasajero(p.idpasajero)}
                                            >
                                                <td className="py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        onChange={() => {}}
                                                        aria-label={`Afectado: ${p.nombreCompleto}`}
                                                        className="size-6 rounded border-borde text-marca focus:ring-marca"
                                                    />
                                                </td>
                                                <td className="py-2.5 font-medium text-texto">
                                                    {p.nroPasaporte}
                                                </td>
                                                <td className="py-2.5 text-texto">
                                                    {p.nombreCompleto}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {listaPasajeros.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-6 text-center text-xs text-texto-suave">
                                                No hay pasajeros registrados para esta salida
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-borde pt-3">
                            <span className="text-xs font-semibold text-texto-suave">
                                {pasajerosSeleccionados.length} pasajero(s) seleccionado(s)
                            </span>
                            <Boton
                                variante="principal"
                                onClick={() => setModalMasPasajerosAbierto(false)}
                            >
                                Listo
                            </Boton>
                        </div>
                </Modal>
            ) : null}

            {/* Modal Historial Completo de Incidentes */}
            {modalHistorialAbierto ? (
                <Modal
                    onCerrar={() => setModalHistorialAbierto(false)}
                    etiqueta="Historial de incidentes de la salida"
                    className="p-6"
                >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    {salidaActual.circuito}
                                </p>
                                <h2 className="text-lg font-bold text-navegacion">
                                    Historial de incidentes
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalHistorialAbierto(false)}
                                aria-label="Cerrar"
                                className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
                            >
                                <IconoCerrar tamano={20} />
                            </button>
                        </div>

                        <div className="mt-4 divide-y divide-borde/50">
                            {historialIncidentes.map((item) => (
                                <div key={item.id} className="py-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-texto">
                                            {etiquetasTipoIncidente[item.tipoIncidente] ?? item.tipoIncidente}
                                        </p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${claseGravedad(
                                                item.nivelGravedad,
                                            )}`}
                                        >
                                            {etiquetasNivelGravedad[item.nivelGravedad] ?? item.nivelGravedad}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-xs text-texto-suave">
                                        {item.descripcion}
                                    </p>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                        Ocurrido: {item.fechaHora}
                                        {idsPendientes.has(item.id) ? " (Pendiente de envío)" : ""}
                                    </p>
                                </div>
                            ))}

                            {historialIncidentes.length === 0 ? (
                                <p className="py-6 text-center text-xs text-texto-suave">
                                    No hay incidentes reportados en esta salida
                                </p>
                            ) : null}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Boton
                                variante="principal"
                                onClick={() => setModalHistorialAbierto(false)}
                            >
                                Cerrar
                            </Boton>
                        </div>
                </Modal>
            ) : null}
        </section>
    );
}
