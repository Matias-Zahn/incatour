import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import { solicitarApi } from "../../services/clienteApi";
import {
    estilosEstadoReserva,
    etiquetaEstadoReserva,
    etiquetaEstadoSalidaCliente,
    formatearFechaLocalCorta,
    formatearMontoUsd,
    formatearRangoFechasUtc,
    obtenerComprobanteMiReserva,
    type ReservaClienteResumen,
} from "../../services/clientePortalService";
import { descargarComprobantePdf } from "../../services/pdf";

const POR_PAGINA = 20;

type ReservaGestion = ReservaClienteResumen & {
    id: number;
    titular: { nombre: string; apellido: string; email: string };
};
type Filtros = { titular: string; pasajero: string; estado: string };

async function listarReservas(filtros: Filtros, pagina: number) {
    const parametros = new URLSearchParams({ limite: String(POR_PAGINA), pagina: String(pagina) });
    for (const [clave, valor] of Object.entries(filtros)) {
        if (valor.trim()) parametros.set(clave, valor.trim());
    }
    const res = await solicitarApi<{ data: ReservaGestion[]; total: number }>(`/reservas?${parametros}`);
    return { reservas: res.data.map((r) => ({ ...r, id: r.idreserva })), total: res.total };
}

const FILTROS_VACIOS: Filtros = { titular: "", pasajero: "", estado: "" };

function ReservasGestionPage() {
    const [borrador, setBorrador] = useState(FILTROS_VACIOS);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [pagina, setPagina] = useState(1);
    const [errorComprobante, setErrorComprobante] = useState<string | null>(null);

    const { data, isPending, error } = useQuery({
        queryKey: ["reservas-gestion", filtros, pagina],
        queryFn: () => listarReservas(filtros, pagina),
        placeholderData: keepPreviousData,
    });

    function aplicar(cambios: Partial<Filtros>) {
        const nuevos = { ...borrador, ...cambios };
        setBorrador(nuevos);
        setFiltros(nuevos);
        setPagina(1);
    }

    function buscar(evento: FormEvent) {
        evento.preventDefault();
        aplicar({});
    }

    async function descargarComprobante(idreserva: number) {
        try {
            setErrorComprobante(null);
            await descargarComprobantePdf(await obtenerComprobanteMiReserva(idreserva));
        } catch {
            setErrorComprobante("No se pudo generar el comprobante.");
        }
    }

    const total = data?.total ?? 0;
    const hayFiltros = Object.values(filtros).some(Boolean);

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-navegacion">Reservas y pagos</h1>
                <p className="mt-2 text-sm text-texto-suave">
                    Consultá todas las reservas, lo que se abonó y lo que se reintegró.
                </p>
            </header>

            <form onSubmit={buscar} className="flex flex-wrap items-end gap-3 rounded-tarjeta border border-borde bg-white p-4">
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Titular
                    <input
                        type="search"
                        value={borrador.titular}
                        onChange={(e) => setBorrador({ ...borrador, titular: e.target.value })}
                        placeholder="Nombre o correo"
                        className="rounded-control border border-borde px-3 py-2 text-sm font-normal text-texto"
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Pasajero
                    <input
                        type="search"
                        value={borrador.pasajero}
                        onChange={(e) => setBorrador({ ...borrador, pasajero: e.target.value })}
                        placeholder="Nombre o pasaporte"
                        className="rounded-control border border-borde px-3 py-2 text-sm font-normal text-texto"
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Estado
                    <select
                        value={borrador.estado}
                        onChange={(e) => aplicar({ estado: e.target.value })}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto"
                    >
                        <option value="">Todas</option>
                        <option value="CONFIRMADA">Confirmadas</option>
                        <option value="CANCELADA">Canceladas</option>
                    </select>
                </label>
                <Boton type="submit">Buscar</Boton>
                {hayFiltros ? (
                    <Boton type="button" variante="fantasma" onClick={() => aplicar(FILTROS_VACIOS)}>
                        Limpiar
                    </Boton>
                ) : null}
            </form>

            {errorComprobante ? <Alerta tipo="error">{errorComprobante}</Alerta> : null}

            {isPending ? (
                <EstadoListado estado="cargando" />
            ) : error instanceof Error ? (
                <EstadoListado estado="error" mensaje={error.message} />
            ) : total === 0 ? (
                <EstadoListado estado="vacio" mensaje="No se encontraron reservas con esos filtros." />
            ) : (
                <div>
                    <Tabla
                        filas={data?.reservas ?? []}
                        columnas={[
                            {
                                clave: "nroReserva",
                                titulo: "Reserva",
                                renderizar: (r) => (
                                    <div>
                                        <p className="font-mono text-xs font-bold text-navegacion">{r.nroReserva}</p>
                                        <p className="text-[11px] text-texto-suave">
                                            {formatearFechaLocalCorta(r.fechaRealizacion)}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "titular",
                                titulo: "Titular",
                                renderizar: (r) => (
                                    <div>
                                        <p className="text-sm font-semibold text-texto">
                                            {r.titular.nombre} {r.titular.apellido}
                                        </p>
                                        <p className="text-[11px] text-texto-suave">{r.titular.email}</p>
                                    </div>
                                ),
                            },
                            {
                                clave: "paquete",
                                titulo: "Paquete y salida",
                                renderizar: (r) => (
                                    <div>
                                        <p className="text-sm font-semibold text-texto">{r.paquete.nombrePaquete}</p>
                                        <p className="text-[11px] text-texto-suave">
                                            {r.salida.nroSalida} · {etiquetaEstadoSalidaCliente(r.salida.estado)}
                                        </p>
                                        <p className="text-[11px] text-texto-suave">
                                            {formatearRangoFechasUtc(r.salida.fechaInicio, r.salida.fechaFin)}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "cantidadPasajeros",
                                titulo: "Pasajeros",
                            },
                            {
                                clave: "pagado",
                                titulo: "Pagos",
                                renderizar: (r) => (
                                    <div className="text-xs">
                                        <p className="font-semibold text-texto">Abonado: {formatearMontoUsd(r.pagado)}</p>
                                        {r.reintegro !== null ? (
                                            <p className="font-semibold text-peligro">
                                                Reintegro: {formatearMontoUsd(r.reintegro)}
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado",
                                renderizar: (r) => (
                                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${estilosEstadoReserva(r.estado)}`}>
                                        {etiquetaEstadoReserva(r.estado)}
                                    </span>
                                ),
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                sinTituloEnCelular: true,
                                renderizar: (r) => (
                                    <Boton
                                        variante="secundario"
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => descargarComprobante(r.idreserva)}
                                    >
                                        Comprobante
                                    </Boton>
                                ),
                            },
                        ]}
                    />
                    <Paginacion
                        paginaActual={pagina}
                        totalPaginas={Math.max(1, Math.ceil(total / POR_PAGINA))}
                        total={total}
                        onCambiarPagina={setPagina}
                    />
                </div>
            )}
        </section>
    );
}

export default ReservasGestionPage;
