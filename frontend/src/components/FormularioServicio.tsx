import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alerta from "./Alerta";
import Boton from "./Boton";
import {
    esquemaServicio,
    modalidadesConfirmacion,
    tiposServicio,
    type DatosServicio,
    type Servicio,
    type TipoServicio,
} from "../services/servicioService";

type Props = {
    servicioEnEdicion?: Servicio | null;
    cargandoEdicion?: boolean;
    tipoProveedor: (typeof tiposServicio)[number] | string;
    localidadPredeterminada?: string;
    alGuardar: (datos: DatosServicio) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

const valoresIniciales = (
    tipo: Props["tipoProveedor"],
    localidad = "",
): DatosServicio => ({
    tipo: tipo as TipoServicio,
    nombreServicio: "",
    descripcion: "",
    costoBase: 0,
    localidad,
    ...(tipo === "ALOJAMIENTO" ? { modalidadConfirmacion: "BLOQUEO_PLAZAS" } : {}),
});

function FormularioServicio({
    servicioEnEdicion,
    cargandoEdicion = false,
    tipoProveedor,
    localidadPredeterminada = "",
    alGuardar,
    alCancelar,
    guardando = false,
    errorServidor,
}: Props) {
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors },
    } = useForm<DatosServicio>({
        resolver: zodResolver(esquemaServicio),
        defaultValues:
            servicioEnEdicion ?? valoresIniciales(tipoProveedor, localidadPredeterminada),
    });

    useEffect(() => {
        if (servicioEnEdicion) {
            reset({
                ...servicioEnEdicion,
                inventarioTotal:
                    servicioEnEdicion.inventarioTotal ??
                    (servicioEnEdicion.cantidadDisponible ?? 0) +
                        (servicioEnEdicion.cantidadComprometida ?? 0),
            });
        } else {
            reset(valoresIniciales(tipoProveedor, localidadPredeterminada));
        }
    }, [servicioEnEdicion, tipoProveedor, localidadPredeterminada, reset]);

    const edicion = servicioEnEdicion?.edicion;
    const bloqueadoPorGarantia =
        Boolean(servicioEnEdicion) &&
        tipoProveedor === "ALOJAMIENTO" &&
        Boolean(edicion?.garantizaPaquetesActivos);
    const comprometidaEquipamiento = servicioEnEdicion?.cantidadComprometida ?? 0;

    const esTipoValido = (tiposServicio as readonly string[]).includes(tipoProveedor);

    function esCampoEditable(campo: string): boolean {
        if (!edicion?.camposEditables) return true;
        return edicion.camposEditables.includes(campo);
    }

    function enviarFormulario(datos: DatosServicio) {
        if (!esTipoValido) return;
        if (
            servicioEnEdicion &&
            tipoProveedor === "EQUIPAMIENTO" &&
            datos.inventarioTotal !== undefined &&
            datos.inventarioTotal < comprometidaEquipamiento
        ) {
            setError("inventarioTotal", {
                type: "manual",
                message: `El inventario total no puede ser menor a la cantidad comprometida en salidas activas (${comprometidaEquipamiento}).`,
            });
            return;
        }
        alGuardar(datos);
    }

    const campos: Record<
        TipoServicio,
        {
            nombre: keyof DatosServicio;
            etiqueta: string;
            tipo?: string;
            placeholder?: string;
        }[]
    > = {
        ALOJAMIENTO: [
            { nombre: "categoria", etiqueta: "Categoría", placeholder: "Ej. 3 estrellas" },
            { nombre: "tipoHabitacion", etiqueta: "Tipo de habitación", placeholder: "Ej. Doble" },
            {
                nombre: "capacidadDisponible",
                etiqueta: "Capacidad disponible (plazas)",
                tipo: "number",
            },
            {
                nombre: "modalidadConfirmacion",
                etiqueta: "Modalidad de confirmación",
            },
        ],
        TRANSPORTE: [
            {
                nombre: "capacidadVehiculo",
                etiqueta: "Capacidad del vehículo",
                tipo: "number",
            },
            {
                nombre: "pesoEquipajeIncluido",
                etiqueta: "Peso de equipaje incluido (kg)",
                tipo: "number",
            },
            {
                nombre: "costoPorKgExcedente",
                etiqueta: "Costo por kg excedente",
                tipo: "number",
            },
        ],
        TREN: [
            { nombre: "horarioSalida", etiqueta: "Horario de salida", tipo: "time" },
            { nombre: "horarioLlegada", etiqueta: "Horario de llegada", tipo: "time" },
            {
                nombre: "diasOperacion",
                etiqueta: "Días de operación (L-M-X-J-V-S-D)",
                placeholder: "Ej. L-M-X-J-V-S-D",
            },
        ],
        EQUIPAMIENTO: [
            {
                nombre: "tipoEquipamiento",
                etiqueta: "Tipo de equipamiento",
                placeholder: "Ej. Carpa 4 estaciones",
            },
            {
                nombre: "cantidadDisponible",
                etiqueta: "Cantidad disponible",
                tipo: "number",
            },
        ],
    };

    if (cargandoEdicion) {
        return (
            <div className="rounded-tarjeta border border-borde bg-white p-6 text-sm text-texto-suave shadow-tarjeta">
                Consultando condiciones de edición del servicio...
            </div>
        );
    }

    return (
        <form
            className="space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(enviarFormulario)}
        >
            <div>
                <h2 className="font-bold text-navegacion">
                    {servicioEnEdicion ? "Editar servicio" : "Registrar servicio"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Rubro del proveedor: <span className="font-semibold text-texto">{tipoProveedor}</span>
                </p>
            </div>

            {!esTipoValido ? (
                <Alerta
                    tipo="error"
                    titulo="Tipo de proveedor no reconocido"
                >
                    El rubro &quot;{tipoProveedor}&quot; no es válido. No se pueden registrar ni modificar servicios para este proveedor.
                </Alerta>
            ) : null}

            {bloqueadoPorGarantia ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Establecimiento garantizado por un paquete activo"
                >
                    No se pueden modificar su localidad, categoría, tipo de habitación ni la
                    modalidad de bloqueo de plazas mientras garantice un paquete activo.
                </Alerta>
            ) : null}

            {edicion?.aplicaSoloAFuturasSalidas ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Servicio asignado a salidas publicadas o en curso"
                >
                    Un cambio estructural generará una <strong>versión nueva</strong> del
                    servicio que regirá únicamente para salidas futuras, manteniendo intactas
                    las salidas y reservas vigentes.
                </Alerta>
            ) : null}

            {servicioEnEdicion && tipoProveedor === "EQUIPAMIENTO" ? (
                <div className="rounded-control border border-borde bg-fondo px-4 py-3 text-xs text-texto-suave">
                    <span className="font-semibold text-texto">Disponibilidad actual:</span>{" "}
                    Libre: <strong>{servicioEnEdicion.cantidadDisponible ?? 0}</strong> ·
                    Comprometido en salidas activas:{" "}
                    <strong>{comprometidaEquipamiento}</strong> · Inventario físico total:{" "}
                    <strong>
                        {servicioEnEdicion.inventarioTotal ??
                            (servicioEnEdicion.cantidadDisponible ?? 0) +
                                comprometidaEquipamiento}
                    </strong>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                {([
                    ["nombreServicio", "Nombre del servicio", "Ej. Hotel Valle Sagrado"],
                    ["localidad", "Localidad", "Ej. Cusco"],
                    ["costoBase", "Costo base", "0.00"],
                ] as const).map(([nombre, etiqueta, placeholder]) => {
                    const deshabilitado =
                        !esCampoEditable(nombre) ||
                        (nombre === "localidad" && bloqueadoPorGarantia);
                    return (
                        <label
                            key={nombre}
                            className="grid gap-2 text-sm font-semibold text-texto"
                        >
                            {etiqueta}
                            <input
                                type={nombre === "costoBase" ? "number" : "text"}
                                step={nombre === "costoBase" ? "0.01" : undefined}
                                min={nombre === "costoBase" ? 0 : undefined}
                                placeholder={placeholder}
                                disabled={deshabilitado}
                                {...register(
                                    nombre,
                                    nombre === "costoBase" ? { valueAsNumber: true } : undefined,
                                )}
                                className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                            />
                            {errors[nombre] ? (
                                <span
                                    className="text-xs font-normal text-peligro"
                                    role="alert"
                                >
                                    {errors[nombre]?.message}
                                </span>
                            ) : null}
                        </label>
                    );
                })}

                <label className="grid gap-2 text-sm font-semibold text-texto md:col-span-2">
                    Descripción
                    <textarea
                        {...register("descripcion")}
                        rows={2}
                        disabled={!esCampoEditable("descripcion")}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                    />
                    {errors.descripcion ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.descripcion.message}
                        </span>
                    ) : null}
                </label>

                {(esTipoValido ? campos[tipoProveedor as TipoServicio] : []).map((campo) => {
                    const nombreCampo =
                        servicioEnEdicion &&
                        tipoProveedor === "EQUIPAMIENTO" &&
                        campo.nombre === "cantidadDisponible"
                            ? "inventarioTotal"
                            : campo.nombre;

                    const bloqueadoGarantiaCampo =
                        bloqueadoPorGarantia &&
                        (nombreCampo === "categoria" ||
                            nombreCampo === "tipoHabitacion" ||
                            nombreCampo === "modalidadConfirmacion");
                    const deshabilitado =
                        !esCampoEditable(nombreCampo) || bloqueadoGarantiaCampo;

                    if (nombreCampo === "modalidadConfirmacion") {
                        return (
                            <label
                                key={nombreCampo}
                                className="grid gap-2 text-sm font-semibold text-texto"
                            >
                                {campo.etiqueta}
                                <select
                                    disabled={deshabilitado}
                                    {...register("modalidadConfirmacion")}
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                                >
                                    {modalidadesConfirmacion.map((modalidad) => (
                                        <option key={modalidad} value={modalidad}>
                                            {modalidad === "BLOQUEO_PLAZAS"
                                                ? "BLOQUEO_PLAZAS (Confirmación por bloqueo)"
                                                : "A_SOLICITUD (Confirmación a solicitud)"}
                                        </option>
                                    ))}
                                </select>
                                {errors.modalidadConfirmacion ? (
                                    <span
                                        className="text-xs font-normal text-peligro"
                                        role="alert"
                                    >
                                        {errors.modalidadConfirmacion.message}
                                    </span>
                                ) : null}
                            </label>
                        );
                    }

                    const esEntero =
                        nombreCampo === "capacidadDisponible" ||
                        nombreCampo === "capacidadVehiculo" ||
                        nombreCampo === "cantidadDisponible" ||
                        nombreCampo === "inventarioTotal";

                    return (
                        <label
                            key={nombreCampo}
                            className="grid gap-2 text-sm font-semibold text-texto"
                        >
                            {nombreCampo === "inventarioTotal"
                                ? `Inventario físico total (mín. ${comprometidaEquipamiento} comprometido)`
                                : campo.etiqueta}
                            <input
                                type={campo.tipo ?? "text"}
                                step={
                                    campo.tipo === "number"
                                        ? esEntero
                                            ? "1"
                                            : "0.01"
                                        : undefined
                                }
                                min={
                                    nombreCampo === "inventarioTotal"
                                        ? comprometidaEquipamiento
                                        : nombreCampo === "capacidadVehiculo"
                                          ? 1
                                          : campo.tipo === "number"
                                            ? 0
                                            : undefined
                                }
                                placeholder={campo.placeholder}
                                disabled={deshabilitado}
                                {...register(
                                    nombreCampo,
                                    campo.tipo === "number"
                                        ? { valueAsNumber: true }
                                        : undefined,
                                )}
                                className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20 disabled:bg-fondo disabled:text-texto-suave"
                            />
                            {errors[nombreCampo] ? (
                                <span
                                    className="text-xs font-normal text-peligro"
                                    role="alert"
                                >
                                    {errors[nombreCampo]?.message}
                                </span>
                            ) : null}
                        </label>
                    );
                })}
            </div>

            {errorServidor ? (
                <Alerta tipo="error" titulo="Error al guardar el servicio">
                    {errorServidor}
                </Alerta>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
                <Boton
                    type="button"
                    variante="secundario"
                    onClick={alCancelar}
                    disabled={guardando}
                >
                    Cancelar
                </Boton>
                <Boton type="submit" disabled={guardando || !esTipoValido}>
                    {guardando
                        ? "Guardando..."
                        : servicioEnEdicion
                          ? "Guardar cambios"
                          : "Guardar servicio"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioServicio;
