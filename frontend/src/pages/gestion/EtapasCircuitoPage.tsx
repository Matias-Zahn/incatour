import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import {
    useCircuitos,
    useEtapasCircuito,
    useGuardarEtapasCircuito,
    type DatosEtapaCircuito,
    type EtapaCircuito,
} from "../../services/circuitoService";

function construirEtapasIniciales(
    etapasServidor?: EtapaCircuito[],
): DatosEtapaCircuito[] {
    if (etapasServidor && etapasServidor.length > 0) {
        return etapasServidor.map((etapa, indice) => ({
            numeroOrden: indice + 1,
            puntoInicio: etapa.puntoInicio,
            puntoFin: etapa.puntoFin,
            campamentoPrevisto: etapa.campamentoPrevisto ?? "",
        }));
    }
    return [
        {
            numeroOrden: 1,
            puntoInicio: "",
            puntoFin: "",
            campamentoPrevisto: "",
        },
    ];
}

function EtapasCircuitoPage() {
    const idCircuito = Number(useParams().idCircuito);
    const { data: circuitos = [] } = useCircuitos();
    const circuito = circuitos.find((item) => item.idcircuito === idCircuito);

    const {
        data: etapasServidor,
        isPending,
        isError,
        error,
    } = useEtapasCircuito(idCircuito);
    const guardarEtapas = useGuardarEtapasCircuito(idCircuito);

    const [etapasEditadas, setEtapasEditadas] = useState<
        DatosEtapaCircuito[] | null
    >(null);
    const [errorLocal, setErrorLocal] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    const etapas = etapasEditadas ?? construirEtapasIniciales(etapasServidor);

    function actualizarCampo(
        indice: number,
        campo: "puntoInicio" | "puntoFin" | "campamentoPrevisto",
        valor: string,
    ) {
        setErrorLocal("");
        setMensajeExito("");
        setEtapasEditadas((previas) => {
            const base = previas ?? construirEtapasIniciales(etapasServidor);
            const nuevas = base.map((etapa, idx) =>
                idx === indice ? { ...etapa, [campo]: valor } : etapa,
            );
            if (
                campo === "puntoFin" &&
                indice + 1 < nuevas.length &&
                (!nuevas[indice + 1].puntoInicio ||
                    nuevas[indice + 1].puntoInicio === base[indice].puntoFin)
            ) {
                nuevas[indice + 1] = {
                    ...nuevas[indice + 1],
                    puntoInicio: valor,
                };
            }
            return nuevas;
        });
    }

    function agregarEtapa() {
        setErrorLocal("");
        setMensajeExito("");
        setEtapasEditadas((previas) => {
            const base = previas ?? construirEtapasIniciales(etapasServidor);
            const ultima = base[base.length - 1];
            return [
                ...base,
                {
                    numeroOrden: base.length + 1,
                    puntoInicio: ultima?.puntoFin ?? "",
                    puntoFin: "",
                    campamentoPrevisto: "",
                },
            ];
        });
    }

    function quitarEtapa(indice: number) {
        if (etapas.length <= 1) {
            setErrorLocal("La secuencia de etapas no puede quedar vacía.");
            return;
        }
        setErrorLocal("");
        setMensajeExito("");
        setEtapasEditadas((previas) => {
            const base = previas ?? construirEtapasIniciales(etapasServidor);
            return base
                .filter((_, idx) => idx !== indice)
                .map((etapa, idx) => ({
                    ...etapa,
                    numeroOrden: idx + 1,
                }));
        });
    }

    function validarSecuencia(): string | null {
        if (etapas.length === 0) {
            return "La secuencia de etapas no puede estar vacía.";
        }
        for (let i = 0; i < etapas.length; i++) {
            const actual = etapas[i];
            if (!actual.puntoInicio.trim()) {
                return `La etapa ${i + 1} requiere un punto de inicio.`;
            }
            if (!actual.puntoFin.trim()) {
                return `La etapa ${i + 1} requiere un punto de fin.`;
            }
            if (i < etapas.length - 1) {
                const siguiente = etapas[i + 1];
                if (
                    actual.puntoFin.trim() !== siguiente.puntoInicio.trim()
                ) {
                    return `Discontinuidad espacial: el punto de fin de la etapa ${
                        i + 1
                    } ("${actual.puntoFin.trim()}") debe coincidir exactamente con el punto de inicio de la etapa ${
                        i + 2
                    } ("${siguiente.puntoInicio.trim()}").`;
                }
            }
        }
        return null;
    }

    function manejarGuardado(evento: React.FormEvent) {
        evento.preventDefault();
        setErrorLocal("");
        setMensajeExito("");

        const errorValidacion = validarSecuencia();
        if (errorValidacion) {
            setErrorLocal(errorValidacion);
            return;
        }

        guardarEtapas.mutate(etapas, {
            onSuccess: (nuevas) => {
                setEtapasEditadas(construirEtapasIniciales(nuevas));
                setMensajeExito(
                    "Secuencia de etapas establecida exitosamente.",
                );
            },
            onError: (e: Error) => {
                setErrorLocal(e.message);
            },
        });
    }

    const estado = isPending ? "cargando" : isError ? "error" : "exito";

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Link
                        to="/gestion/circuitos"
                        className="text-sm font-semibold text-marca hover:underline"
                    >
                        ← Volver a circuitos
                    </Link>
                    <p className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Secuencia de ruta (CU-05)
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        {circuito
                            ? `Etapas: ${circuito.nombreCircuito}`
                            : "Etapas del circuito"}
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        {circuito
                            ? `Duración configurada: ${circuito.duracionDias} ${
                                  circuito.duracionDias === 1 ? "día" : "días"
                              } · Dificultad: ${circuito.dificultad}. `
                            : ""}
                        El punto de fin de cada etapa debe coincidir con el punto de inicio de la etapa siguiente.
                    </p>
                </div>

                <Boton
                    type="button"
                    variante="secundario"
                    onClick={agregarEtapa}
                    disabled={estado !== "exito" || guardarEtapas.isPending}
                >
                    + Agregar etapa
                </Boton>
            </header>

            {mensajeExito ? (
                <Alerta tipo="exito" titulo="Cambios guardados">
                    {mensajeExito}
                </Alerta>
            ) : null}

            {errorLocal ? (
                <Alerta
                    tipo="error"
                    titulo="No se pudo guardar la secuencia de etapas"
                >
                    {errorLocal}
                </Alerta>
            ) : null}

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : (
                <form
                    onSubmit={manejarGuardado}
                    className="space-y-4 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
                >
                    <div className="space-y-4">
                        {etapas.map((etapa, indice) => (
                            <div
                                key={indice}
                                className="rounded-control border border-borde bg-fondo/50 p-4"
                            >
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center rounded-full bg-marca-activa px-3 py-1 text-xs font-bold text-marca-oscura">
                                        Etapa #{indice + 1}
                                    </span>
                                    {etapas.length > 1 ? (
                                        <Boton
                                            type="button"
                                            variante="fantasma"
                                            className="px-2.5 py-1 text-xs text-peligro hover:bg-peligro/10"
                                            onClick={() => quitarEtapa(indice)}
                                            disabled={guardarEtapas.isPending}
                                        >
                                            Quitar etapa
                                        </Boton>
                                    ) : null}
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                        Punto de inicio
                                        <input
                                            type="text"
                                            value={etapa.puntoInicio}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    indice,
                                                    "puntoInicio",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder={
                                                indice === 0
                                                    ? "Ej. Km 82"
                                                    : "Coincide con fin anterior"
                                            }
                                            className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        />
                                    </label>

                                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                        Punto de fin
                                        <input
                                            type="text"
                                            value={etapa.puntoFin}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    indice,
                                                    "puntoFin",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Ej. Wayllabamba"
                                            className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        />
                                    </label>

                                    <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                        Campamento previsto (opcional)
                                        <input
                                            type="text"
                                            value={
                                                etapa.campamentoPrevisto ?? ""
                                            }
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    indice,
                                                    "campamentoPrevisto",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Ej. Wayllabamba Camp"
                                            className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        />
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
                        <p className="text-xs text-texto-suave">
                            Al confirmar, se reemplaza de forma atómica toda la secuencia de etapas del circuito.
                        </p>
                        <div className="flex gap-3">
                            <Boton
                                type="button"
                                variante="secundario"
                                onClick={agregarEtapa}
                                disabled={guardarEtapas.isPending}
                            >
                                + Agregar otra etapa
                            </Boton>
                            <Boton
                                type="submit"
                                cargando={guardarEtapas.isPending}
                            >
                                Guardar secuencia completa
                            </Boton>
                        </div>
                    </div>
                </form>
            )}
        </section>
    );
}

export default EtapasCircuitoPage;
