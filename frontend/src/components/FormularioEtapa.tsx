import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import { esquemaEtapa, type DatosEtapa, type Etapa } from "../services/etapaService";

type FormularioEtapaProps = {
    etapaEnEdicion?: Etapa | null;
    numeroOrdenSugerido: number;
    puntoInicioSugerido?: string;
    alGuardar: (datos: DatosEtapa) => void;
    alCancelar: () => void;
    guardando?: boolean;
};

function FormularioEtapa({
    etapaEnEdicion,
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
                    Recordá que el punto de inicio de cada etapa debe coincidir con el punto de fin de la etapa anterior.
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
