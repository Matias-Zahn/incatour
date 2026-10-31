import { useRef } from "react";
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
    const nav = useRef<HTMLElement>(null);

    // En celular el botón queda al final de una lista larga: sin esto, la página nueva se empieza a ver por el último registro
    function irA(pagina: number) {
        onCambiarPagina(pagina);
        const lista = nav.current?.parentElement;
        requestAnimationFrame(() => {
            if (lista && lista.getBoundingClientRect().top < 0) lista.scrollIntoView();
        });
    }

    return (
        <nav
            ref={nav}
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
                        onClick={() => irA(1)}
                    >
                        Primera
                    </Boton>
                ) : null}

                <Boton
                    variante="secundario"
                    className="px-3 py-1.5"
                    disabled={!puedeIrAtras}
                    aria-label="Ir a la página anterior"
                    onClick={() => irA(paginaActual - 1)}
                >
                    Anterior
                </Boton>

                <Boton
                    className="px-3 py-1.5"
                    disabled={!puedeIrAdelante}
                    aria-label="Ir a la página siguiente"
                    onClick={() => irA(paginaActual + 1)}
                >
                    Siguiente
                </Boton>

                {conExtremos ? (
                    <Boton
                        variante="secundario"
                        className="px-3 py-1.5"
                        disabled={!puedeIrAdelante}
                        aria-label="Ir a la última página"
                        onClick={() => irA(totalPaginas)}
                    >
                        Última
                    </Boton>
                ) : null}
            </div>
        </nav>
    );
}

export default Paginacion;
