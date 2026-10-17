import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaTemporada,
    type DatosTemporada,
    type Temporada,
} from "../services/temporadaService";

type FormularioTemporadaProps = {
    temporadaEnEdicion?: Temporada | null;
    alGuardar: (datos: DatosTemporada) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

function aFechaInput(iso?: string): string {
    if (!iso) return "";
    return iso.slice(0, 10);
}

function valoresPorDefecto(temporada?: Temporada | null): DatosTemporada {
    return {
        nombre: temporada?.nombre ?? "",
        fechaInicio: aFechaInput(temporada?.fechaInicio),
        fechaFin: aFechaInput(temporada?.fechaFin),
    };
}

function FormularioTemporada({
    temporadaEnEdicion,
    alGuardar,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioTemporadaProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DatosTemporada>({
        resolver: zodResolver(esquemaTemporada),
        defaultValues: valoresPorDefecto(temporadaEnEdicion),
    });

    useEffect(() => {
        reset(valoresPorDefecto(temporadaEnEdicion));
    }, [temporadaEnEdicion, reset]);

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alGuardar)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">
                    {temporadaEnEdicion
                        ? "Editar temporada"
                        : "Registrar temporada"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Definí el período comercial para asociar tarifas a los paquetes turísticos.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nombre de la temporada
                    <input
                        {...register("nombre")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nombre
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="Ej. Temporada alta 2026"
                        autoFocus
                    />
                    {errors.nombre ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.nombre.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Fecha de inicio
                    <input
                        type="date"
                        {...register("fechaInicio")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.fechaInicio
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.fechaInicio ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.fechaInicio.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Fecha de fin
                    <input
                        type="date"
                        {...register("fechaFin")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.fechaFin
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.fechaFin ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.fechaFin.message}
                        </span>
                    ) : null}
                </label>
            </div>

            {errorServidor ? (
                <p className="mt-3 text-sm text-peligro" role="alert">
                    {errorServidor}
                </p>
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
                <Boton type="submit" disabled={guardando}>
                    {guardando
                        ? "Guardando..."
                        : temporadaEnEdicion
                          ? "Guardar cambios"
                          : "Registrar temporada"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioTemporada;
