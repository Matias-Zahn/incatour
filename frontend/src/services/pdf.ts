import type { jsPDF } from "jspdf";
import {
    etiquetaEstadoReserva,
    formatearFechaLocalCorta,
    formatearFechaUtcCorta,
    formatearMontoUsd,
    type ComprobanteReserva,
} from "./clientePortalService";
import { COLORES_GRAFICO, type GraficoDeReporte } from "./reporteService";

const COLOR_MARCA: [number, number, number] = [30, 41, 59];
const MARGEN = 14;

// jsPDF pesa: se carga recién cuando alguien descarga un PDF
async function cargarPdf() {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
    ]);
    return { jsPDF, autoTable };
}

function encabezado(doc: jsPDF, titulo: string, subtitulo: string): number {
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...COLOR_MARCA);
    doc.text("IncaTour", MARGEN, 18);
    doc.setFontSize(13).text(titulo, MARGEN, 26);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
    doc.text(subtitulo, MARGEN, 32);
    return 38;
}

/** Posición donde terminó la última tabla: jspdf-autotable la deja en el documento */
const finDeTabla = (doc: jsPDF) =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function pieDePagina(doc: jsPDF) {
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
        doc.setPage(i).setFontSize(8).setTextColor(130);
        doc.text(
            `Página ${i} de ${paginas}`,
            doc.internal.pageSize.getWidth() - MARGEN,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" },
        );
    }
}

export async function descargarComprobantePdf(comprobante: ComprobanteReserva) {
    const { jsPDF, autoTable } = await cargarPdf();
    const doc = new jsPDF();
    let y = encabezado(
        doc,
        "Comprobante de reserva",
        `Reserva ${comprobante.nroReserva} · Emitida el ${formatearFechaLocalCorta(comprobante.fechaRealizacion)}`,
    );

    const seccion = (titulo: string, cuerpo: string[][], cabecera?: string[]) => {
        autoTable(doc, {
            startY: y,
            head: [cabecera ?? [titulo, ""]],
            body: cuerpo,
            theme: "grid",
            margin: { left: MARGEN, right: MARGEN },
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: COLOR_MARCA },
            ...(cabecera ? {} : { columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } } }),
        });
        y = finDeTabla(doc) + 6;
    };

    seccion("Reserva", [
        ["Estado", etiquetaEstadoReserva(comprobante.estado)],
        ...(comprobante.estadoAlojamiento ? [["Alojamiento", comprobante.estadoAlojamiento]] : []),
        ["Titular", `${comprobante.titular.nombre} ${comprobante.titular.apellido}`],
        ["Correo electrónico", comprobante.titular.email],
    ]);
    seccion("Recorrido", [
        ["Paquete", comprobante.paquete],
        ["Salida", comprobante.salida.nroSalida],
        ["Inicio", formatearFechaUtcCorta(comprobante.salida.fechaInicio)],
        ["Fin", formatearFechaUtcCorta(comprobante.salida.fechaFin)],
        ["Cantidad de pasajeros", String(comprobante.pasajeros.length)],
        ...(comprobante.condicionesComerciales ? [["Condiciones", comprobante.condicionesComerciales]] : []),
    ]);
    seccion(
        "Pasajeros",
        comprobante.pasajeros.map((nombre, i) => [String(i + 1), nombre]),
        ["#", "Pasajero"],
    );
    seccion("Situación de pago", [
        ["Precio congelado", formatearMontoUsd(comprobante.precioCongelado)],
        ["Total abonado", formatearMontoUsd(comprobante.totalPagado)],
        ...(comprobante.reintegro !== null ? [["Reintegro registrado", formatearMontoUsd(comprobante.reintegro)]] : []),
    ]);
    if (comprobante.pagos.length > 0) {
        seccion(
            "Transacciones",
            comprobante.pagos.map((p) => [
                String(p.nroTransaccion),
                p.medioPago,
                formatearMontoUsd(p.monto),
                formatearFechaLocalCorta(p.fechahora),
            ]),
            ["Transacción", "Medio de pago", "Monto", "Fecha"],
        );
    }

    pieDePagina(doc);
    doc.save(`comprobante-${comprobante.nroReserva}.pdf`);
}

export type SeccionPdf = { titulo: string; cabecera: string[]; filas: string[][] };

const GRIS_FONDO = "#eef2f5";
const ALTO_COLUMNAS = 42;
const SEPARACION = 6;

function altoDeGrafico(g: GraficoDeReporte) {
    if (g.forma === "columnas") return ALTO_COLUMNAS + 18;
    if (g.forma === "partes") return 16 + g.items.length * 5;
    return 10 + g.items.length * 8;
}

function dibujarBarras(doc: jsPDF, g: GraficoDeReporte, x: number, y: number, ancho: number) {
    const tope = g.maximo ?? Math.max(...g.items.map((i) => i.valor), 1);
    g.items.forEach((item, i) => {
        const fila = y + i * 8;
        doc.setFontSize(8).setTextColor(60);
        doc.text(doc.splitTextToSize(item.etiqueta, ancho - 34)[0], x, fila);
        doc.text(item.texto, x + ancho, fila, { align: "right" });
        doc.setFillColor(GRIS_FONDO).roundedRect(x, fila + 1.2, ancho, 2.4, 1.2, 1.2, "F");
        const largo = Math.max(0, (item.valor / tope) * ancho);
        if (largo > 0) doc.setFillColor(COLORES_GRAFICO[0]).roundedRect(x, fila + 1.2, largo, 2.4, 1.2, 1.2, "F");
    });
}

