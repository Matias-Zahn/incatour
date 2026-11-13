import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaCircuito,
    nivelesDificultad,
    reglasPorteadores,
    type Circuito,
    type DatosCircuito,
} from "../services/circuitoService";

type FormularioCircuitoProps = {
    circuitoEnEdicion?: Circuito | null;
    alGuardar: (datos: DatosCircuito) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

function valoresPorDefecto(circuito?: Circuito | null): DatosCircuito {
    return {
        nombreCircuito: circuito?.nombreCircuito ?? "",
        duracionDias: circuito?.duracionDias ?? 1,
        dificultad: circuito?.dificultad ?? "Media",
        minimoGuias: circuito?.minimoGuias ?? 1,
        parametrosPorteadores: circuito?.parametrosPorteadores ?? "",
    };
}

function FormularioCircuito({
    circuitoEnEdicion,
    alGuardar,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioCircuitoProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DatosCircuito>({
        resolver: zodResolver(esquemaCircuito),
        defaultValues: valoresPorDefecto(circuitoEnEdicion),
    });

    useEffect(() => {
        reset(valoresPorDefecto(circuitoEnEdicion));
    }, [circuitoEnEdicion, reset]);

    const opcionesDificultad = Array.from(
        new Set([
            ...nivelesDificultad,
            ...(circuitoEnEdicion?.dificultad ? [circuitoEnEdicion.dificultad] : []),
        ]),
    );

    const opcionesPorteadores = Array.from(
        new Set([
            ...reglasPorteadores,
            ...(circuitoEnEdicion?.parametrosPorteadores
                ? [circuitoEnEdicion.parametrosPorteadores]
                : []),
        ]),
    );

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alGuardar)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">
                    {circuitoEnEdicion
                        ? "Editar circuito turístico"
                        : "Registrar circuito turístico"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Definí el nombre, duración, exigencia física y dotación operativa del recorrido.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nombre del circuito
                    <input
                        {...register("nombreCircuito")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nombreCircuito
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="Ej. Camino Inca Clásico"
                        autoFocus
                    />
                    {errors.nombreCircuito ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.nombreCircuito.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Dificultad
                    <select
                        {...register("dificultad")}
                        className={`rounded-control border bg-white px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.dificultad
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    >
                        {opcionesDificultad.map((nivel) => (
                            <option key={nivel} value={nivel}>
                                {nivel}
                            </option>
                        ))}
                    </select>
                    {errors.dificultad ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.dificultad.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Duración (días)
                    <input
                        type="number"
                        min={1}
                        step={1}
                        {...register("duracionDias", { valueAsNumber: true })}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.duracionDias
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="Ej. 4"
                    />
                    {errors.duracionDias ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.duracionDias.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Mínimo de guías requeridos
                    <input
                        type="number"
                        min={1}
                        step={1}
                        {...register("minimoGuias", { valueAsNumber: true })}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.minimoGuias
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="Ej. 1"
                    />
                    {errors.minimoGuias ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.minimoGuias.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto md:col-span-2">
                    Parámetros de porteadores (opcional)
                    <select
                        id="input-parametros-porteadores"
                        {...register("parametrosPorteadores")}
                        className={`rounded-control border bg-white px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.parametrosPorteadores
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    >
                        <option value="">Sin especificar</option>
                        {opcionesPorteadores.map((regla) => (
                            <option key={regla} value={regla}>
                                {regla === "0 por cada 1 pasajeros"
                                    ? "0 por cada 1 pasajeros (sin porteadores)"
                                    : regla}
                            </option>
                        ))}
                    </select>
                    <span className="text-xs font-normal text-texto-suave">
                        Define la relación de porteadores según el cupo máximo al programar salidas de este circuito.
                    </span>
                    {errors.parametrosPorteadores ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.parametrosPorteadores.message}
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
                        : circuitoEnEdicion
                          ? "Guardar cambios"
                          : "Registrar circuito"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioCircuito;
