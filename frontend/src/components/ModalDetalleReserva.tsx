import Boton from "./Boton";
import EstadoListado from "./EstadoListado";
import Modal from "./Modal";
import {
    estilosEstadoReserva,
    etiquetaEstadoReserva,
    etiquetaEstadoSalidaCliente,
    formatearFechaUtcCorta,
    formatearMontoUsd,
    formatearRangoFechasUtc,
    reservaAdmiteCancelacion,
    textoAlojamiento,
    useDetalleMiReserva,
} from "../services/clientePortalService";

type Props = {
    idreserva: number;
    onCerrar: () => void;
    // Solo el cliente cancela desde acá; sin esto no se muestra el botón
    onCancelar?: (idreserva: number) => void;
};

/** Detalle completo de una reserva (CU-31: GET /api/reservas/:idreserva). Lo usan el cliente y el administrador. */
function ModalDetalleReserva({ idreserva, onCerrar, onCancelar }: Props) {
    const {
        data: detalleReserva,
        isLoading: cargandoDetalle,
        isError: errorDetalle,
        error: objErrorDetalle,
    } = useDetalleMiReserva(idreserva);

    return (
        <Modal onCerrar={onCerrar} etiquetaId="modal-detalle-reserva-titulo" tamano="lg" className="p-6">
            <div className="flex items-start justify-between gap-4 border-b border-borde pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Detalle de reserva
                    </p>
                    <h2
                        id="modal-detalle-reserva-titulo"
                        className="text-xl font-bold text-navegacion"
                    >
                        {detalleReserva
                            ? `Reserva ${detalleReserva.nroReserva}`
                            : "Reserva"}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={() => onCerrar()}
                    className="rounded-control border border-borde px-2.5 py-1 text-xs font-semibold text-texto-suave hover:bg-fondo"
                >
                    ✕ Cerrar
                </button>
            </div>

            <div className="mt-5 space-y-5">
                {cargandoDetalle ? (
                    <EstadoListado estado="cargando" />
                ) : errorDetalle || !detalleReserva ? (
                    <EstadoListado
                        estado="error"
                        mensaje={
                            objErrorDetalle instanceof Error
                                ? objErrorDetalle.message
                                : "No se pudo cargar el detalle de la reserva."
                        }
                    />
                ) : (
                    <>
                        {/* RESUMEN GENERAL */}
                        <div className="grid gap-3 rounded-control border border-borde bg-fondo/50 p-4 sm:grid-cols-5">
                            <div>
                                <p className="text-[11px] font-semibold uppercase text-texto-suave">
                                    Estado reserva
                                </p>
                                <span
                                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${estilosEstadoReserva(
                                        detalleReserva.estado,
                                    )}`}
                                >
                                    {etiquetaEstadoReserva(
                                        detalleReserva.estado,
                                    )}
                                </span>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase text-texto-suave">
                                    Alojamiento
                                </p>
                                <p className="mt-1 text-xs font-bold text-navegacion">
                                    {textoAlojamiento(detalleReserva.estadoAlojamiento)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase text-texto-suave">
                                    Pasajeros
                                </p>
                                <p className="mt-1 text-sm font-bold text-navegacion">
                                    {detalleReserva.cantidadPasajeros}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase text-texto-suave">
                                    Precio congelado
                                </p>
                                <p className="mt-1 text-sm font-bold text-marca-oscura">
                                    {formatearMontoUsd(
                                        detalleReserva.precioCongelado,
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase text-texto-suave">
                                    Total pagado
                                </p>
                                <p className="mt-1 text-sm font-bold text-exito">
                                    {formatearMontoUsd(
                                        detalleReserva.pagado,
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* PAQUETE, SALIDA E ITINERARIO */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-control border border-borde p-4 text-xs space-y-1.5">
                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                    Paquete y salida
                                </p>
                                <p>
                                    <strong>Paquete:</strong>{" "}
                                    {
                                        detalleReserva.paquete
                                            .nombrePaquete
                                    }
                                </p>
                                <p>
                                    <strong>Salida:</strong>{" "}
                                    {etiquetaEstadoSalidaCliente(
                                        detalleReserva.salida
                                            .estado,
                                    )}
                                </p>
                                <p>
                                    <strong>Fechas:</strong>{" "}
                                    {formatearRangoFechasUtc(
                                        detalleReserva.salida
                                            .fechaInicio,
                                        detalleReserva.salida
                                            .fechaFin,
                                    )}
                                </p>
                                <p>
                                    <strong>Titular:</strong>{" "}
                                    {detalleReserva.titular.nombre}{" "}
                                    {
                                        detalleReserva.titular
                                            .apellido
                                    }{" "}
                                    ({detalleReserva.titular.email})
                                </p>
                                {detalleReserva.condicionesComerciales ? (
                                    <p className="pt-1 text-texto-suave">
                                        {
                                            detalleReserva.condicionesComerciales
                                        }
                                    </p>
                                ) : null}
                            </div>

                            <div className="rounded-control border border-borde p-4 text-xs space-y-2">
                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                    Itinerario:{" "}
                                    {
                                        detalleReserva.itinerario
                                            .nombreCircuito
                                    }{" "}
                                    (
                                    {
                                        detalleReserva.itinerario
                                            .duracionDias
                                    }{" "}
                                    días)
                                </p>
                                {detalleReserva.itinerario.etapas
                                    .length === 0 ? (
                                    <p className="text-texto-suave">
                                        Sin etapas registradas.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {detalleReserva.itinerario.etapas.map(
                                            (etapa) => (
                                                <li
                                                    key={
                                                        etapa.numeroOrden
                                                    }
                                                    className="rounded border border-borde bg-fondo/40 p-2"
                                                >
                                                    <p className="font-semibold text-navegacion">
                                                        Día{" "}
                                                        {
                                                            etapa.numeroOrden
                                                        }
                                                        :{" "}
                                                        {
                                                            etapa.puntoInicio
                                                        }{" "}
                                                        →{" "}
                                                        {
                                                            etapa.puntoFin
                                                        }
                                                    </p>
                                                    {etapa.campamentoPrevisto ? (
                                                        <p className="text-[11px] text-texto-suave">
                                                            Campamento:{" "}
                                                            {
                                                                etapa.campamentoPrevisto
                                                            }
                                                        </p>
                                                    ) : null}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* NÓMINA DE PASAJEROS Y PERMISOS */}
                        <div className="rounded-control border border-borde p-4 text-xs space-y-2">
                            <p className="font-bold uppercase tracking-wide text-navegacion">
                                Pasajeros y permisos ante la
                                autoridad ({detalleReserva.pasajeros.length})
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {detalleReserva.pasajeros.map(
                                    (pasajero) => {
                                        const permiso =
                                            detalleReserva.permisos.find(
                                                (perm) =>
                                                    perm.idpasajero ===
                                                    pasajero.idpasajero,
                                            );
                                        return (
                                            <div
                                                key={
                                                    pasajero.idpasajero
                                                }
                                                className="flex items-center justify-between rounded border border-borde bg-fondo/30 p-2.5"
                                            >
                                                <div>
                                                    <p className="font-bold text-navegacion">
                                                        {
                                                            pasajero.nombreCompleto
                                                        }
                                                    </p>
                                                    <p className="text-[11px] text-texto-suave">
                                                        Pasaporte:{" "}
                                                        <span className="font-mono">
                                                            {
                                                                pasajero.nroPasaporte
                                                            }
                                                        </span>{" "}
                                                        ·{" "}
                                                        {
                                                            pasajero.nacionalidad
                                                        }
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-bold text-marca-oscura">
                                                        {permiso
                                                            ? `${permiso.estadoTramite} (${permiso.nroPermiso})`
                                                            : "No emitido"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        </div>

                        {/* PAGOS, REEMBOLSOS Y SOLICITUDES DE ALOJAMIENTO */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-control border border-borde p-4 text-xs space-y-2">
                                <p className="font-bold uppercase tracking-wide text-navegacion">
                                    Pagos y reembolsos
                                </p>
                                {detalleReserva.pagos.length ===
                                0 ? (
                                    <p className="text-texto-suave">
                                        No hay transacciones de pago
                                        registradas.
                                    </p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {detalleReserva.pagos.map(
                                            (pago, idx) => (
                                                <li
                                                    key={
                                                        pago.idpago ??
                                                        idx
                                                    }
                                                    className="rounded border border-borde bg-fondo/30 p-2"
                                                >
                                                    <p className="font-semibold text-navegacion">
                                                        {formatearMontoUsd(
                                                            pago.monto,
                                                        )}{" "}
                                                        ·{" "}
                                                        {
                                                            pago.medioPago
                                                        }
                                                    </p>
                                                    <p className="font-mono text-[11px] text-texto-suave">
                                                        {
                                                            pago.nrotransaccion
                                                        }{" "}
                                                        ·{" "}
                                                        {formatearFechaUtcCorta(
                                                            pago.fechahora,
                                                        )}
                                                    </p>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                )}

                                {detalleReserva.reembolsos.length >
                                0 ? (
                                    <div className="mt-2 border-t border-borde pt-2 space-y-1">
                                        <p className="font-bold text-peligro">
                                            Reembolsos registrados:
                                        </p>
                                        {detalleReserva.reembolsos.map(
                                            (reemb) => (
                                                <div
                                                    key={
                                                        reemb.idreembolso
                                                    }
                                                    className="rounded border border-peligro/30 bg-peligro/5 p-2"
                                                >
                                                    <p className="font-bold text-peligro">
                                                        Reintegro:{" "}
                                                        {formatearMontoUsd(
                                                            reemb.montoReembolsado,
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-texto">
                                                        Motivo:{" "}
                                                        {
                                                            reemb.motivo
                                                        }
                                                    </p>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : null}
                            </div>

                        </div>
                    </>
                )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-borde pt-4">
                {onCancelar && detalleReserva &&
                reservaAdmiteCancelacion(detalleReserva) ? (
                    <Boton
                        variante="peligro"
                        onClick={() => {
                            onCerrar();
                            onCancelar(detalleReserva.idreserva);
                        }}
                    >
                        Solicitar cancelación
                    </Boton>
                ) : null}
                <Boton onClick={() => onCerrar()}>
                    Entendido
                </Boton>
            </div>
        </Modal>
    );
}

export default ModalDetalleReserva;
