import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import { descargarReportePdf } from "../../services/pdf";
import {
    COLORES_GRAFICO,
    REPORTES,
    graficosConDatos,
    obtenerReporte,
    type GraficoDeReporte,
    type TablaDeReporte,
    type TipoReporte,
} from "../../services/reporteService";

const FILAS_POR_PAGINA = 10;

const hoyIso = () => new Date().toLocaleDateString("en-CA");
function haceUnAnioIso() {
    const fecha = new Date();
    fecha.setFullYear(fecha.getFullYear() - 1);
    return fecha.toLocaleDateString("en-CA");
}

function Barras({ items, maximo }: GraficoDeReporte) {
    const tope = maximo ?? Math.max(...items.map((i) => i.valor), 1);
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li key={item.etiqueta} className="text-xs">
                    <div className="mb-1 flex justify-between gap-3">
                        <span className="text-texto">{item.etiqueta}</span>
                        <span className="shrink-0 font-semibold text-navegacion">{item.texto}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                        <div
                            className="h-2 rounded-full"
                            style={{ width: `${Math.max(0, (item.valor / tope) * 100)}%`, backgroundColor: COLORES_GRAFICO[0] }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function Columnas({ items, maximo }: GraficoDeReporte) {
    const [activo, setActivo] = useState<number | null>(null);
    const tope = maximo ?? Math.max(...items.map((i) => i.valor), 1);
    const elegido = items[activo ?? items.length - 1];
    const cadaCuantas = Math.ceil(items.length / 8);

    return (
        <div>
            <p className="mb-2 text-xs text-texto-suave" aria-live="polite">
                {elegido.etiqueta}: <span className="font-semibold text-navegacion">{elegido.texto}</span>
            </p>
            <div className="flex h-40 items-stretch gap-0.5 border-b border-borde" onMouseLeave={() => setActivo(null)}>
                {items.map((item, i) => (
                    <button
                        key={item.etiqueta}
                        type="button"
                        aria-label={`${item.etiqueta}: ${item.texto}`}
                        onMouseEnter={() => setActivo(i)}
                        onFocus={() => setActivo(i)}
                        onClick={() => setActivo(i)}
                        className="flex min-w-0 flex-1 items-end hover:bg-slate-50"
                    >
                        <span
                            className="block w-full rounded-t"
                            style={{
                                height: `${Math.max(0, (item.valor / tope) * 100)}%`,
                                backgroundColor: COLORES_GRAFICO[0],
                                opacity: activo === null || activo === i ? 1 : 0.55,
                            }}
                        />
                    </button>
                ))}
            </div>
            <div className="mt-1 flex gap-0.5 text-center text-[10px] text-texto-suave">
                {items.map((item, i) => (
                    <span key={item.etiqueta} className="min-w-0 flex-1 whitespace-nowrap">
                        {i % cadaCuantas === 0 ? item.etiqueta : ""}
                    </span>
                ))}
            </div>
        </div>
    );
}

function Partes({ items, colores = COLORES_GRAFICO }: GraficoDeReporte) {
    const total = items.reduce((a, i) => a + i.valor, 0);
    return (
        <div>
            <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
                {items.map((item, i) => (
                    <div key={item.etiqueta} style={{ flexGrow: item.valor, backgroundColor: colores[i] }} />
                ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
                {items.map((item, i) => (
                    <li key={item.etiqueta} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colores[i] }} />
                        <span className="text-texto">{item.etiqueta}</span>
                        <span className="ml-auto font-semibold text-navegacion">
                            {item.texto} · {Math.round((item.valor / total) * 100)} %
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const FORMAS = { barras: Barras, columnas: Columnas, partes: Partes };

function Grafico(grafico: GraficoDeReporte) {
    const Forma = FORMAS[grafico.forma];
    return (
        <section className={`rounded-tarjeta border border-borde bg-white p-4 ${grafico.forma === "columnas" ? "lg:col-span-2" : ""}`}>
            <h2 className="mb-3 text-sm font-bold text-navegacion">{grafico.titulo}</h2>
            <Forma {...grafico} />
        </section>
    );
}

function TablaReporte({ titulo, columnas, filas }: TablaDeReporte) {
    const [pagina, setPagina] = useState(1);
    if (filas.length === 0) return null;
    const totalPaginas = Math.ceil(filas.length / FILAS_POR_PAGINA);
    const paginaSegura = Math.min(pagina, totalPaginas);

    return (
        <section className="space-y-2">
            <h2 className="text-sm font-bold text-navegacion">
                {titulo} ({filas.length})
            </h2>
            <Tabla
                columnas={columnas.map((c) => ({
                    clave: "id" as const,
                    titulo: c.titulo,
                    renderizar: (fila) => <span className="text-sm">{c.valor(fila)}</span>,
                }))}
                filas={filas.slice((paginaSegura - 1) * FILAS_POR_PAGINA, paginaSegura * FILAS_POR_PAGINA)}
            />
            {totalPaginas > 1 ? (
                <Paginacion paginaActual={paginaSegura} totalPaginas={totalPaginas} onCambiarPagina={setPagina} />
            ) : null}
        </section>
    );
}

function ReportesPage() {
    const [tipo, setTipo] = useState<TipoReporte>("ventas");
    const [desde, setDesde] = useState(haceUnAnioIso);
    const [hasta, setHasta] = useState(hoyIso);
    const [descargando, setDescargando] = useState(false);
    const [errorPdf, setErrorPdf] = useState<string | null>(null);

    const definicion = REPORTES.find((r) => r.tipo === tipo)!;
    const periodoValido = !desde || !hasta || desde <= hasta;

    const { data: reporte, isLoading, error } = useQuery({
        queryKey: ["reportes", tipo, desde, hasta],
        queryFn: () => obtenerReporte(tipo, desde, hasta),
        enabled: periodoValido,
    });

    const sinDatos = reporte && reporte.tablas.every((t) => t.filas.length === 0);

    async function descargarPdf() {
        if (!reporte) return;
        try {
            setErrorPdf(null);
            setDescargando(true);
            await descargarReportePdf(
                definicion.titulo,
                `Período: ${desde || "inicio"} a ${hasta || "hoy"} (por ${definicion.filtroPor})`,
                reporte.indicadores,
                graficosConDatos(reporte.graficos),
                reporte.tablas.map((t) => ({
                    titulo: t.titulo,
                    cabecera: t.columnas.map((c) => c.titulo),
                    filas: t.filas.map((f) => t.columnas.map((c) => c.valor(f))),
                })),
            );
        } catch {
            setErrorPdf("No se pudo generar el PDF del reporte.");
        } finally {
            setDescargando(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-texto">Reportes</h1>
                <p className="text-sm text-texto-suave">{definicion.descripcion}</p>
            </div>

            <div role="tablist" aria-label="Tipo de reporte" className="flex flex-wrap gap-2">
                {REPORTES.map((r) => (
                    <button
                        key={r.tipo}
                        type="button"
                        role="tab"
                        aria-selected={r.tipo === tipo}
                        onClick={() => setTipo(r.tipo)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                            r.tipo === tipo
                                ? "border-primario bg-primario text-white"
                                : "border-borde bg-white text-texto-suave hover:bg-slate-100"
                        }`}
                    >
                        {r.titulo}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-texto-suave">
                    Desde
                    <input
                        type="date"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        className="mt-1 block rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto"
                    />
                </label>
                <label className="text-xs font-semibold text-texto-suave">
                    Hasta
                    <input
                        type="date"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        className="mt-1 block rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto"
                    />
                </label>
                <span className="pb-2 text-xs text-texto-suave">Por {definicion.filtroPor}</span>
                <Boton
                    variante="secundario"
                    className="ml-auto"
                    onClick={descargarPdf}
                    cargando={descargando}
                    disabled={!reporte || sinDatos}
                >
                    Descargar PDF
                </Boton>
            </div>

            {!periodoValido ? <Alerta tipo="error">La fecha desde no puede ser posterior a la fecha hasta.</Alerta> : null}
            {errorPdf ? <Alerta tipo="error">{errorPdf}</Alerta> : null}

            {!periodoValido ? null : isLoading ? (
                <EstadoListado estado="cargando" />
            ) : error instanceof Error ? (
                <EstadoListado estado="error" mensaje={error.message} />
            ) : !reporte || sinDatos ? (
                <EstadoListado estado="vacio" mensaje="No hay datos para ese período." />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                        {reporte.indicadores.map((i) => (
                            <div key={i.etiqueta} className="rounded-xl border border-borde bg-white p-4">
                                <div className="text-xs font-medium text-texto-suave">{i.etiqueta}</div>
                                <div className="mt-1 text-xl font-bold text-texto">{i.valor}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {graficosConDatos(reporte.graficos).map((g) => (
                            <Grafico key={`${tipo}-${g.titulo}`} {...g} />
                        ))}
                    </div>
                    <details className="rounded-tarjeta border border-borde bg-white p-4">
                        <summary className="cursor-pointer text-sm font-bold text-navegacion">Ver tablas de detalle</summary>
                        <div className="mt-4 space-y-6">
                            {reporte.tablas.map((t) => (
                                <TablaReporte key={`${tipo}-${t.titulo}`} {...t} />
                            ))}
                        </div>
                    </details>
                </>
            )}
        </div>
    );
}

export default ReportesPage;
