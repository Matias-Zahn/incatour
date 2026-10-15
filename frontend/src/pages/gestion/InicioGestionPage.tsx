import Boton from "../../components/Boton";

type Metrica = {
    etiqueta: string;
    valor: string;
    detalle: string;
    tendencia: "positiva" | "neutra" | "alerta";
};

type Salida = {
    circuito: string;
    fecha: string;
    cupos: string;
    estado: "Confirmada" | "Pendiente";
};

type Actividad = {
    descripcion: string;
    detalle: string;
    estado: "Nueva" | "Confirmada" | "Pendiente";
};

const metricas: Metrica[] = [
    {
        etiqueta: "Reservas del mes",
        valor: "128",
        detalle: "+12,5% vs. mes anterior",
        tendencia: "positiva",
    },
    {
        etiqueta: "Salidas programadas",
        valor: "24",
        detalle: "6 durante esta semana",
        tendencia: "neutra",
    },
    {
        etiqueta: "Ingresos del mes",
        valor: "S/ 48.620",
        detalle: "+8,2% vs. mes anterior",
        tendencia: "positiva",
    },
    {
        etiqueta: "Pendientes de gestión",
        valor: "7",
        detalle: "Requieren atención",
        tendencia: "alerta",
    },
];

const proximasSalidas: Salida[] = [
    {
        circuito: "Camino Inca clásico",
        fecha: "12 de octubre · 06:30",
        cupos: "8 / 16 pasajeros",
        estado: "Confirmada",
    },
    {
        circuito: "Valle Sagrado",
        fecha: "14 de octubre · 07:00",
        cupos: "12 / 20 pasajeros",
        estado: "Confirmada",
    },
    {
        circuito: "Montaña de 7 colores",
        fecha: "16 de octubre · 05:00",
        cupos: "4 / 12 pasajeros",
        estado: "Pendiente",
    },
];

const actividadReciente: Actividad[] = [
    {
        descripcion: "Nueva reserva recibida",
        detalle: "Reserva #1048 · Hace 12 minutos",
        estado: "Nueva",
    },
    {
        descripcion: "Pago confirmado",
        detalle: "Reserva #1042 · Hace 1 hora",
        estado: "Confirmada",
    },
    {
        descripcion: "Proveedor pendiente de revisión",
        detalle: "Andes Travel · Hace 3 horas",
        estado: "Pendiente",
    },
];

const estiloTendencia: Record<Metrica["tendencia"], string> = {
    positiva: "text-exito",
    neutra: "text-texto-suave",
    alerta: "text-advertencia",
};

const estiloEstado: Record<Actividad["estado"] | Salida["estado"], string> = {
    Nueva: "bg-marca-activa text-marca-oscura",
    Confirmada: "bg-green-50 text-exito",
    Pendiente: "bg-amber-50 text-advertencia",
};

function InicioGestionPage() {
    return (
        <section className="mx-auto max-w-7xl space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Resumen general
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Buen día, Administrador/a
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Este es el estado de la operación de IncaTour.
                    </p>
                </div>

                <Boton>Crear nueva salida</Boton>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricas.map((metrica) => (
                    <article
                        className="rounded-tarjeta border border-borde bg-white p-5 shadow-tarjeta"
                        key={metrica.etiqueta}
                    >
                        <p className="text-sm font-semibold text-texto-suave">
                            {metrica.etiqueta}
                        </p>
                        <p className="mt-3 text-3xl font-bold text-navegacion">
                            {metrica.valor}
                        </p>
                        <p className={`mt-2 text-xs font-semibold ${estiloTendencia[metrica.tendencia]}`}>
                            {metrica.detalle}
                        </p>
                    </article>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <article className="rounded-tarjeta border border-borde bg-white shadow-tarjeta">
                    <div className="flex items-center justify-between border-b border-borde px-6 py-5">
                        <div>
                            <h2 className="font-bold text-navegacion">Próximas salidas</h2>
                            <p className="mt-1 text-sm text-texto-suave">
                                Salidas programadas para los próximos días
                            </p>
                        </div>
                        <Boton className="px-3 py-1.5 text-xs" variante="fantasma">
                            Ver todas
                        </Boton>
                    </div>

                    <div className="divide-y divide-borde">
                        {proximasSalidas.map((salida) => (
                            <div
                                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                                key={`${salida.circuito}-${salida.fecha}`}
                            >
                                <div>
                                    <p className="text-sm font-bold text-texto">{salida.circuito}</p>
                                    <p className="mt-1 text-xs text-texto-suave">{salida.fecha}</p>
                                </div>
                                <div className="text-right">
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado[salida.estado]}`}
                                    >
                                        {salida.estado}
                                    </span>
                                    <p className="mt-1 text-xs text-texto-suave">{salida.cupos}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-tarjeta border border-borde bg-white shadow-tarjeta">
                    <div className="flex items-center justify-between border-b border-borde px-6 py-5">
                        <div>
                            <h2 className="font-bold text-navegacion">Actividad reciente</h2>
                            <p className="mt-1 text-sm text-texto-suave">
                                Últimos movimientos del panel
                            </p>
                        </div>
                        <span aria-hidden="true" className="text-xl text-marca">
                            •••
                        </span>
                    </div>

                    <div className="divide-y divide-borde">
                        {actividadReciente.map((actividad) => (
                            <div className="flex items-start gap-3 px-6 py-4" key={actividad.descripcion}>
                                <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-marca" />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-texto">
                                            {actividad.descripcion}
                                        </p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estiloEstado[actividad.estado]}`}
                                        >
                                            {actividad.estado}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-texto-suave">{actividad.detalle}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>
            </div>

            <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                <div className="mb-4">
                    <h2 className="font-bold text-navegacion">Acciones rápidas</h2>
                    <p className="mt-1 text-sm text-texto-suave">
                        Accedé directamente a las tareas más frecuentes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Boton variante="secundario">Administrar proveedores</Boton>
                    <Boton variante="secundario">Gestionar personal</Boton>
                    <Boton variante="secundario">Revisar reservas</Boton>
                </div>
            </article>
        </section>
    );
}

export default InicioGestionPage;
