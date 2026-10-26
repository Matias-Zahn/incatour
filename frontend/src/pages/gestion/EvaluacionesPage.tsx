import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  consultarReseniasYEvaluaciones,
  consultarEvaluablesSalida,
  registrarEvaluacionSalida,
  listarSalidasParaEvaluacion,
  ETIQUETAS_PUNTAJE,
  COMENTARIOS_RAPIDOS_EVALUACION,
  type FiltrosConsultaResenias,
} from "../../services/evaluacionService";
import { usePaquetes } from "../../services/paqueteService";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Alerta from "../../components/Alerta";

// FE-50: las fechas sin hora (inicio y fin de la salida) van en UTC; los instantes (envío, evaluación), en hora local
function formatearFechaCorta(iso?: string, enUtc = true): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(enUtc && { timeZone: "UTC" }),
  });
}

function EstrellasPuntaje({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
      {"★".repeat(Math.max(1, Math.min(5, Math.round(valor))))}
      <span className="text-slate-300">
        {"★".repeat(Math.max(0, 5 - Math.round(valor)))}
      </span>
      <span className="ml-1 text-xs font-semibold text-texto">{valor}/5</span>
    </span>
  );
}

interface ModalEvaluarProps {
  idSalida: number;
  nroSalida: string;
  tipo: "PERSONAL" | "PROVEEDOR";
  idEvaluado: number;
  nombreEvaluado: string;
  subtitulo: string;
  onCerrar: () => void;
  onGuardada: (mensaje: string) => void;
}

