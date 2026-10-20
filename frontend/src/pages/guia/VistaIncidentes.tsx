import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import {
    agregarHistorialLocalIncidente,
    esquemaIncidente,
    etiquetasNivelGravedad,
    etiquetasTipoIncidente,
    nivelesGravedad,
    obtenerHistorialLocalIncidentes,
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

type VistaIncidentesProps = {
    salidaActual: SalidaGuiaResumen | null;
    detalleSalida: DetalleSalidaGuia | null;
};

export function VistaIncidentes({
    salidaActual,
    detalleSalida,
}: VistaIncidentesProps) {
    const idsalida = salidaActual?.idsalida ?? 2;
    const registrarIncidenteMutation = useRegistrarIncidente();
    const { data: pasajerosSalida = [] } = usePasajerosSalida(idsalida);

    const [modalDescartarAbierto, setModalDescartarAbierto] = useState(false);
    const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
    const [modalMasPasajerosAbierto, setModalMasPasajerosAbierto] = useState(false);
    const [mensajeFeedback, setMensajeFeedback] = useState<{
        tipo: "exito" | "error";
        texto: string;
    } | null>(null);

    const [pasajerosSeleccionados, setPasajerosSeleccionados] = useState<number[]>([]);

    // Carga perezosa de historial de incidentes
    const [historialIncidentes, setHistorialIncidentes] = useState<
        RegistroHistorialIncidente[]
    >(() => {
        const local = obtenerHistorialLocalIncidentes(idsalida);
        if (local.length > 0) return local;
        return [
            {
                id: "inc_1",
                tipoIncidente: "CLIMA",
                nivelGravedad: "MEDIO",
                descripcion: "Retraso por tormenta de granizo en el paso de montaña",
                fechaHora: "07/12/2026",
            },
            {
                id: "inc_2",
                tipoIncidente: "SALUD",
                nivelGravedad: "BAJO",
                descripcion: "Malestar de altura leve de pasajero asistido con té de coca",
                fechaHora: "06/12/2026",
            },
        ];
    });

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const horaActual = new Date().toTimeString().slice(0, 5);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors },
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

        try {
            const respuesta = await registrarIncidenteMutation.mutateAsync({
                idsalida,
                payload: {
                    tipoIncidente: datos.tipoIncidente,
                    descripcion: datos.descripcion.trim(),
                    nivelGravedad: datos.nivelGravedad,
                    fechaHoraOcurrencia: fechaHoraIso,
                    pasajerosAfectados:
                        pasajerosSeleccionados.length > 0
                            ? pasajerosSeleccionados
                            : undefined,
                },
            });

            const idGenerado = String(
                (respuesta.data as { idincidente?: number } | undefined)?.idincidente ??
                    historialIncidentes.length + 1,
            );

            const nuevoItem: RegistroHistorialIncidente = {
                id: `inc_${idGenerado}`,
                tipoIncidente: datos.tipoIncidente,
                nivelGravedad: datos.nivelGravedad,
                descripcion: datos.descripcion.trim(),
                fechaHora: `${datos.fechaOcurrencia} ${datos.horaOcurrencia}`,
            };

            agregarHistorialLocalIncidente(idsalida, nuevoItem);
            setHistorialIncidentes((prev) => [nuevoItem, ...prev]);

            setMensajeFeedback({
                tipo: "exito",
                texto: "Notificación de incidente enviada exitosamente al equipo de administración.",
            });

            descartarFormulario();
        } catch (error: unknown) {
            const mensaje =
                error instanceof Error
                    ? error.message
                    : typeof error === "string"
                      ? error
                      : "Ocurrió un error al intentar notificar el incidente.";
            setMensajeFeedback({
                tipo: "error",
                texto: mensaje,
            });
        }
    }

    // Lista de pasajeros para la tabla
    const listaPasajeros =
        pasajerosSalida.length > 0
            ? pasajerosSalida
            : detalleSalida?.nomina.map((p) => ({
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
        <section aria-label="Notificar incidente operativo (CU-50)" className="space-y-6">
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
                        Salida actual: {salidaActual?.nroSalida ?? "SAL-2026-002"}
                    </h2>
                    <p className="text-xs text-texto-suave">
                        {salidaActual?.circuito ?? "Camino del Inca Clásico"}
                    </p>
                </div>
                <div>
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        {salidaActual?.estado === "EN_CURSO" ? "En curso" : "Activa"}
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

                    <form onSubmit={handleSubmit(enviarIncidente)} noValidate className="mt-5 space-y-4">
                        {mensajeFeedback ? (
                            <Alerta tipo={mensajeFeedback.tipo}>
                                {mensajeFeedback.texto}
                            </Alerta>
                        ) : null}

                        {/* Descripción */}
                        <label className="grid gap-1.5 text-xs font-bold text-texto">
                            <span>Descripción del incidente *</span>
                            <textarea
                                rows={4}
                                maxLength={1000}
                                placeholder="Describa lo ocurrido en detalle (mínimo 5 caracteres)..."
                                {...register("descripcion")}
                                className="rounded-control border border-borde bg-white p-3 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
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
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Fecha del incidente *</span>
                                <input
                                    type="date"
                                    {...register("fechaOcurrencia")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.fechaOcurrencia ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.fechaOcurrencia.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Hora */}
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Hora del incidente *</span>
                                <input
                                    type="time"
                                    {...register("horaOcurrencia")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.horaOcurrencia ? (
                                    <span className="text-xs font-normal text-peligro">
                                        {errors.horaOcurrencia.message}
                                    </span>
                                ) : null}
                            </label>

                            {/* Tipo de Incidente */}
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Tipo de incidente *</span>
                                <select
                                    {...register("tipoIncidente")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
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
                            <label className="grid gap-1.5 text-xs font-bold text-texto">
                                <span>Nivel de gravedad *</span>
                                <select
                                    {...register("nivelGravedad")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
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
                    </form>
                </article>

                {/* Columna Derecha: Selección de Pasajeros e Historial */}
                <div className="space-y-6">
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
                                        <th className="w-8 py-2"></th>
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
                                                className={`transition-colors ${
                                                    seleccionado ? "bg-cyan-50/60" : ""
                                                }`}
                                            >
                                                <td className="py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={seleccionado}
                                                        onChange={() => alternarPasajero(p.idpasajero)}
                                                        className="size-4 rounded border-borde text-marca focus:ring-marca"
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
                            <button
                                type="button"
                                onClick={() => setModalHistorialAbierto(true)}
                                className="text-xs font-bold text-marca hover:underline"
                            >
                                Ver historial
                            </button>
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
                                    </p>
                                </div>
                            ))}
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
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setModalMasPasajerosAbierto(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Seleccionar pasajeros afectados"
                        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-tarjeta bg-white p-6 shadow-tarjeta"
                    >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    Salida {salidaActual?.nroSalida}
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
                                className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
                            >
                                <IconoCerrar tamano={20} />
                            </button>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-borde text-[11px] font-bold text-texto-suave">
                                        <th className="w-8 py-2"></th>
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
                                                        className="size-4 rounded border-borde text-marca focus:ring-marca"
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
                    </div>
                </div>
            ) : null}

            {/* Modal Historial Completo de Incidentes */}
            {modalHistorialAbierto ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setModalHistorialAbierto(false);
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Historial de incidentes de la salida"
                        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-tarjeta bg-white p-6 shadow-tarjeta"
                    >
                        <div className="flex items-start justify-between border-b border-borde pb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                    {salidaActual?.circuito ?? "Camino del Inca"}
                                </p>
                                <h2 className="text-lg font-bold text-navegacion">
                                    Historial de incidentes
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalHistorialAbierto(false)}
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
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Boton
                                variante="principal"
                                onClick={() => setModalHistorialAbierto(false)}
                            >
                                Cerrar
                            </Boton>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
