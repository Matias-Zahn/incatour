import Boton from "./Boton";

type PaginacionProps = {
    paginaActual: number;
    totalPaginas: number;
    onCambiarPagina: (pagina: number) => void;
    /** Cantidad de registros de todas las páginas */
    total?: number;
};

function Paginacion({
    paginaActual,
    totalPaginas,
    onCambiarPagina,
    total,
}: PaginacionProps) {
    const puedeIrAtras = paginaActual > 1;
    const puedeIrAdelante = paginaActual < totalPaginas;
    const conExtremos = totalPaginas > 2;

    return (
        <nav
            aria-label="Paginación de resultados"
            className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
            <span className="text-sm text-slate-600">
                Página {paginaActual} de {totalPaginas}
                {total === undefined ? "" : ` · ${total} en total`}
            </span>

            <div className="flex gap-2">
                {conExtremos ? (
                    <Boton
                        variante="secundario"
                        className="px-3 py-1.5"
                        disabled={!puedeIrAtras}
                        aria-label="Ir a la primera página"
                        onClick={() => onCambiarPagina(1)}
                    >
                        Primera
                    </Boton>
                ) : null}

                <Boton
                    variante="secundario"
                    className="px-3 py-1.5"
                    disabled={!puedeIrAtras}
                    aria-label="Ir a la página anterior"
                    onClick={() => onCambiarPagina(paginaActual - 1)}
                >
                    Anterior
                </Boton>

                <Boton
                    className="px-3 py-1.5"
                    disabled={!puedeIrAdelante}
                    aria-label="Ir a la página siguiente"
                    onClick={() => onCambiarPagina(paginaActual + 1)}
                >
                    Siguiente
                </Boton>

                {conExtremos ? (
                    <Boton
                        variante="secundario"
                        className="px-3 py-1.5"
                        disabled={!puedeIrAdelante}
                        aria-label="Ir a la última página"
                        onClick={() => onCambiarPagina(totalPaginas)}
                    >
                        Última
                    </Boton>
                ) : null}
            </div>
        </nav>
    );
}

export default Paginacion;