function ModalCalificarEvaluado({
  idSalida,
  nroSalida,
  tipo,
  idEvaluado,
  nombreEvaluado,
  subtitulo,
  onCerrar,
  onGuardada,
}: ModalEvaluarProps) {
  const [puntaje, setPuntaje] = useState<number>(5);
  const [comentario, setComentario] = useState<string>("");

  const mutacion = useMutation({
    mutationFn: () =>
      registrarEvaluacionSalida(idSalida, {
        tipo,
        id: idEvaluado,
        puntaje,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      }),
    onSuccess: () => {
      onGuardada(
        `Evaluación de ${nombreEvaluado} (${puntaje} ★) registrada correctamente en la salida ${nroSalida}.`,
      );
    },
  });

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutacion.mutate();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-evaluar"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <span className="inline-flex rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-medium text-primario">
              Salida {nroSalida} · {tipo === "PERSONAL" ? "Personal operativo" : "Proveedor"}
            </span>
            <h2 id="titulo-modal-evaluar" className="mt-1.5 text-lg font-semibold text-texto">
              Evaluar a {nombreEvaluado}
            </h2>
            <p className="text-xs text-texto-suave">{subtitulo}</p>
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

        <form onSubmit={manejarSubmit} className="space-y-4">
          {mutacion.error instanceof Error && (
            <Alerta tipo="error">{mutacion.error.message}</Alerta>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold text-texto">
              Calificación de desempeño (1 a 5 estrellas)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((valor) => {
                const activo = puntaje === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setPuntaje(valor)}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-center transition-colors ${
                      activo
                        ? "border-primario bg-primario text-white shadow-sm"
                        : "border-borde bg-white text-texto hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base font-bold">{valor} ★</span>
                    <span
                      className={`mt-0.5 text-[10px] ${
                        activo ? "text-white/90" : "text-texto-suave"
                      }`}
                    >
                      {ETIQUETAS_PUNTAJE[valor]?.split("·")[1]?.trim()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="comentario-evaluacion" className="text-xs font-semibold text-texto">
                Observaciones sobre el desempeño (opcional)
              </label>
              <span className="text-[11px] text-texto-suave">Atajos en 1 clic:</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COMENTARIOS_RAPIDOS_EVALUACION.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => setComentario(sugerencia)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    comentario === sugerencia
                      ? "border-primario bg-marca-suave font-medium text-primario"
                      : "border-borde bg-white text-texto-suave hover:bg-slate-100 hover:text-texto"
                  }`}
                >
                  {sugerencia}
                </button>
              ))}
            </div>
            <textarea
              id="comentario-evaluacion"
              rows={3}
              maxLength={500}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ej: Muy buena coordinación y trato con los pasajeros..."
              className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton
              type="button"
              variante="secundario"
              onClick={onCerrar}
              disabled={mutacion.isPending}
            >
              Cancelar
            </Boton>
            <Boton type="submit" cargando={mutacion.isPending}>
              Guardar evaluación ({puntaje} ★)
            </Boton>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EvaluacionesPage() {
  const queryClient = useQueryClient();
  const [modoVista, setModoVista] = useState<"consultar" | "evaluar">("consultar");
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtros de CU-43
  const [idPaqueteFiltro, setIdPaqueteFiltro] = useState<number | undefined>(undefined);
  const [idSalidaFiltro, setIdSalidaFiltro] = useState<number | undefined>(undefined);
  const [valoracionMin, setValoracionMin] = useState<number | undefined>(undefined);
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");

  // Salida seleccionada para CU-42
  const [idSalidaEvaluar, setIdSalidaEvaluar] = useState<number | null>(null);
  const [evaluadoEnModal, setEvaluadoEnModal] = useState<{
    tipo: "PERSONAL" | "PROVEEDOR";
    id: number;
    nombre: string;
    subtitulo: string;
  } | null>(null);

  const { data: paquetes = [] } = usePaquetes({ estado: "TODOS" });

  const { data: salidas = [] } = useQuery({
    queryKey: ["salidas", "selector-evaluaciones"],
    queryFn: listarSalidasParaEvaluacion,
  });

  const salidasFinalizadas = salidas.filter((s) => s.estado === "FINALIZADA");
  const idSalidaEvaluarEfectiva =
    idSalidaEvaluar ?? salidasFinalizadas[0]?.idsalida ?? null;

  const filtrosActivos: FiltrosConsultaResenias = {
    ...(idPaqueteFiltro ? { idpaquete: idPaqueteFiltro } : {}),
    ...(idSalidaFiltro ? { idsalida: idSalidaFiltro } : {}),
    ...(valoracionMin ? { valoracionMin } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
  };

  const {
    data: consulta,
    isLoading: cargandoConsulta,
    error: errorConsulta,
    refetch: reintentarConsulta,
  } = useQuery({
    queryKey: ["resenias", filtrosActivos],
    queryFn: () => consultarReseniasYEvaluaciones(filtrosActivos),
  });

  const {
    data: evaluablesSalida,
    isLoading: cargandoEvaluables,
    error: errorEvaluables,
    refetch: reintentarEvaluables,
  } = useQuery({
    queryKey: ["salidas", idSalidaEvaluarEfectiva, "evaluaciones"],
    queryFn: () => consultarEvaluablesSalida(idSalidaEvaluarEfectiva!),
    enabled: modoVista === "evaluar" && idSalidaEvaluarEfectiva !== null,
  });

  const limpiarFiltros = () => {
    setIdPaqueteFiltro(undefined);
    setIdSalidaFiltro(undefined);
    setValoracionMin(undefined);
    setFechaDesde("");
    setFechaHasta("");
  };

  const totalEvaluacionesInternas =
    (consulta?.evaluaciones.personal.length ?? 0) +
    (consulta?.evaluaciones.proveedores.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Selector superior entre CU-43 y CU-42 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borde pb-4">
        <div>
          <h1 className="text-2xl font-bold text-texto">Reseñas y Evaluaciones</h1>
          <p className="text-sm text-texto-suave">
            Consultá las reseñas de clientes y evaluaciones históricas (CU-43) o calificá al
            personal y proveedores de salidas finalizadas (CU-42).
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-borde bg-white p-1">
          <button
            type="button"
            onClick={() => setModoVista("consultar")}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              modoVista === "consultar"
                ? "bg-primario text-white shadow-sm"
                : "text-texto-suave hover:bg-slate-100 hover:text-texto"
            }`}
          >
            📊 Consultar reseñas y evaluaciones (CU-43)
          </button>
          <button
            type="button"
            onClick={() => setModoVista("evaluar")}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              modoVista === "evaluar"
                ? "bg-primario text-white shadow-sm"
                : "text-texto-suave hover:bg-slate-100 hover:text-texto"
            }`}
          >
            ⭐ Evaluar salida finalizada (CU-42)
          </button>
        </div>
      </div>

      {mensajeExito && (
        <Alerta tipo="exito" titulo="Evaluación guardada">
          {mensajeExito}
        </Alerta>
      )}

      {/* ==================== MODO 1: CONSULTAR RESEÑAS Y EVALUACIONES (CU-43) ==================== */}
      {modoVista === "consultar" && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-borde bg-white p-4">
              <div className="text-xs font-medium text-texto-suave">
                Promedio de reseñas de clientes
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-texto">
                  {consulta?.resumen.promedio !== null && consulta?.resumen.promedio !== undefined
                    ? `${consulta.resumen.promedio} ★`
                    : "Sin reseñas"}
                </span>
                <span className="text-xs text-texto-suave">
                  ({consulta?.resumen.cantidad ?? 0} reseña(s))
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-borde bg-white p-4">
              <div className="text-xs font-medium text-texto-suave">
                Evaluaciones a personal operativo
              </div>
              <div className="mt-1 text-2xl font-bold text-primario">
                {consulta?.evaluaciones.personal.length ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-texto-suave">
                Guías y porteadores calificados por administración
              </div>
            </div>
            <div className="rounded-xl border border-borde bg-white p-4">
              <div className="text-xs font-medium text-texto-suave">
                Evaluaciones a proveedores
              </div>
              <div className="mt-1 text-2xl font-bold text-primario">
                {consulta?.evaluaciones.proveedores.length ?? 0}
              </div>
              <div className="mt-0.5 text-xs text-texto-suave">
                Operadores de alojamiento, transporte, tren y equipos
              </div>
            </div>
          </div>

          {/* Barra de filtros visuales (sin pedir IDs manuales) */}
          <div className="rounded-xl border border-borde bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                Filtros combinados (aplican a reseñas y evaluaciones)
              </span>
              {(idPaqueteFiltro || idSalidaFiltro || valoracionMin || fechaDesde || fechaHasta) && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="text-xs font-medium text-primario hover:underline"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filtro-paquete" className="mb-1 block text-xs font-medium text-texto">
                  Paquete turístico
                </label>
                <select
                  id="filtro-paquete"
                  value={idPaqueteFiltro ?? ""}
                  onChange={(e) =>
                    setIdPaqueteFiltro(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full rounded-lg border border-borde bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">Todos los paquetes</option>
                  {paquetes.map((p) => (
                    <option key={p.idpaquete} value={p.idpaquete}>
                      {p.nroPaquete} · {p.nombrePaquete}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filtro-salida" className="mb-1 block text-xs font-medium text-texto">
                  Salida específica
                </label>
                <select
                  id="filtro-salida"
                  value={idSalidaFiltro ?? ""}
                  onChange={(e) =>
                    setIdSalidaFiltro(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full rounded-lg border border-borde bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">Todas las salidas</option>
                  {salidas.map((s) => (
                    <option key={s.idsalida} value={s.idsalida}>
                      {s.nroSalida} ({s.estado})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filtro-desde" className="mb-1 block text-xs font-medium text-texto">
                  Fecha desde
                </label>
                <input
                  id="filtro-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full rounded-lg border border-borde bg-white px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="filtro-hasta" className="mb-1 block text-xs font-medium text-texto">
                  Fecha hasta
                </label>
                <input
                  id="filtro-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full rounded-lg border border-borde bg-white px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-texto-suave">Puntaje mínimo:</span>
              {[
                { label: "Todos", val: undefined },
                { label: "3+ ★", val: 3 },
                { label: "4+ ★", val: 4 },
                { label: "Solo 5 ★", val: 5 },
              ].map((op) => {
                const activo = valoracionMin === op.val;
                return (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => setValoracionMin(op.val)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activo
                        ? "border-primario bg-primario text-white"
                        : "border-borde bg-white text-texto-suave hover:bg-slate-100 hover:text-texto"
                    }`}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          {cargandoConsulta ? (
            <EstadoListado estado="cargando" />
          ) : errorConsulta instanceof Error ? (
            <div className="space-y-3">
              <EstadoListado estado="error" mensaje={errorConsulta.message} />
              <div className="flex justify-center">
                <Boton variante="secundario" onClick={() => reintentarConsulta()}>
                  Reintentar consulta
                </Boton>
              </div>
            </div>
          ) : (consulta?.resenias.length ?? 0) === 0 && totalEvaluacionesInternas === 0 ? (
            <EstadoListado
              estado="vacio"
              mensaje="No se encontraron reseñas ni evaluaciones con los filtros seleccionados."
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Columna 1: Reseñas de Clientes */}
              <div className="rounded-xl border border-borde bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-borde pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-texto">
                      Reseñas publicadas por clientes
                    </h2>
                    <p className="text-xs text-texto-suave">
                      Valoraciones de pasajeros que completaron su experiencia
                    </p>
                  </div>
                  <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-primario">
                    {consulta?.resenias.length ?? 0}
                  </span>
                </div>

                {consulta?.resenias.length === 0 ? (
                  <p className="py-6 text-center text-xs text-texto-suave">
                    No hay reseñas de clientes para este filtro.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {consulta?.resenias.map((r) => (
                      <div
                        key={`${r.idcliente}-${r.idsalida}`}
                        className="rounded-lg border border-borde bg-slate-50 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold text-texto">
                              {r.cliente.usuario.nombre} {r.cliente.usuario.apellido}
                            </span>
                            <span className="ml-2 text-xs text-texto-suave">
                              · {r.salida.nroSalida} ({r.salida.paquete.nombrePaquete})
                            </span>
                          </div>
                          <EstrellasPuntaje valor={r.valoracion} />
                        </div>
                        {r.comentario && (
                          <p className="mt-2 text-xs text-texto leading-relaxed">
                            “{r.comentario}”
                          </p>
                        )}
                        <div className="mt-2 text-[11px] text-texto-suave">
                          Enviada el {formatearFechaCorta(r.fechaEnvio, false)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna 2: Evaluaciones Internas (Personal y Proveedores) */}
              <div className="rounded-xl border border-borde bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-borde pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-texto">
                      Evaluaciones internas del administrador (CU-42)
                    </h2>
                    <p className="text-xs text-texto-suave">
                      Desempeño de guías, porteadores y proveedores en salidas finalizadas
                    </p>
                  </div>
                  <span className="rounded-full bg-marca-suave px-2.5 py-0.5 text-xs font-semibold text-primario">
                    {totalEvaluacionesInternas}
                  </span>
                </div>

                {totalEvaluacionesInternas === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-xs text-texto-suave">
                      Aún no hay evaluaciones registradas para este filtro.
                    </p>
                    <Boton
                      variante="secundario"
                      className="text-xs px-3 py-1.5"
                      onClick={() => setModoVista("evaluar")}
                    >
                      Ir a evaluar salida finalizada
                    </Boton>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consulta?.evaluaciones.personal.map((ev) => (
                      <div
                        key={`pers-${ev.idsalida}-${ev.idpersonal}`}
                        className="rounded-lg border border-borde bg-slate-50 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-marca-suave px-2 py-0.5 text-[10px] font-semibold text-primario">
                              {ev.personal.rol}
                            </span>
                            <span className="text-sm font-semibold text-texto">
                              {ev.personal.nombreCompleto}
                            </span>
                            <span className="text-xs text-texto-suave">
                              · {ev.salida.nroSalida}
                            </span>
                          </div>
                          <EstrellasPuntaje valor={ev.puntaje} />
                        </div>
                        {ev.comentario && (
                          <p className="mt-1.5 text-xs text-texto">{ev.comentario}</p>
                        )}
                        <div className="mt-1.5 text-[11px] text-texto-suave">
                          Evaluado el {formatearFechaCorta(ev.fechaEvaluacion, false)}
                        </div>
                      </div>
                    ))}

                    {consulta?.evaluaciones.proveedores.map((ev) => (
                      <div
                        key={`prov-${ev.idsalida}-${ev.idproveedor}`}
                        className="rounded-lg border border-borde bg-slate-50 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-exito">
                              Proveedor
                            </span>
                            <span className="text-sm font-semibold text-texto">
                              {ev.proveedor.razonSocial}
                            </span>
                            <span className="text-xs text-texto-suave">
                              · {ev.salida.nroSalida}
                            </span>
                          </div>
                          <EstrellasPuntaje valor={ev.puntaje} />
                        </div>
                        {ev.comentario && (
                          <p className="mt-1.5 text-xs text-texto">{ev.comentario}</p>
                        )}
                        <div className="mt-1.5 text-[11px] text-texto-suave">
                          Evaluado el {formatearFechaCorta(ev.fechaEvaluacion, false)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODO 2: EVALUAR SALIDA FINALIZADA (CU-42) ==================== */}
      {modoVista === "evaluar" && (
        <div className="space-y-6">
          {/* Selector visual de salidas finalizadas */}
          <div className="rounded-xl border border-borde bg-white p-4 space-y-3">
            <label className="block text-sm font-semibold text-texto">
              1. Seleccioná una salida finalizada para calificar su equipo y proveedores
            </label>
            {salidasFinalizadas.length === 0 ? (
              <div className="rounded-lg border border-borde bg-slate-50 p-4 text-xs text-texto-suave">
                No hay salidas en estado <strong>FINALIZADA</strong> en este momento. Recordá que
                según la regla de negocio del CU-42, solo se puede calificar el desempeño una vez
                que la salida ha concluido.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {salidasFinalizadas.map((s) => {
                  const activa = idSalidaEvaluarEfectiva === s.idsalida;
                  return (
                    <button
                      key={s.idsalida}
                      type="button"
                      onClick={() => setIdSalidaEvaluar(s.idsalida)}
                      className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                        activa
                          ? "border-primario bg-marca-suave/50 ring-1 ring-primario"
                          : "border-borde bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-mono text-xs font-bold text-primario">
                          {s.nroSalida}
                        </span>
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-exito">
                          FINALIZADA
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-texto">
                        {s.paquete?.nombrePaquete ?? `Paquete #${s.idpaquete}`}
                      </div>
                      <div className="mt-1 text-xs text-texto-suave">
                        {formatearFechaCorta(s.fechaInicio)} al {formatearFechaCorta(s.fechaFin)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {idSalidaEvaluarEfectiva &&
            (cargandoEvaluables ? (
              <EstadoListado estado="cargando" />
            ) : errorEvaluables instanceof Error ? (
              <div className="space-y-3">
                <EstadoListado estado="error" mensaje={errorEvaluables.message} />
                <div className="flex justify-center">
                  <Boton variante="secundario" onClick={() => reintentarEvaluables()}>
                    Reintentar carga de salida
                  </Boton>
                </div>
              </div>
            ) : !evaluablesSalida ||
              (evaluablesSalida.personal.length === 0 &&
                evaluablesSalida.proveedores.length === 0) ? (
              <EstadoListado
                estado="vacio"
                mensaje="Esta salida no registra personal asignado ni proveedores vinculados."
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Personal asignado a la salida */}
                <div className="rounded-xl border border-borde bg-white p-5 space-y-4">
                  <div className="border-b border-borde pb-3">
                    <h2 className="text-base font-semibold text-texto">
                      Personal operativo que participó ({evaluablesSalida.personal.length})
                    </h2>
                    <p className="text-xs text-texto-suave">
                      Guías y porteadores asignados a {evaluablesSalida.salida.nroSalida}
                    </p>
                  </div>

                  {evaluablesSalida.personal.length === 0 ? (
                    <p className="py-4 text-xs text-texto-suave">
                      No hubo personal asignado en esta salida.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {evaluablesSalida.personal.map((p) => (
                        <div
                          key={p.idpersonal}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-slate-50 p-3.5"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-texto">
                                {p.nombreCompleto}
                              </span>
                              <span className="rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-medium text-primario">
                                {p.rol}
                              </span>
                            </div>
                            {p.evaluacion ? (
                              <div className="mt-1.5 space-y-1">
                                <EstrellasPuntaje valor={p.evaluacion.puntaje} />
                                {p.evaluacion.comentario && (
                                  <p className="text-xs text-texto-suave">
                                    “{p.evaluacion.comentario}”
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-texto-suave">
                                Pendiente de calificación en esta salida
                              </p>
                            )}
                          </div>

                          {p.evaluacion ? (
                            <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-exito">
                              ✓ Evaluado
                            </span>
                          ) : (
                            <Boton
                              variante="principal"
                              className="px-3 py-1.5 text-xs"
                              onClick={() =>
                                setEvaluadoEnModal({
                                  tipo: "PERSONAL",
                                  id: p.idpersonal,
                                  nombre: p.nombreCompleto,
                                  subtitulo: `Rol desempeñado en la salida: ${p.rol}`,
                                })
                              }
                            >
                              Calificar desempeño
                            </Boton>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Proveedores de la salida */}
                <div className="rounded-xl border border-borde bg-white p-5 space-y-4">
                  <div className="border-b border-borde pb-3">
                    <h2 className="text-base font-semibold text-texto">
                      Proveedores de servicios ({evaluablesSalida.proveedores.length})
                    </h2>
                    <p className="text-xs text-texto-suave">
                      Prestadores de alojamiento, transporte, tren o equipamiento en{" "}
                      {evaluablesSalida.salida.nroSalida}
                    </p>
                  </div>

                  {evaluablesSalida.proveedores.length === 0 ? (
                    <p className="py-4 text-xs text-texto-suave">
                      No hubo proveedores vinculados en esta salida.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {evaluablesSalida.proveedores.map((prov) => (
                        <div
                          key={prov.idproveedor}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-slate-50 p-3.5"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-texto">
                                {prov.razonSocial}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-texto-suave border border-borde">
                                Proveedor
                              </span>
                            </div>
                            {prov.evaluacion ? (
                              <div className="mt-1.5 space-y-1">
                                <EstrellasPuntaje valor={prov.evaluacion.puntaje} />
                                {prov.evaluacion.comentario && (
                                  <p className="text-xs text-texto-suave">
                                    “{prov.evaluacion.comentario}”
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-texto-suave">
                                Pendiente de calificación en esta salida
                              </p>
                            )}
                          </div>

                          {prov.evaluacion ? (
                            <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-exito">
                              ✓ Evaluado
                            </span>
                          ) : (
                            <Boton
                              variante="principal"
                              className="px-3 py-1.5 text-xs"
                              onClick={() =>
                                setEvaluadoEnModal({
                                  tipo: "PROVEEDOR",
                                  id: prov.idproveedor,
                                  nombre: prov.razonSocial,
                                  subtitulo: "Proveedor de servicios operativos de la salida",
                                })
                              }
                            >
                              Calificar proveedor
                            </Boton>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {evaluadoEnModal && evaluablesSalida && (
        <ModalCalificarEvaluado
          key={`${evaluadoEnModal.tipo}-${evaluadoEnModal.id}`}
          idSalida={evaluablesSalida.salida.idsalida}
          nroSalida={evaluablesSalida.salida.nroSalida}
          tipo={evaluadoEnModal.tipo}
          idEvaluado={evaluadoEnModal.id}
          nombreEvaluado={evaluadoEnModal.nombre}
          subtitulo={evaluadoEnModal.subtitulo}
          onCerrar={() => setEvaluadoEnModal(null)}
          onGuardada={(msg) => {
            setEvaluadoEnModal(null);
            setMensajeExito(msg);
            queryClient.invalidateQueries({
              queryKey: ["salidas", evaluablesSalida.salida.idsalida, "evaluaciones"],
            });
            queryClient.invalidateQueries({ queryKey: ["resenias"] });
          }}
        />
      )}
    </div>
  );
}

export default EvaluacionesPage;
