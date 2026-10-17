import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import { esquemaServicio, tiposServicio, type DatosServicio, type Servicio } from "../services/servicioService";

type Props = {
    servicioEnEdicion?: Servicio | null;
    tipoProveedor: (typeof tiposServicio)[number];
    alGuardar: (datos: DatosServicio) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

const valoresIniciales = (tipo: Props["tipoProveedor"]): DatosServicio => ({
    tipo,
    nombreServicio: "",
    descripcion: "",
    costoBase: 0,
    localidad: "",
});

function FormularioServicio({ servicioEnEdicion, tipoProveedor, alGuardar, alCancelar, guardando = false, errorServidor }: Props) {
    const { register, handleSubmit, reset, formState: { errors } } = useForm<DatosServicio>({
        resolver: zodResolver(esquemaServicio),
        defaultValues: servicioEnEdicion ?? valoresIniciales(tipoProveedor),
    });

    useEffect(() => {
        reset(servicioEnEdicion ?? valoresIniciales(tipoProveedor));
    }, [servicioEnEdicion, tipoProveedor, reset]);

    const campos: Record<Props["tipoProveedor"], { nombre: keyof DatosServicio; etiqueta: string; tipo?: string }[]> = {
        ALOJAMIENTO: [
            { nombre: "categoria", etiqueta: "Categoría" },
            { nombre: "tipoHabitacion", etiqueta: "Tipo de habitación" },
            { nombre: "capacidadDisponible", etiqueta: "Capacidad disponible", tipo: "number" },
            { nombre: "modalidadConfirmacion", etiqueta: "Modalidad (BLOQUEO_PLAZAS o A_SOLICITUD)" },
        ],
        TRANSPORTE: [
            { nombre: "capacidadVehiculo", etiqueta: "Capacidad del vehículo", tipo: "number" },
            { nombre: "pesoEquipajeIncluido", etiqueta: "Peso de equipaje incluido (kg)", tipo: "number" },
            { nombre: "costoPorKgExcedente", etiqueta: "Costo por kg excedente", tipo: "number" },
        ],
        TREN: [
            { nombre: "horarioSalida", etiqueta: "Horario de salida", tipo: "time" },
            { nombre: "horarioLlegada", etiqueta: "Horario de llegada", tipo: "time" },
            { nombre: "diasOperacion", etiqueta: "Días (L-M-X-J-V-S-D)" },
        ],
        EQUIPAMIENTO: [
            { nombre: "tipoEquipamiento", etiqueta: "Tipo de equipamiento" },
            { nombre: "cantidadDisponible", etiqueta: "Cantidad disponible", tipo: "number" },
        ],
    };

    return (
        <form className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta" onSubmit={handleSubmit(alGuardar)}>
            <h2 className="font-bold text-navegacion">{servicioEnEdicion ? "Editar servicio" : "Registrar servicio"}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
                {([
                    ["nombreServicio", "Nombre del servicio"],
                    ["localidad", "Localidad"],
                    ["costoBase", "Costo base"],
                ] as const).map(([nombre, etiqueta]) => (
                    <label key={nombre} className="grid gap-2 text-sm font-semibold text-texto">
                        {etiqueta}
                        <input type={nombre === "costoBase" ? "number" : "text"} step="0.01" {...register(nombre, nombre === "costoBase" ? { valueAsNumber: true } : undefined)} className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20" />
                        {errors[nombre] ? <span className="text-xs font-normal text-peligro">{errors[nombre]?.message}</span> : null}
                    </label>
                ))}
                <label className="grid gap-2 text-sm font-semibold text-texto md:col-span-2">
                    Descripción
                    <textarea {...register("descripcion")} rows={2} className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20" />
                </label>
                {campos[tipoProveedor].map((campo) => {
                    const nombreCampo =
                        servicioEnEdicion &&
                        tipoProveedor === "EQUIPAMIENTO" &&
                        campo.nombre === "cantidadDisponible"
                            ? "inventarioTotal"
                            : campo.nombre;
                    return (
                        <label key={nombreCampo} className="grid gap-2 text-sm font-semibold text-texto">
                            {nombreCampo === "inventarioTotal"
                                ? "Inventario total"
                                : campo.etiqueta}
                            <input
                                type={campo.tipo ?? "text"}
                                step={campo.tipo === "number" ? "0.01" : undefined}
                                {...register(
                                    nombreCampo,
                                    campo.tipo === "number"
                                        ? { valueAsNumber: true }
                                        : undefined,
                                )}
                                className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            />
                            {errors[nombreCampo] ? (
                                <span className="text-xs font-normal text-peligro">
                                    {errors[nombreCampo]?.message}
                                </span>
                            ) : null}
                        </label>
                    );
                })}
            </div>
            {errorServidor ? <p className="mt-3 text-sm text-peligro" role="alert">{errorServidor}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
                <Boton type="button" variante="secundario" onClick={alCancelar} disabled={guardando}>Cancelar</Boton>
                <Boton type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar servicio"}</Boton>
            </div>
        </form>
    );
}

export default FormularioServicio;
