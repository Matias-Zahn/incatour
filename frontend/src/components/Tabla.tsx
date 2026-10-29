import type { ReactNode } from "react";

type Columna<T> = {
    clave: keyof T;
    titulo: string;
    renderizar?: (fila: T) => ReactNode;
};

type TablaProps<T extends { id: string | number }> = {
    columnas: Columna<T>[];
    filas: T[];
    claseFila?: (fila: T) => string | undefined;
};

// En celular cada fila se muestra como tarjeta, con el título de la columna al lado de cada dato (solo CSS)
function Tabla<T extends { id: string | number }>({
    columnas,
    filas,
    claseFila,
}: TablaProps<T>) {
    return (
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-white max-md:overflow-visible max-md:border-0 max-md:bg-transparent">
            <table className="w-full text-left max-md:block">
                <thead className="bg-slate-800 text-white max-md:hidden">
                    <tr>
                        {columnas.map((columna) => (
                            <th
                                key={`${String(columna.clave)}-${columna.titulo}`}
                                className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            >
                                {columna.titulo}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody className="max-md:flex max-md:flex-col max-md:gap-3">
                    {filas.map((fila) => (
                        <tr
                            key={fila.id}
                            className={`border-t border-borde max-md:block max-md:rounded-tarjeta max-md:border max-md:bg-white max-md:p-3 ${claseFila ? claseFila(fila) ?? "" : ""}`.trimEnd()}
                        >
                            {columnas.map((columna) => (
                                <td
                                    key={`${String(columna.clave)}-${columna.titulo}`}
                                    data-titulo={columna.titulo}
                                    className="px-4 py-3 text-texto align-top max-md:flex max-md:gap-3 max-md:px-1 max-md:py-1.5 max-md:before:w-24 max-md:before:shrink-0 max-md:before:pt-0.5 max-md:before:text-xs max-md:before:font-bold max-md:before:uppercase max-md:before:text-texto-suave max-md:before:content-[attr(data-titulo)]"
                                >
                                    <div className="min-w-0 flex-1 max-md:[&_*]:whitespace-normal max-md:[&_*]:flex-wrap">
                                        {columna.renderizar
                                            ? columna.renderizar(fila)
                                            : String(fila[columna.clave])}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Tabla;
