import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import { esquemaEtapa, type DatosEtapa, type Etapa } from "../services/etapaService";

type FormularioEtapaProps = {
    etapaEnEdicion?: Etapa | null;
    etapasActuales?: Etapa[];
    numeroOrdenSugerido: number;
    puntoInicioSugerido?: string;
    alGuardar: (datos: DatosEtapa) => void;
    alCancelar: () => void;
    guardando?: boolean;
};

function FormularioEtapa({
    etapaEnEdicion,
    etapasActuales = [],
    numeroOrdenSugerido,
    puntoInicioSugerido = "",
    alGuardar,
    alCancelar,
    guardando = false,
}: FormularioEtapaProps) {
    const {
        register,
        handleSubmit,
        reset,
        control,
        setValue,
        formState: { errors },
    } = useForm<DatosEtapa>({
        resolver: zodResolver(esquemaEtapa),
        defaultValues: etapaEnEdicion
            ? {
                  numeroOrden: etapaEnEdicion.numeroOrden,
                  puntoInicio: etapaEnEdicion.puntoInicio,
                  puntoFin: etapaEnEdicion.puntoFin,
                  campamentoPrevisto: etapaEnEdicion.campamentoPrevisto ?? "",
              }
            : {
                  numeroOrden: numeroOrdenSugerido,
                  puntoInicio: puntoInicioSugerido,
                  puntoFin: "",
                  campamentoPrevisto: "",
              },
    });

    useEffect(() => {
        reset(
            etapaEnEdicion
                ? {
                      numeroOrden: etapaEnEdicion.numeroOrden,
                      puntoInicio: etapaEnEdicion.puntoInicio,
                      puntoFin: etapaEnEdicion.puntoFin,
                      campamentoPrevisto: etapaEnEdicion.campamentoPrevisto ?? "",
                  }
                : {
                      numeroOrden: numeroOrdenSugerido,
                      puntoInicio: puntoInicioSugerido,
                      puntoFin: "",
                      campamentoPrevisto: "",
                  },
        );
    }, [etapaEnEdicion, numeroOrdenSugerido, puntoInicioSugerido, reset]);

    const ordenSeleccionado = useWatch({ control, name: "numeroOrden" });
    const puntoInicioActual = useWatch({ control, name: "puntoInicio" }) ?? "";
    const puntoFinActual = useWatch({ control, name: "puntoFin" }) ?? "";

    const baseSinActual = etapaEnEdicion
        ? etapasActuales.filter((item) => item.numeroOrden !== etapaEnEdicion.numeroOrden)
        : etapasActuales;
    const indiceInsercion = Math.max(
        0,
        Math.min(baseSinActual.length, (Number(ordenSeleccionado) || 1) - 1),
    );
    const etapaPrevia = indiceInsercion > 0 ? baseSinActual[indiceInsercion - 1] : undefined;
    const etapaPosterior =
        indiceInsercion < baseSinActual.length ? baseSinActual[indiceInsercion] : undefined;

    const puntoInicioEsperado = etapaPrevia?.puntoFin.trim() ?? "";
    const puntoFinEsperado = etapaPosterior?.puntoInicio.trim() ?? "";

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alGuardar)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">
                    {etapaEnEdicion
                        ? `Editar etapa #${etapaEnEdicion.numeroOrden}`
                        : `Agregar etapa #${numeroOrdenSugerido} a la secuencia`}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Recordá que el punto de inicio de cada etapa debe coincidir con el punto de fin de la etapa anterior (continuidad espacial CU-05).
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Número de orden
                    <input
                        type="number"
                        min={1}
                        {...register("numeroOrden", { valueAsNumber: true })}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.numeroOrden
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.numeroOrden ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.numeroOrden.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Campamento previsto (opcional)
                    <input
                        {...register("campamentoPrevisto")}
                        placeholder="Ej. Campamento Wayllabamba"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.campamentoPrevisto
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.campamentoPrevisto ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.campamentoPrevisto.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Punto de inicio
                    <input
                        {...register("puntoInicio")}
                        placeholder="Ej. Km 82 (Piscacucho)"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.puntoInicio
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.puntoInicio ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.puntoInicio.message}
                        </span>
                    ) : null}
                    {puntoInicioEsperado &&
                    puntoInicioActual.trim() !== puntoInicioEsperado ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-advertencia/40 bg-advertencia/10 px-2.5 py-1.5 text-xs font-normal text-texto">
                            <span>
                                Fin de la etapa previa:{" "}
                                <strong>{puntoInicioEsperado}</strong>
                            </span>
                            <button
                                type="button"
                                className="font-semibold text-marca hover:underline"
                                onClick={() =>
                                    setValue("puntoInicio", puntoInicioEsperado, {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                Usar este punto
                            </button>
                        </div>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Punto de fin
                    <input
                        {...register("puntoFin")}
                        placeholder="Ej. Wayllabamba"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.puntoFin
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.puntoFin ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.puntoFin.message}
                        </span>
                    ) : null}
                    {puntoFinEsperado && puntoFinActual.trim() !== puntoFinEsperado ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-advertencia/40 bg-advertencia/10 px-2.5 py-1.5 text-xs font-normal text-texto">
                            <span>
                                Inicio de la etapa siguiente:{" "}
                                <strong>{puntoFinEsperado}</strong>
                            </span>
                            <button
                                type="button"
                                className="font-semibold text-marca hover:underline"
                                onClick={() =>
                                    setValue("puntoFin", puntoFinEsperado, {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                Usar este punto
                            </button>
                        </div>
                    ) : null}
                </label>
            </div>

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
                    {etapaEnEdicion ? "Actualizar en secuencia" : "Agregar a la secuencia"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioEtapa;

