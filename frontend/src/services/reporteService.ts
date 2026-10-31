/* eslint-disable @typescript-eslint/no-explicit-any -- la forma de cada reporte la define el back y estos armadores son su único lector */
import { solicitarApi } from "./clienteApi";
import { formatearFechaLocalCorta, formatearFechaUtcCorta, formatearMontoUsd } from "./clientePortalService";

export type TipoReporte = "ventas" | "ocupacion" | "cancelaciones" | "solicitudes" | "calidad";

export const REPORTES: { tipo: TipoReporte; titulo: string; descripcion: string; filtroPor: string }[] = [
    { tipo: "ventas", titulo: "Ventas", descripcion: "Reservas, facturación y reintegros por paquete y por mes.", filtroPor: "fecha de compra" },
    { tipo: "ocupacion", titulo: "Ocupación", descripcion: "Lugares vendidos contra capacidad de cada salida.", filtroPor: "inicio de la salida" },
    { tipo: "cancelaciones", titulo: "Cancelaciones", descripcion: "Reintegros, importes retenidos y motivos.", filtroPor: "fecha del reembolso" },
    { tipo: "solicitudes", titulo: "Solicitudes a hoteles", descripcion: "Historial de solicitudes de alojamiento y respuesta de cada hotel.", filtroPor: "compra de la reserva" },
    { tipo: "calidad", titulo: "Calidad", descripcion: "Reseñas, incidentes y evaluaciones de proveedores y personal.", filtroPor: "inicio de la salida" },
];

type Fila = Record<string, any>;

export type ColumnaReporte = { titulo: string; valor: (fila: Fila) => string };
export type TablaDeReporte = { titulo: string; columnas: ColumnaReporte[]; filas: (Fila & { id: string | number })[] };
export type ItemDeGrafico = { etiqueta: string; valor: number; texto: string };
/** barras: comparar nombres · columnas: evolución por mes · partes: cómo se reparte un total */
export type GraficoDeReporte = { titulo: string; forma: "barras" | "columnas" | "partes"; items: ItemDeGrafico[]; maximo?: number; colores?: string[] };
export type ReporteArmado = {
    indicadores: { etiqueta: string; valor: string }[];
    graficos: GraficoDeReporte[];
    tablas: TablaDeReporte[];
};

/** Paleta validada para daltonismo sobre fondo blanco. Cada parte conserva su color porque los items van en orden fijo */
export const COLORES_GRAFICO = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
// Acá el color significa algo: un incidente crítico no puede salir en verde
const COLORES_GRAVEDAD = ["#0ca30c", "#fab219", "#d03b3b"];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TOPE_BARRAS = 8;

const dinero = formatearMontoUsd;
const fechaUtc = (iso: string) => formatearFechaUtcCorta(iso);
const pct = (n: number) => `${n.toLocaleString("es-AR")} %`;
const nota = (n: number | null) => (n === null ? "Sin datos" : `${n.toLocaleString("es-AR")} / 5`);
const col = (titulo: string, clave: string, formato: (v: any) => string = String): ColumnaReporte => ({
    titulo,
    valor: (f) => formato(f[clave]),
});

const COLUMNAS_PROMEDIO = [col("Nombre", "nombre"), col("Evaluaciones", "cantidad"), col("Promedio", "promedio", nota)];
const COLUMNAS_CONTEO = [col("Detalle", "nombre"), col("Cantidad", "cantidad")];

const COLUMNAS_VENTAS = [
    col("Reservas", "reservas"),
    col("Canceladas", "canceladas"),
    col("Pasajeros", "pasajeros"),
    col("Facturado", "facturado", dinero),
    col("Reintegrado", "reintegrado", dinero),
    col("Neto", "neto", dinero),
];

