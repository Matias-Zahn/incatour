import Boton from "./Boton";

type PaginacionProps = {
    paginaActual: number;
    totalPaginas: number;
    onCambiarPagina: (pagina: number) => void;
};

function Paginacion({
    paginaActual,
    totalPaginas,
    onCambiarPagina,
}: PaginacionProps) {
    const puedeIrAtras = paginaActual > 1;
    const puedeIrAdelante = paginaActual < totalPaginas;

    return (
        <nav
            aria-label="Paginación de resultados"
            className="mt-4 flex items-center justify-between gap-4"
        >
            <span className="text-sm text-slate-600">
                Página {paginaActual} de {totalPaginas}
            </span>

            <div className="flex gap-2">
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
            </div>
        </nav>
    );
}

export default Paginacion;
