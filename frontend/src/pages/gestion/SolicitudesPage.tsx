import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarSolicitudesPendientes,
  consultarOpcionesSolicitud,
  resolverSolicitud,
  MOTIVOS_RECHAZO_FRECUENTES,
  type SolicitudPendiente,
} from "../../services/solicitudService";
import Tabla from "../../components/Tabla";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Alerta from "../../components/Alerta";

const POR_PAGINA = 6;

function esGarantiaEstablecimiento(tipoGarantia: string): boolean {
  return tipoGarantia.toUpperCase().includes("ESTABLECIMIENTO");
}

function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface ModalResolucionProps {
  solicitud: SolicitudPendiente;
  onCerrar: () => void;
  onResuelta: (mensajeExito: string) => void;
}

function ModalResolucionSolicitud({ solicitud, onCerrar, onResuelta }: ModalResolucionProps) {
  const [servicioSeleccionadoId, setServicioSeleccionadoId] = useState<number | null>(null);
  const [resolucion, setResolucion] = useState<"ACEPTADA" | "RECHAZADA">("ACEPTADA");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const {
    data: opciones,
    isLoading,
    error: errorOpciones,
  } = useQuery({
    queryKey: ["solicitudes", solicitud.idsolicitud, "opciones"],
    queryFn: () => consultarOpcionesSolicitud(solicitud.idsolicitud),
    retry: false,
  });

  // Selección efectiva: el elegido por el admin o el primer hotel compatible disponible
  const servicioEfectivoId =
    servicioSeleccionadoId ?? opciones?.opcionesContacto[0]?.servicioId ?? null;

  const mutacionResolver = useMutation({
    mutationFn: () => {
      if (!servicioEfectivoId) {
        throw new Error("Seleccioná un hotel compatible para registrar la respuesta.");
      }
      if (resolucion === "RECHAZADA" && !motivoRechazo.trim()) {
        throw new Error("Indicá el motivo del rechazo informado por el proveedor.");
      }
      return resolverSolicitud(solicitud.idsolicitud, {
        servicioId: servicioEfectivoId,
        resolucion,
        ...(resolucion === "RECHAZADA" ? { motivo: motivoRechazo.trim() } : {}),
      });
    },
    onSuccess: (respuesta) => {
      if (resolucion === "ACEPTADA") {
        const restantes = respuesta.solicitudesPendientesRestantesEnSalida ?? 0;
        const extra =
          restantes === 0
            ? " ¡No quedan solicitudes pendientes en esta salida (lista para consolidar)!"
            : ` Quedan ${restantes} solicitud(es) pendiente(s) en la salida.`;
        onResuelta(`${respuesta.mensaje}${extra}`);
      } else {
        onResuelta(
          `${respuesta.mensaje} (Nueva solicitud #${respuesta.nuevaSolicitudId ?? ""} lista para contactar otro hotel compatible).`,
        );
      }
    },
  });

  const manejarConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);
    if (!servicioEfectivoId) {
      setErrorValidacion("Seleccioná un establecimiento compatible de la lista.");
      return;
    }
    if (resolucion === "RECHAZADA" && !motivoRechazo.trim()) {
      setErrorValidacion("El motivo es obligatorio cuando la solicitud es rechazada.");
      return;
    }
    mutacionResolver.mutate();
  };

  const esReintento = solicitud.nroSolicitud.endsWith("-R");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-solicitud"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl my-8">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="titulo-modal-solicitud" className="text-lg font-semibold text-texto">
                Resolver solicitud {solicitud.nroSolicitud}
              </h2>
              {esReintento && (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Reintento automático
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-texto-suave">
              CU-34 · Contactá a un establecimiento compatible con la garantía del paquete y
              registrá su confirmación o rechazo.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-texto-suave hover:bg-slate-100 hover:text-texto"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Resumen de la reserva y garantía */}
        <div className="mb-5 rounded-xl border border-borde bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <span className="block text-texto-suave">Reserva / Cliente</span>
              <span className="font-semibold text-texto">
                {solicitud.reserva.nroReserva} · {solicitud.reserva.cliente.nroCliente}
              </span>
            </div>
            <div>
              <span className="block text-texto-suave">Salida planificada</span>
              <span className="font-semibold text-texto">
                {solicitud.reserva.salida.nroSalida} (
                {formatearFechaCorta(solicitud.reserva.salida.fechaInicio)})
              </span>
            </div>
            <div>
              <span className="block text-texto-suave">Paquete turístico</span>
              <span className="font-semibold text-texto">
                {solicitud.reserva.salida.paquete.nombrePaquete}
              </span>
            </div>
            <div>
              <span className="block text-texto-suave">Plazas requeridas</span>
              <span className="font-semibold text-primario">
                {solicitud.cantidadPlazas}{" "}
                {solicitud.cantidadPlazas === 1 ? "plaza" : "plazas"}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
            <span className="text-xs font-medium text-texto-suave">Criterios garantizados:</span>
            {esGarantiaEstablecimiento(solicitud.garantia.tipoGarantia) && (
              <span className="inline-flex items-center rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-medium text-primario">
                🏨 Hotel garantizado
                {solicitud.garantia.establecimiento ? `: ${solicitud.garantia.establecimiento}` : ""}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-medium text-primario">
              📍 Localidad:{" "}
              {opciones?.criteriosGarantizados.localidad ??
                solicitud.garantia.localidad ??
                "Sin especificar"}
            </span>
            <span className="inline-flex items-center rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-medium text-primario">
              ⭐ Categoría:{" "}
              {opciones?.criteriosGarantizados.categoria ??
                solicitud.garantia.categoria ??
                "Sin especificar"}
            </span>
            <span className="inline-flex items-center rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-medium text-primario">
              🛏️ Habitación:{" "}
              {opciones?.criteriosGarantizados.tipoHabitacion ??
                solicitud.garantia.tipoHabitacion ??
                "Sin especificar"}
            </span>
          </div>
        </div>

        {isLoading && (
          <div className="py-8 text-center text-sm text-texto-suave">
            Buscando establecimientos compatibles que no hayan rechazado previamente...
          </div>
        )}

        {errorOpciones instanceof Error && (
          <div className="space-y-4">
            <Alerta tipo="error">{errorOpciones.message}</Alerta>
            <div className="rounded-lg border border-borde bg-slate-50 p-3 text-xs text-texto-suave">
              Todos los alojamientos activos con esta categoría, localidad y tipo de habitación ya
              registraron un rechazo para esta reserva, o el paquete no posee criterios genéricos.
            </div>
            <div className="flex justify-end">
              <Boton variante="secundario" onClick={onCerrar}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}

        {opciones && !isLoading && (
          <form onSubmit={manejarConfirmar} className="space-y-5">
            {(errorValidacion || mutacionResolver.error instanceof Error) && (
              <Alerta tipo="error">
                {errorValidacion ?? (mutacionResolver.error as Error).message}
              </Alerta>
            )}

            {/* Paso 1: Elegir hotel compatible */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-texto">
                1. Seleccioná el establecimiento contactado ({opciones.opcionesContacto.length}{" "}
                {opciones.opcionesContacto.length === 1 ? "disponible" : "disponibles"})
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {opciones.opcionesContacto.map((op) => {
                  const activo = servicioEfectivoId === op.servicioId;
                  return (
                    <button
                      key={op.servicioId}
                      type="button"
                      onClick={() => setServicioSeleccionadoId(op.servicioId)}
                      className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                        activo
                          ? "border-primario bg-marca-suave/50 ring-1 ring-primario"
                          : "border-borde bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-texto">{op.hotel}</span>
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                            activo
                              ? "border-primario bg-primario text-white"
                              : "border-borde bg-white"
                          }`}
                        >
                          {activo ? "✓" : ""}
                        </span>
                      </div>
                      <span className="mt-1 text-xs text-texto-suave">
                        Proveedor: <strong className="text-texto">{op.proveedor}</strong>
                      </span>
                      <span className="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] text-texto-suave">
                        Canal: {op.canalContacto}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paso 2: Respuesta del proveedor */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-texto">
                2. Respuesta del proveedor de alojamiento
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setResolucion("ACEPTADA");
                    setErrorValidacion(null);
                  }}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    resolucion === "ACEPTADA"
                      ? "border-exito bg-green-50 ring-1 ring-exito"
                      : "border-borde bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-texto">
                    ✓ Confirmar aceptación (ACEPTADA)
                  </div>
                  <p className="mt-1 text-xs text-texto-suave">
                    El hotel confirma las {solicitud.cantidadPlazas} plaza(s). La solicitud pasa a
                    CONFIRMADA y se notifica al titular de la reserva.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResolucion("RECHAZADA");
                    setErrorValidacion(null);
                  }}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    resolucion === "RECHAZADA"
                      ? "border-peligro bg-red-50 ring-1 ring-peligro"
                      : "border-borde bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-texto">
                    ✕ Registrar rechazo (RECHAZADA)
                  </div>
                  <p className="mt-1 text-xs text-texto-suave">
                    El hotel no tiene cupo. Se excluye este hotel y se crea automáticamente una
                    nueva solicitud pendiente ({solicitud.nroSolicitud}-R).
                  </p>
                </button>
              </div>
            </div>

            {/* Motivo del rechazo con sugerencias en 1 clic */}
            {resolucion === "RECHAZADA" && (
              <div className="rounded-xl border border-borde bg-slate-50 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="motivo-rechazo" className="text-xs font-semibold text-texto">
                    Motivo del rechazo (obligatorio)
                  </label>
                  <span className="text-[11px] text-texto-suave">
                    Atajos rápidos para no tipear:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MOTIVOS_RECHAZO_FRECUENTES.map((sugerencia) => (
                    <button
                      key={sugerencia}
                      type="button"
                      onClick={() => setMotivoRechazo(sugerencia)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        motivoRechazo === sugerencia
                          ? "border-primario bg-primario text-white font-medium"
                          : "border-borde bg-white text-texto-suave hover:bg-slate-100 hover:text-texto"
                      }`}
                    >
                      {sugerencia}
                    </button>
                  ))}
                </div>
                <textarea
                  id="motivo-rechazo"
                  rows={2}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Describí el motivo informado por el proveedor..."
                  className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton
                type="button"
                variante="secundario"
                onClick={onCerrar}
                disabled={mutacionResolver.isPending}
              >
                Cancelar
              </Boton>
              <Boton
                type="submit"
                variante={resolucion === "RECHAZADA" ? "peligro" : "principal"}
                cargando={mutacionResolver.isPending}
              >
                {resolucion === "ACEPTADA"
                  ? "Confirmar alojamiento"
                  : "Registrar rechazo y generar reintento"}
              </Boton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function SolicitudesPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [solicitudEnGestion, setSolicitudEnGestion] = useState<SolicitudPendiente | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const {
    data: solicitudes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["solicitudes"],
    queryFn: listarSolicitudesPendientes,
  });

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (!q) return true;
      return (
        s.nroSolicitud.toLowerCase().includes(q) ||
        s.reserva.nroReserva.toLowerCase().includes(q) ||
        s.reserva.cliente.nroCliente.toLowerCase().includes(q) ||
        s.reserva.salida.nroSalida.toLowerCase().includes(q) ||
        s.reserva.salida.paquete.nombrePaquete.toLowerCase().includes(q)
      );
    });
  }, [solicitudes, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const cantidadReintentos = solicitudes.filter((s) => s.nroSolicitud.endsWith("-R")).length;
  const totalPlazasPendientes = solicitudes.reduce((acc, s) => acc + s.cantidadPlazas, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto">Solicitudes de Alojamiento</h1>
          <p className="text-sm text-texto-suave">
            Consultá las solicitudes pendientes generadas por reservas a solicitud y confirmá o
            reintentá su asignación hotelera (CU-33 y CU-34).
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen rápido */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-borde bg-white p-4">
          <div className="text-xs font-medium text-texto-suave">Solicitudes pendientes</div>
          <div className="mt-1 text-2xl font-bold text-texto">{solicitudes.length}</div>
          <div className="mt-0.5 text-xs text-texto-suave">
            Requieren confirmación con el proveedor hotelero
          </div>
        </div>
        <div className="rounded-xl border border-borde bg-white p-4">
          <div className="text-xs font-medium text-texto-suave">En reintento automático (-R)</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{cantidadReintentos}</div>
          <div className="mt-0.5 text-xs text-texto-suave">
            Rechazadas previamente por al menos un hotel
          </div>
        </div>
        <div className="rounded-xl border border-borde bg-white p-4">
          <div className="text-xs font-medium text-texto-suave">Plazas totales a confirmar</div>
          <div className="mt-1 text-2xl font-bold text-primario">{totalPlazasPendientes}</div>
          <div className="mt-0.5 text-xs text-texto-suave">
            Suma de plazas de todas las solicitudes activas
          </div>
        </div>
      </div>

      {mensajeExito && (
        <Alerta tipo="exito" titulo="Resolución procesada">
          {mensajeExito}
        </Alerta>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nro. de solicitud, reserva, cliente, salida o paquete..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          className="w-full max-w-md rounded-lg border border-borde bg-white px-3 py-2 text-sm"
        />
        <span className="text-xs text-texto-suave">
          Mostrando {filtradas.length} de {solicitudes.length} solicitudes pendientes
        </span>
      </div>

      {isLoading ? (
        <EstadoListado estado="cargando" />
      ) : error instanceof Error ? (
        <EstadoListado estado="error" mensaje={error.message} />
      ) : filtradas.length === 0 ? (
        <EstadoListado
          estado="vacio"
          mensaje="No hay solicitudes de alojamiento pendientes en este momento."
        />
      ) : (
        <>
          <Tabla
            filas={paginadas}
            columnas={[
              {
                clave: "nroSolicitud",
                titulo: "Solicitud",
                renderizar: (s) => {
                  const esReintento = s.nroSolicitud.endsWith("-R");
                  return (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-primario">
                          {s.nroSolicitud}
                        </span>
                        {esReintento && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Reintento
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-texto-suave">
                        {s.cantidadPlazas} {s.cantidadPlazas === 1 ? "plaza" : "plazas"}
                      </div>
                    </div>
                  );
                },
              },
              {
                clave: "reserva",
                titulo: "Reserva y Cliente",
                renderizar: (s) => (
                  <div>
                    <div className="font-medium text-texto">{s.reserva.nroReserva}</div>
                    <div className="text-xs text-texto-suave">
                      Cliente: {s.reserva.cliente.nroCliente} · {s.reserva.cantidadPasajeros}{" "}
                      pasajero(s)
                    </div>
                  </div>
                ),
              },
              {
                clave: "idreserva",
                titulo: "Salida y Paquete",
                renderizar: (s) => (
                  <div>
                    <div className="font-medium text-texto">
                      {s.reserva.salida.nroSalida} · {s.reserva.salida.paquete.nombrePaquete}
                    </div>
                    <div className="text-xs text-texto-suave">
                      Inicio: {formatearFechaCorta(s.reserva.salida.fechaInicio)}
                    </div>
                  </div>
                ),
              },
              {
                clave: "idservicio",
                titulo: "Garantía de alojamiento",
                renderizar: (s) => {
                  const g = s.garantia;
                  if (esGarantiaEstablecimiento(g.tipoGarantia)) {
                    return (
                      <span className="inline-flex rounded-full bg-marca-suave px-2 py-0.5 text-xs font-medium text-primario">
                        {g.establecimiento ?? "Hotel garantizado"}
                      </span>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex rounded-full bg-marca-suave px-2 py-0.5 text-xs font-medium text-primario">
                        {g.localidad ?? "Sin especificar"}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-texto">
                        {g.categoria ?? "Sin especificar"}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-texto">
                        Hab. {g.tipoHabitacion ?? "Sin especificar"}
                      </span>
                    </div>
                  );
                },
              },
              {
                clave: "estado",
                titulo: "Estado",
                renderizar: (s) => (
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    {s.estado}
                  </span>
                ),
              },
              {
                clave: "id",
                titulo: "Acción",
                renderizar: (s) => (
                  <Boton
                    variante="principal"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => {
                      setMensajeExito(null);
                      setSolicitudEnGestion(s);
                    }}
                  >
                    Gestionar resolución
                  </Boton>
                ),
              },
            ]}
          />
          <Paginacion
            paginaActual={paginaSegura}
            totalPaginas={totalPaginas}
            onCambiarPagina={setPagina}
          />
        </>
      )}

      {solicitudEnGestion && (
        <ModalResolucionSolicitud
          key={solicitudEnGestion.idsolicitud}
          solicitud={solicitudEnGestion}
          onCerrar={() => setSolicitudEnGestion(null)}
          onResuelta={(msg) => {
            setSolicitudEnGestion(null);
            setMensajeExito(msg);
            queryClient.invalidateQueries({ queryKey: ["solicitudes"] });
          }}
        />
      )}
    </div>
  );
}

export default SolicitudesPage;
