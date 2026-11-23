import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AsistentePasos, { type DefinicionPaso } from "./AsistentePasos";
import Boton from "./Boton";
import {
    esquemaCircuito,
    nivelesDificultad,
    reglasPorteadores,
    useEtapasCircuito,
    type Circuito,
    type DatosCircuito,
    type DatosEtapaCircuito,
} from "../services/circuitoService";

type EtapaBorrador = {
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto: string;
};

type FormularioCircuitoProps = {
    circuitoEnEdicion?: Circuito | null;
    alGuardar: (datos: DatosCircuito, etapas: DatosEtapaCircuito[] | null) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

const PASOS_CIRCUITO: DefinicionPaso[] = [
    { titulo: "Datos del circuito" },
    { titulo: "Etapas de ruta" },
];

function valoresPorDefecto(circuito?: Circuito | null): DatosCircuito {
    return {
        nombreCircuito: circuito?.nombreCircuito ?? "",
        duracionDias: circuito?.duracionDias ?? 1,
        dificultad: circuito?.dificultad ?? "Media",
        minimoGuias: circuito?.minimoGuias ?? 1,
        horasPrimerAvance: circuito?.horasPrimerAvance ?? 12,
        parametrosPorteadores: circuito?.parametrosPorteadores ?? "",
    };
}

function mapearEtapasABorrador(
    etapas?: { numeroOrden: number; puntoInicio: string; puntoFin: string; campamentoPrevisto?: string | null }[],
): EtapaBorrador[] {
    if (!etapas || etapas.length === 0) return [];
    return [...etapas]
        .sort((a, b) => a.numeroOrden - b.numeroOrden)
        .map((e) => ({
            puntoInicio: e.puntoInicio,
            puntoFin: e.puntoFin,
            campamentoPrevisto: e.campamentoPrevisto ?? "",
        }));
}

function FormularioCircuito({
    circuitoEnEdicion,
    alGuardar,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioCircuitoProps) {
    const [pasoActual, setPasoActual] = useState(0);
    const [etapasEditadas, setEtapasEditadas] = useState<EtapaBorrador[] | null>(
        null,
    );
    const [errorEtapas, setErrorEtapas] = useState("");

    const { data: etapasRemotas } = useEtapasCircuito(
        circuitoEnEdicion?.idcircuito ?? 0,
    );

    const etapas =
        etapasEditadas ??
        mapearEtapasABorrador(etapasRemotas ?? circuitoEnEdicion?.etapas);
    const etapasModificadas = etapasEditadas !== null;

    const {
        register,
        handleSubmit,
        trigger,
        control,
        formState: { errors },
    } = useForm<DatosCircuito>({
        resolver: zodResolver(esquemaCircuito),
        defaultValues: valoresPorDefecto(circuitoEnEdicion),
    });

    const duracionDias = useWatch({ control, name: "duracionDias" }) ?? 1;

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

    async function manejarSiguiente() {
        const valido = await trigger([
            "nombreCircuito",
            "dificultad",
            "duracionDias",
            "minimoGuias",
            "horasPrimerAvance",
            "parametrosPorteadores",
        ]);
        if (valido) {
            setPasoActual(1);
        }
    }

    function agregarEtapa() {
        setErrorEtapas("");
        const ultima = etapas[etapas.length - 1];
        setEtapasEditadas([
            ...etapas,
            {
                puntoInicio: ultima?.puntoFin.trim() ?? "",
                puntoFin: "",
                campamentoPrevisto: "",
            },
        ]);
    }

    function actualizarEtapa(
        indice: number,
        campo: keyof EtapaBorrador,
        valor: string,
    ) {
        setErrorEtapas("");
        setEtapasEditadas(
            etapas.map((etapa, i) =>
                i === indice ? { ...etapa, [campo]: valor } : etapa,
            ),
        );
    }

    function eliminarEtapa(indice: number) {
        setErrorEtapas("");
        setEtapasEditadas(etapas.filter((_, i) => i !== indice));
    }

    function validarEtapas(): DatosEtapaCircuito[] | null | false {
        if (etapas.length === 0) {
            return null;
        }
        const limpias: DatosEtapaCircuito[] = [];
        for (let i = 0; i < etapas.length; i++) {
            const actual = etapas[i]!;
            const inicio = actual.puntoInicio.trim();
            const fin = actual.puntoFin.trim();
            if (!inicio || !fin) {
                setErrorEtapas(
                    `Completá el punto de inicio y fin de la etapa ${i + 1}.`,
                );
                return false;
            }
            if (i > 0) {
                const anteriorFin = etapas[i - 1]!.puntoFin.trim();
                if (anteriorFin !== inicio) {
                    setErrorEtapas(
                        `La etapa ${i + 1} debe iniciar en "${anteriorFin}" para mantener la continuidad de la ruta.`,
                    );
                    return false;
                }
            }
            limpias.push({
                numeroOrden: i + 1,
                puntoInicio: inicio,
                puntoFin: fin,
                campamentoPrevisto: actual.campamentoPrevisto.trim() || null,
            });
        }
        setErrorEtapas("");
        return limpias;
    }

    const enviarFormulario = handleSubmit((datos) => {
        const etapasValidadas = validarEtapas();
        if (etapasValidadas === false) return;
        const enviarEtapas =
            etapasModificadas || (!circuitoEnEdicion && etapasValidadas !== null)
                ? etapasValidadas
                : null;
        alGuardar(datos, enviarEtapas);
    });

    return (
        <form className="p-6" onSubmit={enviarFormulario}>
            <AsistentePasos
                titulo={
                    circuitoEnEdicion
                        ? "Editar circuito turístico"
                        : "Registrar circuito turístico"
                }
                subtitulo="Definí los datos del recorrido y, si querés, cargá las etapas de ruta en el segundo paso."
                pasos={PASOS_CIRCUITO}
                pasoActual={pasoActual}
                alCambiarPaso={(destino) => {
                    if (destino < pasoActual) setPasoActual(destino);
                }}
                alSiguiente={manejarSiguiente}
                alAtras={() => setPasoActual(0)}
                alCancelar={alCancelar}
                textoGuardar={
                    circuitoEnEdicion ? "Guardar cambios" : "Registrar circuito"
                }
                guardando={guardando}
                errorPaso={errorEtapas || undefined}
                errorServidor={errorServidor || undefined}
            >
                {pasoActual === 0 ? (
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

                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Horas para el primer avance
                            <input
                                type="number"
                                min={1}
                                max={72}
                                step={1}
                                {...register("horasPrimerAvance", { valueAsNumber: true })}
                                className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                                    errors.horasPrimerAvance
                                        ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                        : "border-borde focus:border-marca focus:ring-marca/20"
                                }`}
                                placeholder="Ej. 12"
                            />
                            <span className="text-xs font-normal text-texto-suave">
                                Si el guía no informa la primera etapa en ese tiempo desde que inició la salida, se avisa en Salidas.
                            </span>
                            {errors.horasPrimerAvance ? (
                                <span
                                    className="text-xs font-normal text-peligro"
                                    role="alert"
                                >
                                    {errors.horasPrimerAvance.message}
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
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-texto">
                                    Secuencia de etapas ({etapas.length} cargada{etapas.length === 1 ? "" : "s"})
                                </p>
                                <p className="text-xs text-texto-suave">
                                    Duración prevista: {duracionDias} día{duracionDias === 1 ? "" : "s"}. El inicio de cada etapa debe coincidir con el fin de la anterior. También podés dejarlas vacías y cargarlas después.
                                </p>
                            </div>
                            <Boton
                                type="button"
                                variante="secundario"
                                className="px-3 py-1.5 text-xs"
                                onClick={agregarEtapa}
                            >
                                + Agregar etapa
                            </Boton>
                        </div>

                        {etapas.length === 0 ? (
                            <p className="rounded-control border border-dashed border-borde bg-fondo/40 p-4 text-center text-sm text-texto-suave">
                                Sin etapas cargadas todavía. Hacé clic en «+ Agregar etapa» para armar el recorrido o guardá el circuito y completalas luego.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {etapas.map((etapa, indice) => (
                                    <div
                                        key={indice}
                                        className="rounded-control border border-borde bg-fondo/40 p-3"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wide text-navegacion">
                                                Etapa {indice + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => eliminarEtapa(indice)}
                                                className="text-xs font-semibold text-peligro hover:underline"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                                Punto de inicio
                                                <input
                                                    type="text"
                                                    value={etapa.puntoInicio}
                                                    onChange={(e) =>
                                                        actualizarEtapa(
                                                            indice,
                                                            "puntoInicio",
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Ej. Km 82"
                                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                                Punto de fin
                                                <input
                                                    type="text"
                                                    value={etapa.puntoFin}
                                                    onChange={(e) =>
                                                        actualizarEtapa(
                                                            indice,
                                                            "puntoFin",
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Ej. Wayllabamba"
                                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                                />
                                            </label>
                                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                                Campamento (opcional)
                                                <input
                                                    type="text"
                                                    value={etapa.campamentoPrevisto}
                                                    onChange={(e) =>
                                                        actualizarEtapa(
                                                            indice,
                                                            "campamentoPrevisto",
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Ej. Campamento Wayllabamba"
                                                    className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </AsistentePasos>
        </form>
    );
}

export default FormularioCircuito;
