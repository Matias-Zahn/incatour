import { useState, type ReactNode } from "react";
import Paginacion from "./Paginacion";

type ListaPaginadaProps<T> = {
    items: T[];
    porPagina?: number;
    className?: string;
    renderizar: (item: T) => ReactNode;
};

// Para volver a la primera página al cambiar los filtros, el padre le cambia la key
function ListaPaginada<T>({ items, porPagina = 10, className = "space-y-3", renderizar }: ListaPaginadaProps<T>) {
    const [pagina, setPagina] = useState(1);
    const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
    const paginaValida = Math.min(pagina, totalPaginas);

    return (
        <div>
            <div className={className}>
                {items.slice((paginaValida - 1) * porPagina, paginaValida * porPagina).map(renderizar)}
            </div>
            {totalPaginas > 1 ? (
                <Paginacion
                    paginaActual={paginaValida}
                    totalPaginas={totalPaginas}
                    total={items.length}
                    onCambiarPagina={setPagina}
                />
            ) : null}
        </div>
    );
}

export default ListaPaginada;
