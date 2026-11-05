import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import ModalDetalleReserva from "../../components/ModalDetalleReserva";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    esquemaCancelarReserva,
    estilosEstadoReserva,
    etiquetaEstadoReserva,
    etiquetaEstadoSalidaCliente,
    formatearFechaLocalCorta,
    formatearMontoUsd,
    formatearRangoFechasUtc,
    obtenerComprobanteMiReserva,
    reservaAdmiteCancelacion,
    textoAlojamiento,
    useConfirmarCancelacionReserva,
    useLiquidacionCancelacion,
    useMisReservas,
    type DatosCancelarReservaForm,
    type EstadoReservaCliente,
    type ReservaClienteResumen,
    type ResultadoCancelacionReserva,
} from "../../services/clientePortalService";
import { descargarComprobantePdf } from "../../services/pdf";

type FilaReservaTabla = ReservaClienteResumen & {
    id: number;
    itinerarioTexto: string;
    fechaTexto: string;
    totalTexto: string;
    pagosTexto: string;
    acciones: string;
};

const FILAS_POR_PAGINA = 6;

function MisReservasPage() {
    const navegar = useNavigate();

    const [filtroEstado, setFiltroEstado] = useState<"" | EstadoReservaCliente>(
        "",
    );
    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);

    // Estado para ver el detalle de una reserva (CU-31)
    const [idReservaDetalle, setIdReservaDetalle] = useState<number | null>(
        null,
    );

    // Estado para el flujo de cancelación de 2 pasos (CU-32)
    const [idReservaACancelar, setIdReservaACancelar] = useState<number | null>(
        null,
    );
    const [confirmacionFinalAbierta, setConfirmacionFinalAbierta] =
        useState(false);

    // Estado de descarga de comprobante y notificaciones
    const [idDescargandoComprobante, setIdDescargandoComprobante] = useState<
        number | null
    >(null);
    const [filtroViaje, setFiltroViaje] = useState<"" | "PROXIMOS" | "PASADOS">("");
    const [avisoExito, setAvisoExito] = useState<string | null>(null);
    const [errorAccion, setErrorAccion] = useState<string | null>(null);
    const [resultadoCancelacion, setResultadoCancelacion] =
        useState<ResultadoCancelacionReserva | null>(null);

    const {
        data: reservas = [],
        isLoading: cargandoReservas,
        isError: hayErrorReservas,
        error: errorReservas,
    } = useMisReservas();


    const {
        data: liquidacionCancelacion,
        isLoading: cargandoLiquidacion,
        isError: errorLiquidacion,
        error: objErrorLiquidacion,
    } = useLiquidacionCancelacion(idReservaACancelar);

    const confirmarCancelacionMutacion = useConfirmarCancelacionReserva();

    const {
        register,
        handleSubmit,
        reset: resetFormularioCancelacion,
        getValues,
        formState: { errors: erroresCancelacion },
    } = useForm<DatosCancelarReservaForm>({
        resolver: zodResolver(esquemaCancelarReserva),
        defaultValues: { motivo: "" },
    });

    useEffect(() => {
        document.title = "Mis reservas · IncaTour";
    }, []);

    const reservasFiltradas = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();
        const hoy = new Date().toLocaleDateString("en-CA");
        const esProximo = (r: ReservaClienteResumen) => r.salida.fechaFin.slice(0, 10) >= hoy;
        return reservas
            .filter(
                (r) =>
                    (!filtroEstado || r.estado === filtroEstado) &&
                    (!filtroViaje || esProximo(r) === (filtroViaje === "PROXIMOS")) &&
                    (!termino ||
                        r.nroReserva.toLowerCase().includes(termino) ||
                        r.paquete.nombrePaquete.toLowerCase().includes(termino)),
            )
            .sort((a, b) => Number(esProximo(b)) - Number(esProximo(a)));
    }, [reservas, busqueda, filtroEstado, filtroViaje]);

    const totalPaginas = Math.max(
        1,
        Math.ceil(reservasFiltradas.length / FILAS_POR_PAGINA),
    );
    const paginaSegura = Math.min(paginaActual, totalPaginas);

    const filasPaginadas: FilaReservaTabla[] = useMemo(() => {
        const inicio = (paginaSegura - 1) * FILAS_POR_PAGINA;
        return reservasFiltradas
            .slice(inicio, inicio + FILAS_POR_PAGINA)
            .map((r) => ({
                ...r,
                id: r.idreserva,
                itinerarioTexto: r.paquete.nombrePaquete,
                fechaTexto: formatearRangoFechasUtc(
                    r.salida.fechaInicio,
                    r.salida.fechaFin,
                ),
                totalTexto: formatearMontoUsd(r.precioCongelado),
                pagosTexto:
                    r.pagado > 0 ? "Pagado" : "Sin pagos registrados",
                acciones: "",
            }));
    }, [reservasFiltradas, paginaSegura]);

    const resumenCantidades = useMemo(() => {
        const confirmadas = reservas.filter(
            (r) => r.estado === "CONFIRMADA",
        ).length;
        const canceladas = reservas.filter(
            (r) => r.estado === "CANCELADA",
        ).length;
        return {
            total: reservas.length,
            confirmadas,
            canceladas,
        };
    }, [reservas]);

    async function manejarDescargarComprobante(reserva: ReservaClienteResumen) {
        try {
            setErrorAccion(null);
            setIdDescargandoComprobante(reserva.idreserva);
            const comprobante = await obtenerComprobanteMiReserva(
                reserva.idreserva,
            );
            await descargarComprobantePdf(comprobante);
            setAvisoExito(
                `Se descargó el comprobante de la reserva ${comprobante.nroReserva}.`,
            );
        } catch (err) {
            setErrorAccion(
                err instanceof Error
                    ? err.message
                    : "No se pudo descargar el comprobante de la reserva.",
            );
        } finally {
            setIdDescargandoComprobante(null);
        }
    }

    function abrirModalCancelacion(idreserva: number) {
        setAvisoExito(null);
        setErrorAccion(null);
        setResultadoCancelacion(null);
        confirmarCancelacionMutacion.reset();
        resetFormularioCancelacion({ motivo: "" });
        setIdReservaACancelar(idreserva);
    }

    function cerrarModalCancelacion() {
        if (confirmarCancelacionMutacion.isPending) return;
        setConfirmacionFinalAbierta(false);
        setIdReservaACancelar(null);
        confirmarCancelacionMutacion.reset();
        resetFormularioCancelacion({ motivo: "" });
    }

    function pasarAConfirmacionFinal() {
        confirmarCancelacionMutacion.reset();
        setConfirmacionFinalAbierta(true);
    }

    function ejecutarCancelacionConfirmada() {
        if (!idReservaACancelar) return;
        const motivo = getValues("motivo")?.trim();
        confirmarCancelacionMutacion.mutate(
            {
                idreserva: idReservaACancelar,
                motivo: motivo || undefined,
            },
            {
                onSuccess: (respuesta) => {
                    setConfirmacionFinalAbierta(false);
                    setIdReservaACancelar(null);
                    setResultadoCancelacion(respuesta.data);
                    setAvisoExito(respuesta.mensaje);
                },
                onError: () => {
                    setConfirmacionFinalAbierta(false);
                },
            },
        );
    }

    return (
        <section aria-labelledby="bookings-title" className="space-y-6">
            {/* ENCABEZADO CONSISTENTE CON PORTAL DEL GUÍA / GESTIÓN */}
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Portal del cliente
                    </p>
                    <h1
                        id="bookings-title"
                        className="mt-1 text-2xl font-bold text-navegacion md:text-3xl"
                    >
                        Mis reservas
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Consultá tus itinerarios, nómina de pasajeros, pagos,
                        comprobantes y gestioná cancelaciones
                    </p>
                </div>
            </header>

            {/* ALERTAS DE ÉXITO O ERROR */}
            {avisoExito ? (
                <Alerta tipo="exito" titulo="Operación exitosa">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{avisoExito}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setAvisoExito(null);
                                setResultadoCancelacion(null);
                            }}
                            className="text-xs font-semibold underline"
                        >
                            Cerrar aviso
                        </button>
                    </div>
                    {resultadoCancelacion ? (
                        <div className="mt-3 grid gap-3 rounded-control border border-exito/30 bg-white/80 p-3 text-xs sm:grid-cols-4">
                            <div>
                                <p className="font-semibold text-texto-suave">
                                    Reserva cancelada
                                </p>
                                <p className="font-mono font-bold text-navegacion">
                                    {resultadoCancelacion.nroReserva}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-texto-suave">
                                    Monto reembolsado
                                </p>
                                <p className="font-bold text-navegacion">
                                    {formatearMontoUsd(
                                        resultadoCancelacion.reembolso
                                            .montoReembolsado,
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-texto-suave">
                                    Motivo registrado
                                </p>
                                <p className="text-texto">
                                    {resultadoCancelacion.reembolso.motivo}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-texto-suave">
                                    Nota
                                </p>
                                <p className="text-texto-suave">
                                    {resultadoCancelacion.reembolso.nota}
                                </p>
                            </div>
                        </div>
                    ) : null}
                </Alerta>
            ) : null}

            {errorAccion ? (
                <Alerta tipo="error" titulo="No se pudo completar la acción">
                    {errorAccion}
                </Alerta>
            ) : null}

            {/* TARJETAS DE RESUMEN */}
            <div className="grid gap-4 sm:grid-cols-3">
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                        Total
                    </p>
                    <p className="mt-1 text-2xl font-bold text-navegacion">
                        {resumenCantidades.total}
                    </p>
                </article>
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-exito">
                        Confirmadas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-exito">
                        {resumenCantidades.confirmadas}
                    </p>
                </article>
                <article className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta">
                    <p className="text-xs font-bold uppercase tracking-wide text-peligro">
                        Canceladas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-peligro">
                        {resumenCantidades.canceladas}
                    </p>
                </article>
            </div>

            {/* PANEL DE FILTROS Y LISTADO DE RESERVAS */}
            <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-borde/70 pb-4">
                    <div>
                        <h2 className="text-base font-bold text-navegacion">
                            Reservas del cliente
                        </h2>
                        <p className="text-xs text-texto-suave">
                            Filtrá por estado o buscá por código de reserva,
                            paquete o salida.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label
                                htmlFor="filtro-busqueda-reserva"
                                className="mb-1.5 block text-xs font-semibold text-texto"
                            >
                                Buscar reserva o paquete
                            </label>
                            <input
                                id="filtro-busqueda-reserva"
                                type="search"
                                value={busqueda}
                                onChange={(e) => {
                                    setBusqueda(e.target.value);
                                    setPaginaActual(1);
                                }}
                                placeholder="Ej.: RES-0001 o Inca Clásico"
                                className="w-60 rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="filtro-viaje-reserva"
                                className="mb-1.5 block text-xs font-semibold text-texto"
                            >
                                Viaje
                            </label>
                            <select
                                id="filtro-viaje-reserva"
                                value={filtroViaje}
                                onChange={(e) => {
                                    setFiltroViaje(e.target.value as typeof filtroViaje);
                                    setPaginaActual(1);
                                }}
                                className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca"
                            >
                                <option value="">Todos</option>
                                <option value="PROXIMOS">Próximos</option>
                                <option value="PASADOS">Pasados</option>
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="filtro-estado-reserva"
                                className="mb-1.5 block text-xs font-semibold text-texto"
                            >
                                Estado
                            </label>
                            <select
                                id="filtro-estado-reserva"
                                value={filtroEstado}
                                onChange={(e) => {
                                    setFiltroEstado(
                                        e.target.value as
                                            | ""
                                            | EstadoReservaCliente,
                                    );
                                    setPaginaActual(1);
                                }}
                                className="rounded-control border border-borde bg-white px-3 py-2 text-xs text-texto outline-none focus:border-marca"
                            >
                                <option value="">Todas</option>
                                <option value="CONFIRMADA">Confirmadas</option>
                                <option value="CANCELADA">Canceladas</option>
                            </select>
                        </div>
                    </div>
                </div>

                {cargandoReservas ? (
                    <EstadoListado estado="cargando" />
                ) : hayErrorReservas ? (
                    <EstadoListado
                        estado="error"
                        mensaje={
                            errorReservas instanceof Error
                                ? errorReservas.message
                                : "No se pudieron consultar tus reservas."
                        }
                    />
                ) : filasPaginadas.length === 0 ? (
                    <EstadoListado
                        estado="vacio"
                        mensaje="No se encontraron reservas para los filtros seleccionados."
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Tabla<FilaReservaTabla>
                                filas={filasPaginadas}
                                columnas={[
                                    {
                                        clave: "nroReserva",
                                        titulo: "ID / Reserva",
                                        renderizar: (fila) => (
                                            <div>
                                                <p className="font-mono text-xs font-bold text-navegacion">
                                                    {fila.nroReserva}
                                                </p>
                                                <p className="text-[11px] text-texto-suave">
                                                    Emitida:{" "}
                                                    {formatearFechaLocalCorta(
                                                        fila.fechaRealizacion,
                                                    )}
                                                </p>
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "estado",
                                        titulo: "Estado",
                                        renderizar: (fila) => (
                                            <div className="space-y-1">
                                                <span
                                                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${estilosEstadoReserva(
                                                        fila.estado,
                                                    )}`}
                                                >
                                                    {etiquetaEstadoReserva(
                                                        fila.estado,
                                                    )}
                                                </span>
                                                {fila.estadoAlojamiento ? (
                                                    <p className="text-[11px] text-texto-suave">
                                                        {textoAlojamiento(fila.estadoAlojamiento)}
                                                    </p>
                                                ) : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "itinerarioTexto",
                                        titulo: "Itinerario / Salida",
                                        renderizar: (fila) => (
                                            <div>
                                                <p className="text-sm font-bold text-navegacion">
                                                    {fila.paquete.nombrePaquete}
                                                </p>
                                                <p className="text-xs text-texto-suave">
                                                    Salida:{" "}
                                                    {etiquetaEstadoSalidaCliente(
                                                        fila.salida.estado,
                                                    )}
                                                </p>
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "fechaTexto",
                                        titulo: "Fecha",
                                        renderizar: (fila) => (
                                            <span className="text-xs font-medium text-texto">
                                                {fila.fechaTexto}
                                            </span>
                                        ),
                                    },
                                    {
                                        clave: "totalTexto",
                                        titulo: "Total",
                                        renderizar: (fila) => (
                                            <div>
                                                <p className="text-sm font-bold text-marca-oscura">
                                                    {fila.totalTexto}
                                                </p>
                                                <p className="text-[11px] text-texto-suave">
                                                    {fila.cantidadPasajeros}{" "}
                                                    {fila.cantidadPasajeros ===
                                                    1
                                                        ? "pasajero"
                                                        : "pasajeros"}
                                                </p>
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "pagosTexto",
                                        titulo: "Pagos",
                                        ocultarEnCelular: true,
                                        renderizar: (fila) => (
                                            <div className="text-xs">
                                                <p className="font-semibold text-texto">
                                                    Abonado:{" "}
                                                    {formatearMontoUsd(
                                                        fila.pagado,
                                                    )}
                                                </p>
                                                {fila.reintegro !== null ? (
                                                    <p className="text-[11px] font-semibold text-peligro">
                                                        Reintegro:{" "}
                                                        {formatearMontoUsd(
                                                            fila.reintegro,
                                                        )}
                                                    </p>
                                                ) : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        clave: "acciones",
                                        titulo: "Acciones",
                                        sinTituloEnCelular: true,
                                        renderizar: (fila) => {
                                            const puedeCancelar =
                                                reservaAdmiteCancelacion(fila);
                                            const puedeIrAResenar =
                                                fila.estado === "CONFIRMADA" &&
                                                fila.salida.estado ===
                                                    "FINALIZADA";

                                            return (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setIdReservaDetalle(
                                                                fila.idreserva,
                                                            )
                                                        }
                                                        aria-label={`Ver detalles de ${fila.nroReserva}`}
                                                        className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-texto transition hover:bg-fondo"
                                                    >
                                                        Ver detalle
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            idDescargandoComprobante ===
                                                            fila.idreserva
                                                        }
                                                        onClick={() =>
                                                            manejarDescargarComprobante(
                                                                fila,
                                                            )
                                                        }
                                                        aria-label={`Descargar comprobante de reserva ${fila.nroReserva}`}
                                                        className="rounded-control border border-borde bg-white px-2.5 py-1.5 text-xs font-semibold text-texto transition hover:bg-fondo disabled:opacity-50"
                                                    >
                                                        {idDescargandoComprobante ===
                                                        fila.idreserva
                                                            ? "Descargando..."
                                                            : "Comprobante"}
                                                    </button>

                                                    {puedeCancelar ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirModalCancelacion(
                                                                    fila.idreserva,
                                                                )
                                                            }
                                                            aria-label={`Cancelar reserva ${fila.nroReserva}`}
                                                            className="rounded-control border border-peligro/40 bg-peligro/10 px-2.5 py-1.5 text-xs font-bold text-peligro transition hover:bg-peligro hover:text-white"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    ) : null}

                                                    {puedeIrAResenar ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                navegar(
                                                                    `/mis-resenias?idsalida=${fila.salida.idsalida}`,
                                                                )
                                                            }
                                                            className="rounded-control border border-marca/40 bg-marca-suave px-2.5 py-1.5 text-xs font-bold text-marca-oscura transition hover:bg-marca hover:text-white"
                                                        >
                                                            ★ Reseñar
                                                        </button>
                                                    ) : null}
                                                </div>
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

            {/* MODAL DE DETALLE COMPLETO DE RESERVA (CU-31: GET /api/reservas/:idreserva) */}
            {idReservaDetalle !== null ? (
                <ModalDetalleReserva
                    idreserva={idReservaDetalle}
                    onCerrar={() => setIdReservaDetalle(null)}
                    onCancelar={abrirModalCancelacion}
                />
            ) : null}

            {/* MODAL DE LIQUIDACIÓN PREVIA A CANCELAR (CU-32 PASO 1: GET /api/reservas/:idreserva/cancelacion) */}
            {idReservaACancelar !== null && !confirmacionFinalAbierta ? (
                <Modal
                    onCerrar={cerrarModalCancelacion}
                    etiquetaId="modal-liquidacion-titulo"
                    className="p-6"
                >
                        <div className="border-b border-borde pb-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-peligro">
                                Cancelar reserva
                            </p>
                            <h2
                                id="modal-liquidacion-titulo"
                                className="mt-1 text-xl font-bold text-navegacion"
                            >
                                Resumen de liquidación previa
                            </h2>
                            <p className="mt-1 text-xs text-texto-suave">
                                Revisá las condiciones de reintegro antes de
                                confirmar la cancelación definitiva.
                            </p>
                        </div>

                        <div className="mt-5 space-y-4">
                            {cargandoLiquidacion ? (
                                <EstadoListado estado="cargando" />
                            ) : errorLiquidacion || !liquidacionCancelacion ? (
                                <Alerta
                                    tipo="error"
                                    titulo="No es posible cancelar esta reserva"
                                >
                                    {objErrorLiquidacion instanceof Error
                                        ? objErrorLiquidacion.message
                                        : "No se pudo obtener la liquidación de cancelación."}
                                </Alerta>
                            ) : (
                                <form
                                    id="form-cancelar-reserva"
                                    onSubmit={handleSubmit(
                                        pasarAConfirmacionFinal,
                                    )}
                                    noValidate
                                    className="space-y-4"
                                >
                                    {liquidacionCancelacion.advertencia ? (
                                        <Alerta
                                            tipo="advertencia"
                                            titulo="Permisos ya emitidos ante la autoridad"
                                        >
                                            {liquidacionCancelacion.advertencia}
                                        </Alerta>
                                    ) : liquidacionCancelacion.montoAReintegrar <
                                      liquidacionCancelacion.importeAbonado ? (
                                        <Alerta
                                            tipo="advertencia"
                                            titulo="No corresponde reintegro"
                                        >
                                            {liquidacionCancelacion.condicionAplicada}.
                                            Los cupos volverán a estar disponibles.
                                        </Alerta>
                                    ) : (
                                        <Alerta
                                            tipo="informacion"
                                            titulo="Reintegro del 100% disponible"
                                        >
                                            Los permisos aún no fueron emitidos.
                                            Corresponde el reintegro total de lo
                                            abonado y los cupos volverán a estar
                                            disponibles.
                                        </Alerta>
                                    )}

                                    <div className="grid gap-3 rounded-control border border-borde bg-fondo/50 p-4 text-xs sm:grid-cols-2">
                                        <div>
                                            <p className="font-semibold text-texto-suave">
                                                N° de Reserva
                                            </p>
                                            <p className="mt-0.5 font-mono text-sm font-bold text-navegacion">
                                                {
                                                    liquidacionCancelacion.nroReserva
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-texto-suave">
                                                Importe abonado
                                            </p>
                                            <p className="mt-0.5 text-sm font-bold text-texto">
                                                {formatearMontoUsd(
                                                    liquidacionCancelacion.importeAbonado,
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-texto-suave">
                                                Monto a reintegrar
                                            </p>
                                            <p className="mt-0.5 text-sm font-bold text-marca-oscura">
                                                {formatearMontoUsd(
                                                    liquidacionCancelacion.montoAReintegrar,
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-texto-suave">
                                                Permisos emitidos / Cupos
                                            </p>
                                            <p className="mt-0.5 font-semibold text-texto">
                                                {liquidacionCancelacion.permisosEmitidos
                                                    ? "Emitidos · No vuelven a la venta"
                                                    : "No emitidos · Vuelven a la venta"}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="motivo-cancelacion"
                                            className="mb-1.5 block text-xs font-semibold text-texto"
                                        >
                                            Motivo de cancelación (opcional,
                                            máx. 300 caracteres)
                                        </label>
                                        <textarea
                                            id="motivo-cancelacion"
                                            rows={3}
                                            placeholder="Ej.: Cambio de fechas del viaje o imprevisto personal"
                                            {...register("motivo")}
                                            className="w-full rounded-control border border-borde bg-white p-3 text-xs text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        />
                                        {erroresCancelacion.motivo ? (
                                            <p
                                                role="alert"
                                                className="mt-1 text-xs text-peligro"
                                            >
                                                {
                                                    erroresCancelacion.motivo
                                                        .message
                                                }
                                            </p>
                                        ) : null}
                                    </div>
                                </form>
                            )}

                            {confirmarCancelacionMutacion.isError ? (
                                <Alerta tipo="error">
                                    {confirmarCancelacionMutacion.error.message}
                                </Alerta>
                            ) : null}
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t border-borde pt-4">
                            <Boton
                                variante="secundario"
                                onClick={cerrarModalCancelacion}
                            >
                                Volver sin cancelar
                            </Boton>
                            {liquidacionCancelacion ? (
                                <Boton
                                    type="submit"
                                    form="form-cancelar-reserva"
                                    variante="peligro"
                                >
                                    Continuar con la cancelación
                                </Boton>
                            ) : null}
                        </div>
                </Modal>
            ) : null}

            {/* DIÁLOGO DE CONFIRMACIÓN FINAL REUTILIZANDO DialogoConfirmacion.tsx (CU-32 PASO 2) */}
            <DialogoConfirmacion
                abierto={
                    confirmacionFinalAbierta &&
                    idReservaACancelar !== null &&
                    Boolean(liquidacionCancelacion)
                }
                titulo={`¿Confirmás la cancelación de la reserva ${liquidacionCancelacion?.nroReserva ?? ""}?`}
                descripcion={`Esta operación es irreversible. Se asentará la baja de la reserva con un reintegro de ${formatearMontoUsd(liquidacionCancelacion?.montoAReintegrar ?? 0)} y se enviará la constancia a tu correo electrónico.`}
                textoConfirmar="Sí, cancelar reserva"
                textoCancelar="Volver atrás"
                cargando={confirmarCancelacionMutacion.isPending}
                onConfirmar={ejecutarCancelacionConfirmada}
                onCancelar={() => setConfirmacionFinalAbierta(false)}
            />
        </section>
    );
}

export default MisReservasPage;