const etiquetaMes = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(2, 4)}`;

function barras(titulo: string, items: ItemDeGrafico[], maximo?: number): GraficoDeReporte {
    const recortado = items.length > TOPE_BARRAS;
    return {
        titulo: recortado ? `${titulo} (primeros ${TOPE_BARRAS} de ${items.length})` : titulo,
        forma: "barras",
        items: items.slice(0, TOPE_BARRAS),
        ...(maximo === undefined ? {} : { maximo }),
    };
}

const partes = (titulo: string, items: [string, number, string?][], colores = COLORES_GRAFICO): GraficoDeReporte => ({
    titulo,
    forma: "partes",
    colores,
    items: items.map(([etiqueta, valor, texto]) => ({ etiqueta, valor, texto: texto ?? String(valor) })),
});

function acumularPorMes(filas: Fila[], fecha: string, valor: (fila: Fila) => number) {
    const meses = new Map<string, number>();
    for (const fila of filas) {
        const mes = String(fila[fecha]).slice(0, 7);
        meses.set(mes, (meses.get(mes) ?? 0) + valor(fila));
    }
    return meses;
}

/** Completa los meses sin datos: si se salteara alguno, el eje mentiría sobre el paso del tiempo */
function columnas(titulo: string, meses: Map<string, number>, texto: (valor: number) => string, maximo?: number): GraficoDeReporte {
    const orden = [...meses.keys()].sort();
    const items: ItemDeGrafico[] = [];
    if (orden.length > 0) {
        const fin = orden[orden.length - 1];
        for (const d = new Date(`${orden[0]}-01T00:00:00Z`); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
            const mes = d.toISOString().slice(0, 7);
            const valor = meses.get(mes) ?? 0;
            items.push({ etiqueta: etiquetaMes(mes), valor, texto: meses.has(mes) ? texto(valor) : "Sin datos" });
            if (mes === fin) break;
        }
    }
    return { titulo, forma: "columnas", items, ...(maximo === undefined ? {} : { maximo }) };
}

/** Un gráfico sin valores no dice nada: ni la pantalla ni el PDF lo muestran */
export const graficosConDatos = (graficos: GraficoDeReporte[]) => graficos.filter((g) => g.items.some((i) => i.valor > 0));

const cantidadDe = (filas: Fila[], nombre: string): number => filas.find((f) => f.nombre === nombre)?.cantidad ?? 0;

function ocupacionPorMes(salidas: Fila[]) {
    const vigentes = salidas.filter((s) => s.estado !== "CANCELADA");
    const capacidad = acumularPorMes(vigentes, "fechaInicio", (s) => s.capacidad);
    const vendidos = acumularPorMes(vigentes, "fechaInicio", (s) => s.ocupados);
    return new Map([...capacidad].map(([mes, total]) => [mes, total > 0 ? Math.round(((vendidos.get(mes) ?? 0) / total) * 100) : 0]));
}

/** Convierte la respuesta del back en indicadores, gráficos y tablas: la misma definición arma la pantalla y el PDF */
const ARMADORES: Record<TipoReporte, (d: any) => ReporteArmado> = {
    ventas: (d) => ({
        indicadores: [
            { etiqueta: "Reservas", valor: String(d.resumen.reservas) },
            { etiqueta: "Pasajeros", valor: String(d.resumen.pasajeros) },
            { etiqueta: "Facturado", valor: dinero(d.resumen.facturado) },
            { etiqueta: "Reintegrado", valor: dinero(d.resumen.reintegrado) },
            { etiqueta: "Neto", valor: dinero(d.resumen.neto) },
        ],
        graficos: [
            columnas("Neto por mes", new Map(d.porMes.map((m: Fila) => [m.mes, m.neto])), dinero),
            barras("Neto por paquete", d.porPaquete.map((p: Fila) => ({ etiqueta: p.paquete, valor: p.neto, texto: dinero(p.neto) }))),
            partes("Qué pasó con lo facturado", [
                ["Neto", d.resumen.neto, dinero(d.resumen.neto)],
                ["Reintegrado", d.resumen.reintegrado, dinero(d.resumen.reintegrado)],
            ]),
        ],
        tablas: [
            { titulo: "Por paquete", columnas: [col("Paquete", "paquete"), ...COLUMNAS_VENTAS], filas: d.porPaquete },
            { titulo: "Por mes", columnas: [col("Mes", "mes"), ...COLUMNAS_VENTAS], filas: d.porMes },
        ],
    }),
    ocupacion: (d) => ({
        indicadores: [
            { etiqueta: "Salidas", valor: String(d.resumen.salidas) },
            { etiqueta: "Canceladas", valor: String(d.resumen.canceladas) },
            { etiqueta: "Lugares ofrecidos", valor: String(d.resumen.lugares) },
            { etiqueta: "Lugares vendidos", valor: String(d.resumen.ocupados) },
            { etiqueta: "Ocupación", valor: pct(d.resumen.ocupacion) },
        ],
        graficos: [
            columnas("Ocupación por mes", ocupacionPorMes(d.salidas), pct, 100),
            barras("Ocupación por paquete", d.porPaquete.map((p: Fila) => ({ etiqueta: p.paquete, valor: p.ocupacion, texto: pct(p.ocupacion) })), 100),
            partes("Lugares ofrecidos", [
                ["Vendidos", d.resumen.ocupados],
                ["Libres", d.resumen.lugares - d.resumen.ocupados],
            ]),
        ],
        tablas: [
            {
                titulo: "Por salida",
                columnas: [
                    col("Salida", "nroSalida"), col("Paquete", "paquete"), col("Inicio", "fechaInicio", fechaUtc), col("Estado", "estado"),
                    col("Capacidad", "capacidad"), col("Vendidos", "ocupados"), col("Ocupación", "ocupacion", pct),
                ],
                filas: d.salidas,
            },
        ],
    }),
    cancelaciones: (d) => ({
        indicadores: [
            { etiqueta: "Cancelaciones", valor: String(d.resumen.cancelaciones) },
            { etiqueta: "Sin reintegro", valor: String(d.resumen.sinReintegro) },
            { etiqueta: "Abonado", valor: dinero(d.resumen.abonado) },
            { etiqueta: "Reintegrado", valor: dinero(d.resumen.reintegrado) },
            { etiqueta: "Retenido", valor: dinero(d.resumen.retenido) },
        ],
        graficos: [
            columnas("Cancelaciones por mes", acumularPorMes(d.cancelaciones, "fecha", () => 1), String),
            barras("Motivos", d.porMotivo.map((m: Fila) => ({ etiqueta: m.nombre, valor: m.cantidad, texto: String(m.cantidad) }))),
            partes("Quién canceló", [
                ["Cliente", cantidadDe(d.porOrigen, "Cliente")],
                ["Administrador", cantidadDe(d.porOrigen, "Administrador")],
            ]),
            partes("Qué pasó con lo abonado", [
                ["Reintegrado", d.resumen.reintegrado, dinero(d.resumen.reintegrado)],
                ["Retenido", d.resumen.retenido, dinero(d.resumen.retenido)],
            ]),
        ],
        tablas: [
            { titulo: "Quién canceló", columnas: COLUMNAS_CONTEO, filas: d.porOrigen },
            {
                titulo: "Detalle",
                columnas: [
                    col("Fecha", "fecha", formatearFechaLocalCorta), col("Reserva", "nroReserva"), col("Paquete", "paquete"), col("Canceló", "origen"), col("Motivo", "motivo"),
                    col("Abonado", "abonado", dinero), col("Reintegrado", "reintegrado", dinero), col("Retenido", "retenido", dinero),
                ],
                filas: d.cancelaciones,
            },
        ],
    }),
    solicitudes: (d) => ({
        indicadores: [
            { etiqueta: "Solicitudes", valor: String(d.resumen.solicitudes) },
            { etiqueta: "Confirmadas", valor: String(d.resumen.confirmadas) },
            { etiqueta: "Rechazadas", valor: String(d.resumen.rechazadas) },
            { etiqueta: "Pendientes", valor: String(d.resumen.pendientes) },
            { etiqueta: "Aceptación de hoteles", valor: pct(d.resumen.tasaAceptacion) },
        ],
        graficos: [
            partes("Estado de las solicitudes", [
                ["Confirmadas", d.resumen.confirmadas],
                ["Rechazadas", d.resumen.rechazadas],
                ["Pendientes", d.resumen.pendientes],
                ["Canceladas", d.resumen.canceladas],
            ]),
            barras(
                "Aceptación por hotel",
                d.porHotel
                    .map((h: Fila) => ({ etiqueta: h.hotel, valor: h.tasaAceptacion, texto: pct(h.tasaAceptacion) }))
                    .sort((a: ItemDeGrafico, b: ItemDeGrafico) => b.valor - a.valor),
                100,
            ),
            barras("Motivos de rechazo", d.motivosRechazo.map((m: Fila) => ({ etiqueta: m.nombre, valor: m.cantidad, texto: String(m.cantidad) }))),
        ],
        tablas: [
            {
                titulo: "Por hotel",
                columnas: [col("Hotel", "hotel"), col("Proveedor", "proveedor"), col("Contactos", "contactos"), col("Aceptadas", "aceptadas"), col("Rechazadas", "rechazadas"), col("Aceptación", "tasaAceptacion", pct)],
                filas: d.porHotel,
            },
            { titulo: "Motivos de rechazo", columnas: COLUMNAS_CONTEO, filas: d.motivosRechazo },
            {
                titulo: "Historial",
                columnas: [
                    col("Solicitud", "nroSolicitud"), col("Pedido", "fechaPedido", formatearFechaLocalCorta), col("Paquete", "paquete"), col("Salida", "nroSalida"),
                    col("Plazas", "plazas"), col("Estado", "estado"),
                    {
                        titulo: "Respuesta del hotel",
                        valor: (f) =>
                            f.gestiones.length === 0
                                ? "Sin respuesta"
                                : f.gestiones
                                      .map((g: Fila) => `${g.hotel}: ${g.resultado}${g.motivoRechazo ? ` (${g.motivoRechazo})` : ""}, ${formatearFechaLocalCorta(g.fechaRespuesta)}`)
                                      .join(" · "),
                    },
                ],
                filas: d.solicitudes,
            },
        ],
    }),
    calidad: (d) => ({
        indicadores: [
            { etiqueta: "Reseñas", valor: String(d.resumen.resenias) },
            { etiqueta: "Valoración", valor: nota(d.resumen.valoracionPromedio) },
            { etiqueta: "Incidentes", valor: String(d.resumen.incidentes) },
            { etiqueta: "Proveedores", valor: nota(d.resumen.puntajeProveedores) },
            { etiqueta: "Personal", valor: nota(d.resumen.puntajePersonal) },
        ],
        graficos: [
            barras("Valoración por paquete", d.reseniasPorPaquete.map((p: Fila) => ({ etiqueta: p.nombre, valor: p.promedio, texto: nota(p.promedio) })), 5),
            partes("Incidentes por gravedad", [
                ["Bajo", cantidadDe(d.incidentesPorGravedad, "BAJO")],
                ["Medio", cantidadDe(d.incidentesPorGravedad, "MEDIO")],
                ["Crítico", cantidadDe(d.incidentesPorGravedad, "CRITICO")],
            ], COLORES_GRAVEDAD),
            barras("Incidentes por tipo", d.incidentesPorTipo.map((i: Fila) => ({ etiqueta: i.nombre, valor: i.cantidad, texto: String(i.cantidad) }))),
            barras("Proveedores", d.proveedores.map((p: Fila) => ({ etiqueta: p.nombre, valor: p.promedio, texto: nota(p.promedio) })), 5),
            barras("Personal", d.personal.map((p: Fila) => ({ etiqueta: p.nombre, valor: p.promedio, texto: nota(p.promedio) })), 5),
        ],
        tablas: [
            { titulo: "Incidentes por gravedad", columnas: COLUMNAS_CONTEO, filas: d.incidentesPorGravedad },
            { titulo: "Proveedores", columnas: COLUMNAS_PROMEDIO, filas: d.proveedores },
            { titulo: "Personal", columnas: COLUMNAS_PROMEDIO, filas: d.personal },
        ],
    }),
};

export async function obtenerReporte(tipo: TipoReporte, desde: string, hasta: string): Promise<ReporteArmado> {
    const parametros = new URLSearchParams();
    if (desde) parametros.set("desde", desde);
    if (hasta) parametros.set("hasta", hasta);
    const res = await solicitarApi<{ data: unknown }>(`/reportes/${tipo}?${parametros}`);
    return ARMADORES[tipo](res.data);
}
