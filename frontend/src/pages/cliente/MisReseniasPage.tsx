import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    esquemaPublicarResenia,
    estilosEstadoReserva,
    etiquetaEstadoReserva,
    etiquetaEstadoSalidaCliente,
    formatearFechaUtcCorta,
    formatearRangoFechasUtc,
    useHistorialReservasResenia,
    usePublicarReseniaCliente,
    type DatosPublicarReseniaForm,
    type ItemHistorialResenia,
} from "../../services/clientePortalService";

type FilaHistorialTabla = ItemHistorialResenia & {
    id: number;
    recorridoTexto: string;
    fechasTexto: string;
    estadoSalidaTexto: string;
    miValoracionTexto: string;
    acciones: string;
};

const FILAS_POR_PAGINA = 6;

const ETIQUETAS_ESTRELLAS: Record<number, string> = {
    1: "1 estrella · Muy insatisfecho",
    2: "2 estrellas · Insatisfecho",
    3: "3 estrellas · Aceptable",
    4: "4 estrellas · Muy buena experiencia",
    5: "5 estrellas · Excelente e inolvidable",
};

function renderizarEstrellas(valoracion: number): string {
    const llenas = Math.max(0, Math.min(5, Math.round(valoracion)));
    return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}

function MisReseniasPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const idSalidaPreseleccionada = Number(searchParams.get("idsalida") || 0);

    const [paginaActual, setPaginaActual] = useState(1);
    const [itemSeleccionado, setItemSeleccionado] =
        useState<ItemHistorialResenia | null>(null);
    const [mensajeExito, setMensajeExito] = useState<string | null>(null);

    const {
        data: historial = [],
        isLoading: cargandoHistorial,
        isError: errorHistorial,
        error: objErrorHistorial,
    } = useHistorialReservasResenia();

    const publicarMutacion = usePublicarReseniaCliente();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<DatosPublicarReseniaForm>({
        resolver: zodResolver(esquemaPublicarResenia),
        defaultValues: {
            idsalida: 0,
            valoracion: 5,
            comentario: "",
        },
    });

    const valoracionActual = watch("valoracion");
    const comentarioActual = watch("comentario") ?? "";

    useEffect(() => {
        document.title = "Publicar reseña · IncaTour";
    }, []);

    // Si viene ?idsalida=... en la URL y esa salida es reseñable, abre el formulario automáticamente
    useEffect(() => {
        if (!idSalidaPreseleccionada || historial.length === 0) return;
        const candidato = historial.find(
            (item) =>
                item.salida.idsalida === idSalidaPreseleccionada &&
                item.puedeResenar,
        );
        if (candidato) {
            abrirFormularioResenia(candidato);
            setSearchParams({}, { replace: true });
        }
    }, [idSalidaPreseleccionada, historial, setSearchParams]);

    function abrirFormularioResenia(item: ItemHistorialResenia) {
        setMensajeExito(null);
        publicarMutacion.reset();
        setItemSeleccionado(item);
        reset({
            idsalida: item.salida.idsalida,
            valoracion: 5,
            comentario: "",
        });
    }

    function cerrarFormularioResenia() {
        if (publicarMutacion.isPending) return;
        setItemSeleccionado(null);
        reset({
            idsalida: 0,
            valoracion: 5,
            comentario: "",
        });
    }

    function enviarResenia(datos: DatosPublicarReseniaForm) {
        publicarMutacion.mutate(
            {
                idsalida: datos.idsalida,
                valoracion: datos.valoracion,
                comentario: datos.comentario?.trim() || null,
            },
            {
                onSuccess: (respuesta) => {
                    setMensajeExito(respuesta.mensaje);
                    setItemSeleccionado(null);
                },
            },
        );
    }

    const resumen = useMemo(() => {
        const pendientesResena = historial.filter(
            (i) => i.puedeResenar,
        ).length;
        const publicadas = historial.filter((i) => Boolean(i.resenia)).length;
        return {
            total: historial.length,
            pendientesResena,
            publicadas,
        };
    }, [historial]);

    const totalPaginas = Math.max(
        1,
        Math.ceil(historial.length / FILAS_POR_PAGINA),
    );
    const paginaSegura = Math.min(paginaActual, totalPaginas);

    const filasPaginadas: FilaHistorialTabla[] = useMemo(() => {
        const inicio = (paginaSegura - 1) * FILAS_POR_PAGINA;
        return historial
            .slice(inicio, inicio + FILAS_POR_PAGINA)
            .map((item) => ({
                ...item,
                id: item.idreserva,
                recorridoTexto: item.salida.paquete.nombrePaquete,
                fechasTexto: formatearRangoFechasUtc(
                    item.salida.fechaInicio,
                    item.salida.fechaFin,
                ),
                estadoSalidaTexto: etiquetaEstadoSalidaCliente(
                    item.salida.estado,
                ),
                miValoracionTexto: item.resenia
                    ? `${item.resenia.valoracion}/5`
                    : "Sin reseña",
                acciones: "",
            }));
    }, [historial, paginaSegura]);

    return (
        <section
            aria-labelledby="resenias-cliente-titulo"
            className="space-y-6"
        >
            {/* ENCABEZADO CONSISTENTE CON PORTAL DEL GUÍA / GESTIÓN */}
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Portal del cliente
                    </p>
                    <h1
                        id="resenias-cliente-titulo"
                        className="mt-1 text-2xl font-bold text-navegacion md:text-3xl"
                    >
                        Publicar reseña
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Calificá con 1 a 5 estrellas las salidas finalizadas en
                        las que participaste con una reserva confirmada
                    </p>
                </div>
            </header>

            {mensajeExito ? (
                <Alerta tipo="exito" titulo="Reseña registrada">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{mensajeExito}</span>
                        <button
                            type="button"
                            onClick={() => setMensajeExito(null)}
                            className="text-xs font-semibold underline"
                        >
                            Cerrar aviso
                        </button>
                    </div>
                </Alerta>
            ) : null}

            {/* TARJETAS DE RESUMEN */}
            <div className="grid gap-4 sm:grid-cols-3">
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                        Reservas en tu historial
                    </p>
                    <p className="mt-1 text-2xl font-bold text-navegacion">
                        {resumen.total}
                    </p>
                </article>
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-marca-oscura">
                        Disponibles para reseñar
                    </p>
                    <p className="mt-1 text-2xl font-bold text-marca-oscura">
                        {resumen.pendientesResena}
                    </p>
                </article>
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-exito">
                        Reseñas publicadas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-exito">
                        {resumen.publicadas}
                    </p>
                </article>
            </div>

            {/* LISTADO DEL HISTORIAL DE RESERVAS PARA RESEÑAR */}
            <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-borde/70 pb-4">
                    <div>
                        <h2 className="text-base font-bold text-navegacion">
                            Historial de viajes y reseñas
                        </h2>
                        <p className="text-xs text-texto-suave">
                            Cada cliente puede publicar una única reseña por
                            salida una vez que el recorrido haya finalizado.
                        </p>
                    </div>
                </div>

                {cargandoHistorial ? (
                    <EstadoListado estado="cargando" />
                ) : errorHistorial ? (
                    <EstadoListado
                        estado="error"
                        mensaje={
                            objErrorHistorial instanceof Error
                                ? objErrorHistorial.message
                                : "No se pudo consultar tu historial de reservas para reseñar."
                        }
                    />
                ) : filasPaginadas.length === 0 ? (
                    <EstadoListado
                        estado="vacio"
                        mensaje="Todavía no tenés reservas registradas en tu historial."
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Tabla<FilaHistorialTabla>
                                filas={filasPaginadas}
                                columnas={[
                                    {
                                        clave: "nroReserva",
                                        titulo: "Reserva",
                                        renderizar: (fila) => (
                                            <div>
                                                <p className="font-mono text-xs font-bold text-navegacion">
                                                    {fila.nroReserva}
                                                </p>
                                                <span
                                                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${estilosEstadoReserva(
                                                        fila.estadoReserva,
                                                    )}`}
                                                >
                                                    {etiquetaEstadoReserva(
                                                        fila.estadoReserva,
                                                    )}
                                                </span>
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "recorridoTexto",
                                        titulo: "Paquete y salida",
                                        renderizar: (fila) => (
                                            <div>
                                                <p className="text-sm font-bold text-navegacion">
                                                    {
                                                        fila.salida.paquete
                                                            .nombrePaquete
                                                    }
                                                </p>
                                                <p className="font-mono text-xs text-texto-suave">
                                                    {fila.salida.nroSalida}
                                                </p>
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "fechasTexto",
                                        titulo: "Fechas del recorrido",
                                        renderizar: (fila) => (
                                            <span className="text-xs text-texto">
                                                {fila.fechasTexto}
                                            </span>
                                        ),
                                    },
                                    {
                                        clave: "estadoSalidaTexto",
                                        titulo: "Estado de la salida",
                                        renderizar: (fila) => (
                                            <span
                                                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                                    fila.salida.estado ===
                                                    "FINALIZADA"
                                                        ? "bg-[#e0f4e8] text-[#216442]"
                                                        : "bg-fondo text-texto-suave"
                                                }`}
                                            >
                                                {fila.estadoSalidaTexto}
                                            </span>
                                        ),
                                    },
                                    {
                                        clave: "miValoracionTexto",
                                        titulo: "Tu reseña",
                                        renderizar: (fila) =>
                                            fila.resenia ? (
                                                <div className="max-w-xs space-y-1">
                                                    <p className="text-sm font-bold text-amber-500">
                                                        {renderizarEstrellas(
                                                            fila.resenia
                                                                .valoracion,
                                                        )}{" "}
                                                        <span className="text-xs text-navegacion">
                                                            (
                                                            {
                                                                fila.resenia
                                                                    .valoracion
                                                            }
                                                            /5)
                                                        </span>
                                                    </p>
                                                    {fila.resenia.comentario ? (
                                                        <p className="text-xs text-texto">
                                                            “
                                                            {
                                                                fila.resenia
                                                                    .comentario
                                                            }
                                                            ”
                                                        </p>
                                                    ) : (
                                                        <p className="text-[11px] italic text-texto-suave">
                                                            Sin comentario
                                                            escrito
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-texto-suave">
                                                        Publicada el{" "}
                                                        {formatearFechaUtcCorta(
                                                            fila.resenia
                                                                .fechaEnvio,
                                                        )}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-texto-suave">
                                                    Pendiente de publicación
                                                </span>
                                            ),
                                    },
                                    {
                                        clave: "acciones",
                                        titulo: "Acciones",
                                        renderizar: (fila) => {
                                            if (fila.resenia) {
                                                return (
                                                    <span className="inline-flex items-center rounded-full bg-[#e0f4e8] px-2.5 py-1 text-xs font-bold text-[#216442]">
                                                        ✓ Reseña enviada
                                                    </span>
                                                );
                                            }
                                            if (fila.puedeResenar) {
                                                return (
                                                    <Boton
                                                        className="px-3 py-1.5 text-xs"
                                                        onClick={() =>
                                                            abrirFormularioResenia(
                                                                fila,
                                                            )
                                                        }
                                                    >
                                                        ★ Publicar reseña
                                                    </Boton>
                                                );
                                            }
                                            return (
                                                <span className="text-[11px] text-texto-suave">
                                                    {fila.estadoReserva !==
                                                    "CONFIRMADA"
                                                        ? "Reserva cancelada"
                                                        : "Disponible al finalizar la salida"}
                                                </span>
                                            );
                                        },
                                    },
                                ]}
                            />
                        </div>

                        {totalPaginas > 1 ? (
                            <Paginacion
                                paginaActual={paginaSegura}
                                totalPaginas={totalPaginas}
                                onCambiarPagina={setPaginaActual}
                            />
                        ) : null}
                    </>
                )}
            </article>

            {/* MODAL PARA PUBLICAR RESEÑA (CU-47 PASO 2: POST /api/resenias) */}
            {itemSeleccionado ? (
                <div
                    className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            cerrarFormularioResenia();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-publicar-resenia-titulo"
                        className="w-full max-w-lg rounded-tarjeta bg-white p-6 shadow-tarjeta"
                    >
                        <div className="border-b border-borde pb-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-marca">
                                Calificar experiencia
                            </p>
                            <h2
                                id="modal-publicar-resenia-titulo"
                                className="mt-1 text-xl font-bold text-navegacion"
                            >
                                {
                                    itemSeleccionado.salida.paquete
                                        .nombrePaquete
                                }
                            </h2>
                            <p className="mt-1 text-xs text-texto-suave">
                                Salida{" "}
                                <span className="font-mono font-semibold">
                                    {itemSeleccionado.salida.nroSalida}
                                </span>{" "}
                                ·{" "}
                                {formatearRangoFechasUtc(
                                    itemSeleccionado.salida.fechaInicio,
                                    itemSeleccionado.salida.fechaFin,
                                )}
                            </p>
                        </div>

                        <form
                            onSubmit={handleSubmit(enviarResenia)}
                            noValidate
                            className="mt-5 space-y-5"
                        >
                            {publicarMutacion.isError ? (
                                <Alerta tipo="error">
                                    {publicarMutacion.error.message}
                                </Alerta>
                            ) : null}

                            <input
                                type="hidden"
                                {...register("idsalida", {
                                    valueAsNumber: true,
                                })}
                            />

                            <div>
                                <span className="mb-2 block text-xs font-semibold text-texto">
                                    Valoración general (1 a 5 estrellas) *
                                </span>
                                <div
                                    role="radiogroup"
                                    aria-label="Valoración de 1 a 5 estrellas"
                                    className="flex items-center gap-2"
                                >
                                    {[1, 2, 3, 4, 5].map((estrella) => {
                                        const activa =
                                            estrella <= valoracionActual;
                                        return (
                                            <button
                                                key={estrella}
                                                type="button"
                                                role="radio"
                                                aria-checked={
                                                    valoracionActual ===
                                                    estrella
                                                }
                                                aria-label={`${estrella} ${estrella === 1 ? "estrella" : "estrellas"}`}
                                                onClick={() =>
                                                    setValue(
                                                        "valoracion",
                                                        estrella,
                                                        {
                                                            shouldValidate: true,
                                                        },
                                                    )
                                                }
                                                className={`grid size-11 place-items-center rounded-xl border text-2xl transition ${
                                                    activa
                                                        ? "border-amber-400 bg-amber-50 text-amber-500 shadow-xs"
                                                        : "border-borde bg-white text-slate-300 hover:border-amber-300 hover:text-amber-400"
                                                }`}
                                            >
                                                ★
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs font-semibold text-navegacion">
                                    {ETIQUETAS_ESTRELLAS[valoracionActual] ??
                                        `${valoracionActual} estrellas`}
                                </p>
                                {errors.valoracion ? (
                                    <p
                                        role="alert"
                                        className="mt-1 text-xs text-peligro"
                                    >
                                        {errors.valoracion.message}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label
                                        htmlFor="comentario-resenia"
                                        className="text-xs font-semibold text-texto"
                                    >
                                        Comentario sobre tu experiencia
                                        (opcional)
                                    </label>
                                    <span className="text-[11px] text-texto-suave">
                                        {comentarioActual.length}/1000
                                    </span>
                                </div>
                                <textarea
                                    id="comentario-resenia"
                                    rows={4}
                                    placeholder="Contanos qué te parecieron el circuito, los campamentos, los guías y la organización..."
                                    {...register("comentario")}
                                    className="w-full rounded-control border border-borde bg-white p-3 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.comentario ? (
                                    <p
                                        role="alert"
                                        className="mt-1 text-xs text-peligro"
                                    >
                                        {errors.comentario.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex justify-end gap-3 border-t border-borde pt-4">
                                <Boton
                                    variante="secundario"
                                    onClick={cerrarFormularioResenia}
                                    disabled={publicarMutacion.isPending}
                                >
                                    Cancelar
                                </Boton>
                                <Boton
                                    type="submit"
                                    cargando={publicarMutacion.isPending}
                                >
                                    Publicar reseña
                                </Boton>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

export default MisReseniasPage;
