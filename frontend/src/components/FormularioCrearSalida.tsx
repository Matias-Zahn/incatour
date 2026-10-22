import { useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alerta from "./Alerta";
import Boton from "./Boton";

// ==========================================
// Tipos del contrato CU-36 (Opciones y Creación)
// ==========================================

export type PaqueteOpcion = {
    idpaquete: number;
    nombrePaquete: string;
    estado?: string;
};

export type DotacionOpciones = {
    guias: number;
    porteadores: number;
};

export type CupoAutoridadOpciones = {
    lugaresDisponibles: number;
    alcanza: boolean;
};

export type AlojamientoOpcion = {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    categoria?: string | null;
    capacidadDisponible?: number | null;
    alcanza: boolean;
};

/**
 * Estructura entregada por GET /api/salidas/opciones en el backend.
 */
export type OpcionesSalidaDto = {
    paquete: {
        idpaquete: number;
        nombrePaquete: string;
    };
    tamanoMaximo: number;
    dotacion: DotacionOpciones;
    totalLugares: number;
    cupoAutoridad: CupoAutoridadOpciones | null;
    alojamientos: AlojamientoOpcion[];
};

/**
 * Parámetros requeridos para consultar opciones de dimensionamiento y cupo.
 */
export type ParametrosConsultaOpciones = {
    idpaquete: number;
    fechaInicio: string; // "YYYY-MM-DD"
    tamanoMaximo: number;
};

/**
 * Carga útil para confirmar la creación de una salida planificada (POST /api/salidas).
 */
export type DatosConfirmarSalida = {
    idpaquete: number;
    fechaInicio: string; // "YYYY-MM-DD"
    tamanoMaximo: number;
    idalojamiento?: number;
};

export type FormularioCrearSalidaProps = {
    paquetes: PaqueteOpcion[];
    opciones?: OpcionesSalidaDto | null;
    cargandoOpciones?: boolean;
    creando?: boolean;
    errorServidor?: string;
    alConsultarOpciones: (parametros: ParametrosConsultaOpciones) => void;
    alConfirmarCreacion: (datos: DatosConfirmarSalida) => void;
    alCancelar: () => void;
};

// ==========================================
// Utilidades de Fechas (Sin desfases de zona horaria)
// ==========================================

function obtenerFechaHoyIsoLocal(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

const FECHA_MINIMA_PERMITIDA = (() => {
    const maniana = new Date();
    maniana.setDate(maniana.getDate() + 1);
    const anio = maniana.getFullYear();
    const mes = String(maniana.getMonth() + 1).padStart(2, "0");
    const dia = String(maniana.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
})();

// ==========================================
// Esquema de Validación Zod
// ==========================================

const esquemaParametrosSalida = z.object({
    idpaquete: z
        .number({ message: "Seleccioná un paquete turístico" })
        .int("El paquete debe ser un número entero")
        .positive("Seleccioná un paquete turístico"),
    fechaInicio: z
        .string()
        .trim()
        .min(1, "La fecha de inicio es requerida")
        .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD")
        .refine(
            (fecha) => {
                const hoy = obtenerFechaHoyIsoLocal();
                return fecha > hoy;
            },
            { message: "La fecha de inicio tiene que ser futura" },
        ),
    tamanoMaximo: z
        .number({ message: "Ingresá el tamaño del grupo de pasajeros" })
        .int("El tamaño debe ser un número entero")
        .positive("El tamaño del grupo debe ser mayor a 0"),
});

export type ValoresFormularioSalida = z.infer<typeof esquemaParametrosSalida>;

// ==========================================
// Componente FormularioCrearSalida
// ==========================================

function FormularioCrearSalida({
    paquetes,
    opciones,
    cargandoOpciones = false,
    creando = false,
    errorServidor,
    alConsultarOpciones,
    alConfirmarCreacion,
    alCancelar,
}: FormularioCrearSalidaProps) {
    const idForm = useId();
    const idPaqueteId = `${idForm}-idpaquete`;
    const idFechaInicioId = `${idForm}-fechainicio`;
    const idTamanoMaximoId = `${idForm}-tamanomaximo`;

    // Estado local para los últimos parámetros consultados
    const [parametrosConsultados, setParametrosConsultados] =
        useState<ParametrosConsultaOpciones | null>(null);

    // Selección de alojamiento elegido
    const [idalojamientoSeleccionado, setIdalojamientoSeleccionado] = useState<
        number | null
    >(null);
    const [errorAlojamiento, setErrorAlojamiento] = useState<string>("");

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<ValoresFormularioSalida>({
        resolver: zodResolver(esquemaParametrosSalida),
        defaultValues: {
            idpaquete: undefined,
            fechaInicio: "",
            tamanoMaximo: undefined,
        },
    });

    const valorIdPaquete = useWatch({ control, name: "idpaquete" });
    const valorFechaInicio = useWatch({ control, name: "fechaInicio" });
    const valorTamanoMaximo = useWatch({ control, name: "tamanoMaximo" });

    // Filtrar solo paquetes activos para la selección
    const paquetesActivos = useMemo(() => {
        return paquetes.filter((p) => !p.estado || p.estado === "ACTIVO");
    }, [paquetes]);

    // Comprobar si los parámetros actuales del formulario coinciden con los consultados
    const opcionesEstanSincronizadas = Boolean(
        parametrosConsultados &&
            opciones &&
            Number(valorIdPaquete) === parametrosConsultados.idpaquete &&
            valorFechaInicio === parametrosConsultados.fechaInicio &&
            Number(valorTamanoMaximo) === parametrosConsultados.tamanoMaximo,
    );

    // Detectar si el usuario modificó los campos luego de haber consultado
    const opcionesQuedaronObsoletas = Boolean(
        parametrosConsultados && !opcionesEstanSincronizadas,
    );

    // Alojamientos elegibles con capacidad suficiente
    const alojamientosConCapacidad = useMemo(() => {
        if (!opciones?.alojamientos) return [];
        return opciones.alojamientos.filter((a) => a.alcanza);
    }, [opciones]);

    // Si existen opciones con bloqueo y capacidad suficiente, la selección es obligatoria
    const requiereSeleccionAlojamiento = alojamientosConCapacidad.length > 0;

    // Estado del cupo de la autoridad
    const tieneCupoInsuficienteAutoridad = Boolean(
        opciones?.cupoAutoridad && opciones.cupoAutoridad.alcanza === false,
    );

    function manejarConsulta(valores: ValoresFormularioSalida) {
        const parametros: ParametrosConsultaOpciones = {
            idpaquete: Number(valores.idpaquete),
            fechaInicio: valores.fechaInicio,
            tamanoMaximo: Number(valores.tamanoMaximo),
        };
        setParametrosConsultados(parametros);
        setIdalojamientoSeleccionado(null);
        setErrorAlojamiento("");
        alConsultarOpciones(parametros);
    }

    function manejarConfirmacion() {
        if (!parametrosConsultados || !opciones || !opcionesEstanSincronizadas) {
            return;
        }

        // Validación: si hay alojamientos por bloqueo, uno debe estar elegido
        if (requiereSeleccionAlojamiento && idalojamientoSeleccionado === null) {
            setErrorAlojamiento(
                "Debés seleccionar uno de los alojamientos con bloqueo de plazas disponibles.",
            );
            return;
        }

        // Validación: no permitir si la autoridad informó cupo insuficiente (FA1)
        if (tieneCupoInsuficienteAutoridad) {
            return;
        }

        setErrorAlojamiento("");
        alConfirmarCreacion({
            idpaquete: parametrosConsultados.idpaquete,
            fechaInicio: parametrosConsultados.fechaInicio,
            tamanoMaximo: parametrosConsultados.tamanoMaximo,
            ...(idalojamientoSeleccionado !== null
                ? { idalojamiento: idalojamientoSeleccionado }
                : {}),
        });
    }

    return (
        <section className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
            <header className="mb-6 border-b border-borde pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración · CU-36
                        </span>
                        <h2 className="text-xl font-bold text-navegacion">
                            Crear salida planificada
                        </h2>
                    </div>
                    <span className="inline-flex items-center rounded bg-marca-suave px-2.5 py-1 text-xs font-semibold text-navegacion">
                        Perfil: ADMIN
                    </span>
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                    Ingresá los parámetros del contingente para calcular la dotación de
                    personal requerida, verificar cupos ante la autoridad y asignar el
                    alojamiento correspondiente.
                </p>
            </header>

            {errorServidor ? (
                <div className="mb-5">
                    <Alerta tipo="error" titulo="Error al procesar la solicitud">
                        {errorServidor}
                    </Alerta>
                </div>
            ) : null}

            {/* PASO 1: Formulario de Parámetros de Entrada */}
            <form onSubmit={handleSubmit(manejarConsulta)} noValidate>
                <div className="mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                        Paso 1: Parámetros del contingente
                    </h3>
                    <p className="text-xs text-texto-suave">
                        Definí el paquete, la fecha de inicio prevista y la cantidad máxima de
                        pasajeros.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Selector de Paquete Turístico */}
                    <div className="grid gap-1.5">
                        <label
                            htmlFor={idPaqueteId}
                            className="text-xs font-semibold text-texto"
                        >
                            Paquete turístico <span className="text-peligro">*</span>
                        </label>
                        <select
                            id={idPaqueteId}
                            {...register("idpaquete", { valueAsNumber: true })}
                            disabled={cargandoOpciones || creando}
                            aria-invalid={Boolean(errors.idpaquete)}
                            aria-describedby={
                                errors.idpaquete ? `${idPaqueteId}-error` : undefined
                            }
                            className={`rounded-control border bg-white px-3 py-2 text-sm text-texto outline-none transition-colors focus:ring-2 disabled:bg-slate-50 ${
                                errors.idpaquete
                                    ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                    : "border-borde focus:border-marca focus:ring-marca/20"
                            }`}
                        >
                            <option value="">Seleccionar paquete...</option>
                            {paquetesActivos.map((p) => (
                                <option key={p.idpaquete} value={p.idpaquete}>
                                    {p.nombrePaquete}
                                </option>
                            ))}
                        </select>
                        {errors.idpaquete ? (
                            <span
                                id={`${idPaqueteId}-error`}
                                className="text-xs font-medium text-peligro"
                                role="alert"
                            >
                                {errors.idpaquete.message}
                            </span>
                        ) : null}
                    </div>

                    {/* Fecha de Inicio */}
                    <div className="grid gap-1.5">
                        <label
                            htmlFor={idFechaInicioId}
                            className="text-xs font-semibold text-texto"
                        >
                            Fecha de inicio <span className="text-peligro">*</span>
                        </label>
                        <input
                            id={idFechaInicioId}
                            type="date"
                            min={FECHA_MINIMA_PERMITIDA}
                            {...register("fechaInicio")}
                            disabled={cargandoOpciones || creando}
                            aria-invalid={Boolean(errors.fechaInicio)}
                            aria-describedby={
                                errors.fechaInicio ? `${idFechaInicioId}-error` : undefined
                            }
                            className={`rounded-control border bg-white px-3 py-2 text-sm text-texto outline-none transition-colors focus:ring-2 disabled:bg-slate-50 ${
                                errors.fechaInicio
                                    ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                    : "border-borde focus:border-marca focus:ring-marca/20"
                            }`}
                        />
                        {errors.fechaInicio ? (
                            <span
                                id={`${idFechaInicioId}-error`}
                                className="text-xs font-medium text-peligro"
                                role="alert"
                            >
                                {errors.fechaInicio.message}
                            </span>
                        ) : (
                            <span className="text-[11px] text-texto-suave">
                                Solo fechas futuras (a partir de mañana).
                            </span>
                        )}
                    </div>

                    {/* Tamaño Máximo de Pasajeros */}
                    <div className="grid gap-1.5">
                        <label
                            htmlFor={idTamanoMaximoId}
                            className="text-xs font-semibold text-texto"
                        >
                            Tamaño máximo (pasajeros) <span className="text-peligro">*</span>
                        </label>
                        <input
                            id={idTamanoMaximoId}
                            type="number"
                            min={1}
                            placeholder="Ej. 8, 12, 16"
                            {...register("tamanoMaximo", { valueAsNumber: true })}
                            disabled={cargandoOpciones || creando}
                            aria-invalid={Boolean(errors.tamanoMaximo)}
                            aria-describedby={
                                errors.tamanoMaximo
                                    ? `${idTamanoMaximoId}-error`
                                    : undefined
                            }
                            className={`rounded-control border bg-white px-3 py-2 text-sm text-texto outline-none transition-colors focus:ring-2 disabled:bg-slate-50 ${
                                errors.tamanoMaximo
                                    ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                    : "border-borde focus:border-marca focus:ring-marca/20"
                            }`}
                        />
                        {errors.tamanoMaximo ? (
                            <span
                                id={`${idTamanoMaximoId}-error`}
                                className="text-xs font-medium text-peligro"
                                role="alert"
                            >
                                {errors.tamanoMaximo.message}
                            </span>
                        ) : (
                            <span className="text-[11px] text-texto-suave">
                                Capacidad máxima del grupo para la venta.
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-texto-suave">
                        La dotación de guías, porteadores y total de lugares se calcularán
                        automáticamente según el circuito.
                    </p>
                    <Boton
                        type="submit"
                        variante="secundario"
                        cargando={cargandoOpciones}
                        disabled={creando}
                    >
                        Consultar opciones y disponibilidad
                    </Boton>
                </div>
            </form>

            {/* Aviso de Parámetros Modificados tras Consulta */}
            {opcionesQuedaronObsoletas ? (
                <div className="mt-6">
                    <Alerta
                        tipo="advertencia"
                        titulo="Los parámetros de la salida fueron modificados"
                    >
                        <p className="text-xs sm:text-sm">
                            Modificaste el paquete, la fecha o el tamaño del grupo. Hacé clic
                            en <strong>&quot;Consultar opciones y disponibilidad&quot;</strong> para
                            recalcular la dotación de personal y consultar el cupo actualizado.
                        </p>
                    </Alerta>
                </div>
            ) : null}

            {/* PASO 2: Presentación de Opciones, Dotación, Autoridad y Alojamiento */}
            {opcionesEstanSincronizadas && opciones ? (
                <div className="mt-6 space-y-6 border-t border-borde pt-6">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-navegacion">
                            Paso 2: Dimensionamiento, cupos y alojamiento
                        </h3>
                        <p className="text-xs text-texto-suave">
                            Revisá la dotación calculada para el circuito y seleccioná el
                            alojamiento asignado a la salida.
                        </p>
                    </div>

                    {/* Resumen de Dimensionamiento */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-control border border-borde bg-fondo p-3.5">
                            <span className="text-xs font-semibold uppercase text-texto-suave">
                                Cupo de pasajeros
                            </span>
                            <p className="mt-1 text-xl font-bold text-navegacion">
                                {opciones.tamanoMaximo}
                                <span className="ml-1 text-xs font-normal text-texto">
                                    turistas
                                </span>
                            </p>
                            <span className="text-[11px] text-texto-suave">
                                Paquete: {opciones.paquete.nombrePaquete}
                            </span>
                        </div>

                        <div className="rounded-control border border-borde bg-fondo p-3.5">
                            <span className="text-xs font-semibold uppercase text-texto-suave">
                                Dotación requerida
                            </span>
                            <p className="mt-1 text-xl font-bold text-navegacion">
                                {opciones.dotacion.guias + opciones.dotacion.porteadores}
                                <span className="ml-1 text-xs font-normal text-texto">
                                    trabajadores
                                </span>
                            </p>
                            <span className="text-[11px] text-texto-suave">
                                {opciones.dotacion.guias}{" "}
                                {opciones.dotacion.guias === 1 ? "guía" : "guías"} ·{" "}
                                {opciones.dotacion.porteadores}{" "}
                                {opciones.dotacion.porteadores === 1
                                    ? "porteador"
                                    : "porteadores"}
                            </span>
                        </div>

                        <div className="rounded-control border border-marca/30 bg-marca-suave/40 p-3.5">
                            <span className="text-xs font-semibold uppercase text-texto-suave">
                                Total de lugares a bloquear
                            </span>
                            <p className="mt-1 text-xl font-bold text-marca-oscura">
                                {opciones.totalLugares}
                                <span className="ml-1 text-xs font-normal text-texto">
                                    personas
                                </span>
                            </p>
                            <span className="text-[11px] text-texto-suave">
                                Bloqueo total ante la Autoridad del Parque
                            </span>
                        </div>
                    </div>

                    {/* Estado del Cupo ante la Autoridad del Camino del Inca */}
                    <div>
                        {opciones.cupoAutoridad === null ? (
                            <Alerta
                                tipo="advertencia"
                                titulo="Disponibilidad previa no disponible (Autoridad)"
                            >
                                <p className="text-xs sm:text-sm">
                                    No fue posible consultar la disponibilidad en tiempo real con
                                    el servicio de la autoridad. La verificación y el bloqueo de los{" "}
                                    <strong>{opciones.totalLugares} lugares</strong> se intentarán
                                    directamente al confirmar la creación.
                                </p>
                            </Alerta>
                        ) : opciones.cupoAutoridad.alcanza ? (
                            <Alerta
                                tipo="exito"
                                titulo="Cupo disponible confirmado por la autoridad"
                            >
                                <p className="text-xs sm:text-sm">
                                    La autoridad informa{" "}
                                    <strong>
                                        {opciones.cupoAutoridad.lugaresDisponibles} lugares
                                        disponibles
                                    </strong>{" "}
                                    para esa fecha. La cantidad es suficiente para cubrir los{" "}
                                    <strong>{opciones.totalLugares} lugares</strong> que demanda
                                    esta salida.
                                </p>
                            </Alerta>
                        ) : (
                            <Alerta
                                tipo="error"
                                titulo="Cupo insuficiente ante la autoridad (FA1)"
                            >
                                <p className="text-xs sm:text-sm">
                                    La autoridad solo dispone de{" "}
                                    <strong>
                                        {opciones.cupoAutoridad.lugaresDisponibles} lugares libres
                                    </strong>
                                    , pero la salida necesita{" "}
                                    <strong>{opciones.totalLugares} lugares</strong> (turistas +
                                    dotación de personal). No es posible crear la salida en esta
                                    fecha; por favor, elegí otra fecha o reducí el tamaño del grupo.
                                </p>
                            </Alerta>
                        )}
                    </div>

                    {/* Sección de Selección de Alojamiento */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <label className="text-sm font-semibold text-navegacion">
                                Alojamiento por bloqueo de plazas
                                {requiereSeleccionAlojamiento ? (
                                    <span className="ml-1 text-xs font-semibold text-peligro">
                                        (Selección obligatoria)
                                    </span>
                                ) : null}
                            </label>
                            <span className="text-xs text-texto-suave">
                                Garantía del paquete turístico
                            </span>
                        </div>

                        {requiereSeleccionAlojamiento ? (
                            <div className="space-y-2">
                                <p className="text-xs text-texto-suave">
                                    El paquete cuenta con establecimientos que confirman por
                                    bloqueo de plazas. Seleccioná el alojamiento para reservar las
                                    plazas del contingente:
                                </p>

                                <div className="grid gap-2">
                                    {opciones.alojamientos.map((aloj) => {
                                        const deshabilitado = !aloj.alcanza || creando;
                                        const seleccionado =
                                            idalojamientoSeleccionado === aloj.idservicio;

                                        return (
                                            <label
                                                key={aloj.idservicio}
                                                className={`flex items-start gap-3 rounded-control border p-3.5 transition-all ${
                                                    deshabilitado
                                                        ? "cursor-not-allowed border-borde bg-slate-50/70 opacity-60"
                                                        : seleccionado
                                                          ? "cursor-pointer border-marca bg-marca-suave/40 shadow-sm"
                                                          : "cursor-pointer border-borde bg-white hover:border-marca/50"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="seleccion-alojamiento"
                                                    value={aloj.idservicio}
                                                    disabled={deshabilitado}
                                                    checked={seleccionado}
                                                    onChange={() => {
                                                        setIdalojamientoSeleccionado(
                                                            aloj.idservicio,
                                                        );
                                                        setErrorAlojamiento("");
                                                    }}
                                                    className="mt-1 h-4 w-4 text-marca focus:ring-marca"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="font-semibold text-navegacion">
                                                            {aloj.nombreServicio}
                                                            {aloj.categoria ? (
                                                                <span className="ml-2 text-xs font-normal text-texto-suave">
                                                                    ({aloj.categoria})
                                                                </span>
                                                            ) : null}
                                                        </p>
                                                        <span
                                                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                                                                aloj.alcanza
                                                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                                                    : "border border-rose-200 bg-rose-50 text-rose-800"
                                                            }`}
                                                        >
                                                            {aloj.capacidadDisponible ?? 0} plazas
                                                            disponibles
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-texto-suave">
                                                        Localidad: {aloj.localidad}
                                                        {!aloj.alcanza ? (
                                                            <span className="ml-2 font-medium text-peligro">
                                                                (Capacidad insuficiente: requiere{" "}
                                                                {opciones.tamanoMaximo} plazas)
                                                            </span>
                                                        ) : null}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {errorAlojamiento ? (
                                    <p
                                        className="text-xs font-medium text-peligro"
                                        role="alert"
                                    >
                                        {errorAlojamiento}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <Alerta
                                tipo="informacion"
                                titulo="Sin alojamiento con bloqueo de plazas (FA3)"
                            >
                                <p className="text-xs sm:text-sm">
                                    El paquete no cuenta con alojamientos que confirmen por bloqueo
                                    de plazas con capacidad suficiente para este tamaño de grupo.
                                    La salida se creará <strong>sin alojamiento asignado</strong>;
                                    cada reserva que compren los pasajeros generará su respectiva
                                    solicitud individual de alojamiento a confirmar ante el
                                    proveedor (CU-34).
                                </p>
                            </Alerta>
                        )}
                    </div>

                    {/* Acciones de Confirmación Final */}
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-borde pt-5">
                        <Boton
                            type="button"
                            variante="secundario"
                            onClick={alCancelar}
                            disabled={creando}
                        >
                            Cancelar
                        </Boton>

                        <Boton
                            type="button"
                            variante="principal"
                            cargando={creando}
                            disabled={
                                cargandoOpciones ||
                                creando ||
                                tieneCupoInsuficienteAutoridad ||
                                (requiereSeleccionAlojamiento &&
                                    idalojamientoSeleccionado === null)
                            }
                            onClick={manejarConfirmacion}
                        >
                            Confirmar y publicar salida
                        </Boton>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

export default FormularioCrearSalida;
