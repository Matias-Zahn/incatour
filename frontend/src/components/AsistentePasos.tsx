import type { ReactNode } from "react";
import Alerta from "./Alerta";
import Boton from "./Boton";

export type DefinicionPaso = {
    titulo: string;
    descripcion?: string;
};

type AsistentePasosProps = {
    titulo: string;
    subtitulo?: string;
    pasos: DefinicionPaso[];
    pasoActual: number; // 0-indexed
    alCambiarPaso: (nuevoPaso: number) => void;
    alSiguiente: () => void;
    alAtras: () => void;
    alCancelar: () => void;
    textoGuardar: string;
    guardando?: boolean;
    deshabilitarSiguiente?: boolean;
    deshabilitarGuardar?: boolean;
    errorPaso?: string;
    errorServidor?: string;
    children: ReactNode;
};

/**
 * Contenedor reutilizable para los asistentes por pasos (B7, B11):
 * muestra "Paso X de N", permite volver a pasos anteriores y valida antes de avanzar.
 */
function AsistentePasos({
    titulo,
    subtitulo,
    pasos,
    pasoActual,
    alCambiarPaso,
    alSiguiente,
    alAtras,
    alCancelar,
    textoGuardar,
    guardando = false,
    deshabilitarSiguiente = false,
    deshabilitarGuardar = false,
    errorPaso,
    errorServidor,
    children,
}: AsistentePasosProps) {
    const esPrimero = pasoActual === 0;
    const esUltimo = pasoActual === pasos.length - 1;
    const paso = pasos[pasoActual];

    return (
        <div className="space-y-5">
            <header className="space-y-3 border-b border-borde pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-marca">
                            Paso {pasoActual + 1} de {pasos.length}
                        </p>
                        <h2 className="mt-0.5 text-xl font-bold text-navegacion">{titulo}</h2>
                        {subtitulo ? (
                            <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>
                        ) : null}
                    </div>
                </div>

                <nav aria-label="Pasos del asistente">
                    <ol className="grid gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
                        {pasos.map((item, indice) => {
                            const completado = indice < pasoActual;
                            const activo = indice === pasoActual;
                            return (
                                <li key={item.titulo} className="md:flex-1">
                                    <button
                                        type="button"
                                        disabled={!completado}
                                        onClick={() => completado && alCambiarPaso(indice)}
                                        aria-current={activo ? "step" : undefined}
                                        className={`flex w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                            activo
                                                ? "border-marca bg-marca-suave text-marca-oscura"
                                                : completado
                                                  ? "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300"
                                                  : "cursor-default border-borde bg-fondo/50 text-texto-suave"
                                        }`}
                                    >
                                        <span
                                            className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                                activo
                                                    ? "bg-marca text-white"
                                                    : completado
                                                      ? "bg-emerald-600 text-white"
                                                      : "bg-borde text-texto-suave"
                                            }`}
                                        >
                                            {completado ? "✓" : indice + 1}
                                        </span>
                                        <span className="truncate">{item.titulo}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>
            </header>

            {paso?.descripcion ? (
                <p className="text-xs text-texto-suave">{paso.descripcion}</p>
            ) : null}

            {errorPaso ? (
                <Alerta tipo="error" titulo="Revisá este paso antes de continuar">
                    {errorPaso}
                </Alerta>
            ) : null}

            {errorServidor ? (
                <Alerta tipo="error" titulo="No se pudo guardar">
                    {errorServidor}
                </Alerta>
            ) : null}

            <div className="space-y-4">{children}</div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
                <Boton
                    type="button"
                    variante="fantasma"
                    onClick={alCancelar}
                    disabled={guardando}
                >
                    Cancelar
                </Boton>

                <div className="flex flex-wrap items-center gap-2">
                    {!esPrimero ? (
                        <Boton
                            type="button"
                            variante="secundario"
                            onClick={alAtras}
                            disabled={guardando}
                        >
                            Atrás
                        </Boton>
                    ) : null}

                    {!esUltimo ? (
                        <Boton
                            key="paso-siguiente"
                            type="button"
                            onClick={(evento) => {
                                evento.preventDefault();
                                alSiguiente();
                            }}
                            disabled={guardando || deshabilitarSiguiente}
                        >
                            Siguiente
                        </Boton>
                    ) : (
                        <Boton
                            key="paso-guardar"
                            type="submit"
                            cargando={guardando}
                            disabled={deshabilitarGuardar}
                        >
                            {textoGuardar}
                        </Boton>
                    )}
                </div>
            </footer>
        </div>
    );
}

export default AsistentePasos;