function dibujarColumnas(doc: jsPDF, g: GraficoDeReporte, x: number, y: number, ancho: number) {
    const tope = g.maximo ?? Math.max(...g.items.map((i) => i.valor), 1);
    const paso = ancho / g.items.length;
    const base = y + ALTO_COLUMNAS;
    const cadaCuantas = Math.ceil(g.items.length / 12);
    const mayor = g.items.reduce((a, b) => (b.valor > a.valor ? b : a));
    const ultimo = g.items[g.items.length - 1];

    g.items.forEach((item, i) => {
        const alto = Math.max(0, (item.valor / tope) * (ALTO_COLUMNAS - 6));
        const centro = x + paso * i + paso / 2;
        if (alto > 0) doc.setFillColor(COLORES_GRAFICO[0]).rect(x + paso * i + 0.4, base - alto, paso - 0.8, alto, "F");
        doc.setFontSize(7).setTextColor(100);
        if (i % cadaCuantas === 0) doc.text(item.etiqueta, centro, base + 4, { align: "center" });
        // Solo el pico y el último mes llevan valor: uno en cada columna se pisaría
        if (item === mayor || item === ultimo) doc.setTextColor(60).text(item.texto, centro, base - alto - 1.2, { align: "center" });
    });
    doc.setDrawColor(200).setLineWidth(0.2).line(x, base, x + ancho, base);
}

function dibujarPartes(doc: jsPDF, g: GraficoDeReporte, x: number, y: number, ancho: number) {
    const total = g.items.reduce((a, i) => a + i.valor, 0);
    const colores = g.colores ?? COLORES_GRAFICO;
    let inicio = x;
    g.items.forEach((item, i) => {
        const largo = (item.valor / total) * ancho;
        if (largo > 0) doc.setFillColor(colores[i]).rect(inicio, y - 2, largo, 5, "F");
        inicio += largo;
        const fila = y + 8 + i * 5;
        doc.setFillColor(colores[i]).rect(x, fila - 2.4, 2.6, 2.6, "F");
        doc.setFontSize(8).setTextColor(60).text(item.etiqueta, x + 4.5, fila);
        doc.text(`${item.texto} · ${Math.round((item.valor / total) * 100)} %`, x + ancho, fila, { align: "right" });
    });
}

const DIBUJOS = { barras: dibujarBarras, columnas: dibujarColumnas, partes: dibujarPartes };

/** Acomoda los gráficos en dos columnas; la evolución por mes ocupa todo el ancho. Devuelve dónde terminaron */
function dibujarGraficos(doc: jsPDF, graficos: GraficoDeReporte[], inicioY: number) {
    const anchoTotal = doc.internal.pageSize.getWidth() - MARGEN * 2;
    const limite = doc.internal.pageSize.getHeight() - 14;
    const anchoMitad = (anchoTotal - SEPARACION) / 2;
    let y = inicioY;
    let columna = 0;
    let altoFila = 0;

    const cerrarFila = () => {
        y += altoFila;
        columna = 0;
        altoFila = 0;
    };

    for (const g of graficos) {
        const completo = g.forma === "columnas";
        const alto = altoDeGrafico(g);
        if (completo && columna === 1) cerrarFila();
        if (y + alto > limite) {
            doc.addPage();
            y = 18;
            columna = 0;
            altoFila = 0;
        }
        const x = MARGEN + columna * (anchoMitad + SEPARACION);
        const ancho = completo ? anchoTotal : anchoMitad;
        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...COLOR_MARCA);
        doc.text(g.titulo, x, y);
        doc.setFont("helvetica", "normal");
        DIBUJOS[g.forma](doc, g, x, y + 7, ancho);
        altoFila = Math.max(altoFila, alto);
        if (completo || columna === 1) cerrarFila();
        else columna = 1;
    }
    return y + altoFila;
}

export async function descargarReportePdf(
    titulo: string,
    periodo: string,
    indicadores: { etiqueta: string; valor: string }[],
    graficos: GraficoDeReporte[],
    secciones: SeccionPdf[],
) {
    const { jsPDF, autoTable } = await cargarPdf();
    const doc = new jsPDF({ orientation: "landscape" });
    let y = encabezado(doc, titulo, periodo);

    const tabla = (cabecera: string[], filas: string[][]) => {
        autoTable(doc, {
            startY: y,
            head: [cabecera],
            body: filas,
            theme: "grid",
            margin: { left: MARGEN, right: MARGEN },
            styles: { fontSize: 8, cellPadding: 1.8 },
            headStyles: { fillColor: COLOR_MARCA },
        });
        y = finDeTabla(doc) + 9;
    };

    tabla(indicadores.map((i) => i.etiqueta), [indicadores.map((i) => i.valor)]);
    dibujarGraficos(doc, graficos, y);

    // Las tablas quedan como anexo, para que el reporte abra con los gráficos
    doc.addPage();
    y = 18;
    for (const s of secciones.filter((x) => x.filas.length > 0)) {
        if (y > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            y = 18;
        }
        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...COLOR_MARCA);
        doc.text(s.titulo, MARGEN, y - 2);
        tabla(s.cabecera, s.filas);
    }

    pieDePagina(doc);
    doc.save(`${titulo.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
